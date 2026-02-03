// src/app/features/excel-sum/size.ts

import { normalizeUnit } from "@/app/features/excel-sum/utils";

/**
 * page.tsx 側が持っている ExcelSumPreviewRow の「必要最低限」だけを型として定義。
 * ※ any を使わないためにここで RowLike を用意
 */
export type RowLike = {
  item?: string;
  desc?: string;
  unit?: string;
  qty?: number;
  // 既にAPI側などで入ってくる可能性のあるフィールド
  heightMm?: number;
  wideMm?: number;
  overlapMm?: number;
  lengthMm?: number;
  // AI/推定で入る可能性のあるフィールド（存在しても良い）
  calcM2?: number;
};

type ExtractedSize = {
  heightMm: number | null;
  wideMm: number | null;
  overlapMm: number | null;
  lengthMm: number | null;
};

/**
 * 表示用：寸法を文字列にする
 * 例: H=300 / W=150 / 300x300 / L=1200 / 重ね=100
 */
export function formatSize(r: RowLike): string {
  // ① 既存フィールドがあれば最優先
  const fromFields: ExtractedSize = {
    heightMm: numOrNull(r.heightMm),
    wideMm: numOrNull(r.wideMm),
    overlapMm: numOrNull(r.overlapMm),
    lengthMm: numOrNull(r.lengthMm),
  };

  const hasAnyField =
    fromFields.heightMm != null ||
    fromFields.wideMm != null ||
    fromFields.overlapMm != null ||
    fromFields.lengthMm != null;

  if (hasAnyField) return formatSizeParts(fromFields);

  // ② ここが今回の改善：テキストからも拾う（W-150 / H-50 など）
  const text = `${r.item ?? ""} ${r.desc ?? ""}`.trim();
  const extracted = extractSizeFromText(text);

  const hasAny =
    extracted.heightMm != null ||
    extracted.wideMm != null ||
    extracted.overlapMm != null ||
    extracted.lengthMm != null;

  if (!hasAny) return "";

  return formatSizeParts(extracted);
}

/**
 * m 行の「使用(m)」の初期値推定
 * 例:
 * - W-150 → 0.15
 * - H-200（立上り）→ 0.20（Wが無くHしか無い場合）
 */
export function guessDefaultCalcM(r: RowLike): number | null {
  const unit = normalizeUnit(r.unit ?? "");
  if (unit !== "m") return null;

  const text = `${r.item ?? ""} ${r.desc ?? ""}`.trim();
  const s = extractSizeFromText(text);

  // 既に wideMm / heightMm があれば優先
  const wideMm = numOrNull(r.wideMm) ?? s.wideMm;
  const heightMm = numOrNull(r.heightMm) ?? s.heightMm;

  // 立上り/巾木/側溝などは H を優先したいケースが多い
  const preferH = shouldPreferHeightForM(text);

  const mm = preferH ? heightMm ?? wideMm : wideMm ?? heightMm;
  if (mm == null) return null;

  // mm → m（例: 150mm → 0.15m）
  const m = mm / 1000;
  if (!Number.isFinite(m) || m <= 0) return null;

  // 異常値ガード（幅/高さが 2m とかはほぼ無いので）
  if (m >= 2) return null;

  // 小数第2位くらいに丸め（UIの見やすさ）
  return Math.round(m * 100) / 100;
}

/**
 * 箇所行の「使用(㎡/箇所)」初期値推定
 * 例:
 * - 300×300 → 0.09
 */
export function guessDefaultCalcM2PerEach(r: RowLike): number | null {
  const unit = normalizeUnit(r.unit ?? "");
  if (unit !== "箇所") return null;

  const text = `${r.item ?? ""} ${r.desc ?? ""}`.trim();
  const s = extractSizeFromText(text);

  const w = s.wideMm ?? numOrNull(r.wideMm);
  const h = s.heightMm ?? numOrNull(r.heightMm);

  if (w == null || h == null) return null;

  const m2 = (w / 1000) * (h / 1000);
  if (!Number.isFinite(m2) || m2 <= 0) return null;

  // ざっくりガード（1箇所あたり 20㎡ みたいなのは稀）
  if (m2 >= 20) return null;

  return Math.round(m2 * 100) / 100;
}

/**
 * 自動サイズ推定を無効にする行判定
 * ここは「見出し/小計/合計」っぽい行だけを弾く程度に弱くしておくと安定します。
 */
export function shouldDisableAutoSize(r: RowLike): boolean {
  const text = `${r.item ?? ""} ${r.desc ?? ""}`.trim();

  // 小計/合計/計/総計など
  if (/(小計|合計|総計|計\b|合\s*計)/.test(text)) return true;

  // 仕様番号だけ等の見出しっぽい
  if (/^防水仕様[-‐ー−]\d+/.test(text)) return true;

  return false;
}

/* =========================
   Internal helpers
========================= */

function numOrNull(v: number | undefined): number | null {
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  return v;
}

function formatSizeParts(s: ExtractedSize): string {
  const parts: string[] = [];

  // 300×300 を優先表示したいので、W/H が両方ある場合は "WxH" も付ける
  if (s.wideMm != null && s.heightMm != null) {
    parts.push(`${s.wideMm}×${s.heightMm}`);
  } else {
    if (s.wideMm != null) parts.push(`W=${s.wideMm}`);
    if (s.heightMm != null) parts.push(`H=${s.heightMm}`);
  }

  if (s.lengthMm != null) parts.push(`L=${s.lengthMm}`);
  if (s.overlapMm != null) parts.push(`重ね=${s.overlapMm}`);

  return parts.join(" ");
}

/**
 * ここが重要：表記揺れ対応のサイズ抽出
 * - W-150 / W=150 / W150 / 幅150 / 巾150 / ヨコ150
 * - H-50 / H=50 / H50 / 高さ50 / 立上り50
 * - 300×300 / 300x300 / 300＊300
 * - 重ね=100 / 重ね-100
 */
function extractSizeFromText(raw: string): ExtractedSize {
  const t = raw.normalize("NFKC"); // 全角英数等を正規化

  // ① 300×300 系（先に取る）
  const pair = matchPairMm(t);
  if (pair) {
    return {
      wideMm: pair.wideMm,
      heightMm: pair.heightMm,
      overlapMm: matchOverlapMm(t),
      lengthMm: matchLengthMm(t),
    };
  }

  // ② W / H / 幅 / 巾 / 高さ
  const wideMm = matchWideMm(t);
  const heightMm = matchHeightMm(t);

  return {
    wideMm,
    heightMm,
    overlapMm: matchOverlapMm(t),
    lengthMm: matchLengthMm(t),
  };
}

function matchPairMm(t: string): { wideMm: number; heightMm: number } | null {
  // 300×300 / 300x300 / 300＊300
  const m = t.match(/(\d{2,4})\s*[×x＊*]\s*(\d{2,4})/);
  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);

  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  if (a <= 0 || b <= 0) return null;

  // 異常値ガード（mmで 20000 みたいなのはほぼ無い）
  if (a >= 20000 || b >= 20000) return null;

  return { wideMm: a, heightMm: b };
}

function matchWideMm(t: string): number | null {
  // W-150 / W=150 / W150
  const w1 = pickNumber(t, /\bW\s*[-=]?\s*(\d{2,4})\b/i);
  if (w1 != null) return w1;

  // 幅150 / 巾150 / ヨコ150
  const w2 = pickNumber(t, /(幅|巾|ヨコ|横)\s*[:=]?\s*(\d{2,4})/);
  if (w2 != null) return w2;

  return null;
}

function matchHeightMm(t: string): number | null {
  // H-50 / H=50 / H50
  const h1 = pickNumber(t, /\bH\s*[-=]?\s*(\d{2,4})\b/i);
  if (h1 != null) return h1;

  // 高さ50 / 立上り50 / タテ50
  const h2 = pickNumber(t, /(高さ|立上り|タテ|縦)\s*[:=]?\s*(\d{2,4})/);
  if (h2 != null) return h2;

  return null;
}

function matchOverlapMm(t: string): number | null {
  // 重ね=100 / 重ね-100 / overlap
  const v = pickNumber(t, /(重ね|ラップ|overlap)\s*[-=]?\s*(\d{2,4})/i);
  return v;
}

function matchLengthMm(t: string): number | null {
  // L=1200 / L-1200 / 長さ1200
  const l1 = pickNumber(t, /\bL\s*[-=]?\s*(\d{2,5})\b/i);
  if (l1 != null) return l1;

  const l2 = pickNumber(t, /(長さ)\s*[:=]?\s*(\d{2,5})/);
  if (l2 != null) return l2;

  return null;
}

function pickNumber(t: string, re: RegExp): number | null {
  const m = t.match(re);
  if (!m) return null;

  const raw = m[m.length - 1];
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;

  // 異常値ガード
  if (n >= 20000) return null;

  return n;
}

/**
 * 「m換算」でHを優先すべきっぽいキーワード
 * ※ ここは必要なら増やせます
 */
function shouldPreferHeightForM(text: string): boolean {
  return /(立上り|巾木|側溝|笠木|端末|鼻先)/.test(text);
}
