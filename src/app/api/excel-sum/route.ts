// src/app/api/excel-sum/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import OpenAI from "openai";
import { detectColumnsSmart } from "@/lib/excel/columnDetect";

export const runtime = "nodejs";

/* =========================
   Types
========================= */

type SizeResult = {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;

  // AIが決めた入力欄の初期値
  suggestedInput?: number;

  // AIが計算した換算㎡（m行のみ or unit=㎡ の行も返してよい）
  calcM2?: number;
};

type ExcelSumResponse = {
  ok: true;
  query: string;
  matchedCount: number;
  sumsByUnit: Record<string, number>;
  sumM2: number; // m換算合計（unit が m の行 + unit=㎡ の行はそのまま加算）
  detectedCols: {
    // NOTE: 返却はすべて 1-based（UIの手入力と一致させる）
    item: number;
    desc: number;
    qty: number;
    unit: number;
    amount: number | null;
    headerRowIndex: number | null;
    usedManualCols: boolean;

    // 互換用: 旧UIは size を参照している
    size: number | null;

    // 新UI/内部は sizeText
    sizeText: number | null; // ★ undefined を返さない
  };
  preview: Array<{
    rowIndex: number; // 1-based
    item?: string;
    desc?: string;
    qty?: number;
    unit?: string;
    amount?: number;

    // AI換算（m行のみ）
    calcM2?: number;

    // AI抽出サイズ
    heightMm?: number;
    overlapMm?: number;
    wideMm?: number;
    lengthMm?: number;

    // 入力欄に自動で入れる値（最重要）
    // - unit=m      → 使用(m)
    // - unit=箇所    → 使用(㎡/箇所)
    // - その他(unit) → 使用(㎡/単位)
    suggestedInput?: number;

    // 確認用（AIへ渡したテキスト）
    sizeText?: string;
    sizeFromAi?: boolean; // AI 100%運用ならtrue
    autoSizeEnabled?: boolean; // unit=m の行だけ true（m以外は false）
  }>;
};

type ExcelSumError = { ok: false; error: string };

type PendingAi = {
  id: number; // previewTemp index
  text: string; // 品名+摘要+サイズ列を結合したテキスト
  unit: string; // 正規化済み unit（m/㎡/箇所/段 など）
  qty: number; // 数量（unit に対応）
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// 全角英数→半角
function toHalfWidthAscii(s: string): string {
  return s.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

function normalizeNFKC(s: string): string {
  return s.normalize("NFKC");
}

function normalizeText(s: string): string {
  const t = toHalfWidthAscii(normalizeNFKC(s));
  return t
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForSearch(s: string): string {
  const t = toHalfWidthAscii(normalizeNFKC(s));
  return t
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function splitQuery(q: string): string[] {
  const s = normalizeText(q);
  if (!s) return [];
  return s
    .split(" ")
    .filter(Boolean)
    .map((t) => normalizeForSearch(t))
    .filter(Boolean);
}

function includesAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const h = normalizeForSearch(haystack);
  return tokens.every((t) => {
    const tt = normalizeForSearch(t);
    return tt ? h.includes(tt) : false;
  });
}

function normalizeUnit(uRaw: string): string {
  const u = normalizeText(uRaw).replace(/\s+/g, "").trim();

  if (u === "ｍ" || u === "M" || u === "m") return "m";
  if (u === "㎡" || u === "m2" || u === "m^2" || u === "m²") return "㎡";
  if (u === "ｋｇ" || u === "KG" || u === "Kg" || u === "kg") return "kg";
  if (u === "Ｌ" || u === "L" || u === "l") return "L";

  return u;
}

function rowToJoinedText(row: unknown[]): string {
  const parts: string[] = [];
  for (const c of row) {
    const t = toStr(c);
    if (t) parts.push(t);
  }
  return normalizeText(parts.join(" "));
}

// サイズ列に「×」だけ入っている等の“無効マーク”はサイズ抽出に使わない
// 注意: 300×300 のような寸法表記は有効なので除外しない
function hasDimensionPairText(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;
  // 300×300 / 300x300 / 300X300 / 300＊300 など
  return /(\d{2,5})\s*[×xX＊*]\s*(\d{2,5})/.test(t);
}

function hasAnySizeKeyword(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;
  // H/W/L/高さ/巾/幅/長さ/立上り/糸尺/重ね/かさね など
  return /(\bH\b|\bW\b|\bL\b|高さ|立上り|糸尺|幅|巾|長さ|重ね|かさね|カサネ)/i.test(
    t,
  );
}

// 「全体→約4m2」「合計 12㎡」「No.8に含む」など“全体量/別行に内包”の記述がある場合、
// そのセル内の 300×300 等を拾って換算すると二重計上/誤計算になりやすい。
// → 寸法ペア(300×300等) と 面積(㎡/m2) が同一セル内に共存し、かつ全体/含む系の語がある場合は
//    サイズ抽出・換算の対象外にする。
function hasAreaToken(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;
  // 4m2 / 4 m2 / 4㎡ / 4.5m2 など
  return /(\d+(?:\.\d+)?)\s*(?:㎡|m2|m\^2|m²)/i.test(t);
}

function hasTotalOrIncludedHint(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;
  // 全体/合計/総/含む/一式 など
  return /(全体|合計|総|含む|一式|no\.?\s*\d+)/i.test(t);
}

function shouldSkipSizeExtraction(raw: string): boolean {
  const t = normalizeText(raw);
  if (!t) return false;

  // 例: "300×300/1ヶ所 *全体→約4m2 *No.8に含む" のようなケースを弾く
  const hasPair = hasDimensionPairText(t);
  const hasArea = hasAreaToken(t);
  const hasHint = hasTotalOrIncludedHint(t);

  return hasPair && hasArea && hasHint;
}

// 「✖︎」「✖️」「✖」が含まれる場合は、そのセルは“対象外”として扱う
function hasInvalidCrossMark(raw: string): boolean {
  // 正規化前の文字も拾えるよう、raw をそのまま見る
  // U+2716 (✖) + variation selectors
  return /✖[\uFE0E\uFE0F]?/.test(raw);
}

function isCrossOnlyMarker(raw: string): boolean {
  // ✖ が混ざっているなら、そのセルは“対象外”
  if (hasInvalidCrossMark(raw)) return true;

  const t = normalizeText(raw);
  if (!t) return false;

  // セルが「×」だけ、または「××」などの記号だけの場合は無効
  // （寸法表記や H/W/L 等の根拠がある場合は無効扱いにしない）
  if (hasDimensionPairText(t) || hasAnySizeKeyword(t)) return false;
  return /^×+$/.test(t);
}

/* =========================
   Manual Col Helpers (1-based -> 0-based)
========================= */

function read1BasedCol(fd: FormData, key: string): number | null {
  const raw = normalizeText(toStr(fd.get(key)));
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i - 1;
}

function read1BasedRow(fd: FormData, key: string): number | null {
  const raw = normalizeText(toStr(fd.get(key)));
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i - 1;
}

function clampColIndex(i: number, maxCols: number): number {
  if (maxCols <= 0) return 0;
  if (i < 0) return 0;
  if (i > maxCols - 1) return maxCols - 1;
  return i;
}

/* =========================
   AI Size Extract (100%)
========================= */

// --- hard fallback extractors (no AI) ---
// AIが overlap(重ね/かさね) を落とすと H だけになり「足せてない」状態が残るため、
// rawテキストから確実に拾って埋める（最小・安全な範囲だけ）
function extractOverlapMmFromText(raw: string): number | undefined {
  const t = normalizeText(raw);
  if (!t) return undefined;

  // 重ね=100 / 重ね 100 / 重ね代100 / かさね100 / カサネ100
  const m = t.match(/(?:重ね代?|かさね|カサネ)\s*[:=]?\s*(\d{1,5})/);
  if (!m) return undefined;
  const n = Number(m[1]);
  // 0 は「表示・計算の根拠にならない」ため未指定扱いにする
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return clampMm(n);
}

function extractHeightMmFromText(raw: string): number | undefined {
  const t = normalizeText(raw);
  if (!t) return undefined;

  // H=410 / H-410 / 高さ410 / 立上り410 / 糸尺=410
  const m = t.match(
    /(?:\bH\s*[-=]?|高さ\s*[:=]?|立上り\s*[:=]?|糸尺\s*[:=]?)\s*(\d{1,5})/i,
  );
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return clampMm(n);
}

function extractWideLengthMmFromText(raw: string): {
  wideMm?: number;
  lengthMm?: number;
} {
  const t = normalizeText(raw);
  if (!t) return {};

  // 300×300 / 300x300 / 220×60
  const pair = t.match(/(\d{2,5})\s*[×x＊*]\s*(\d{2,5})/);
  if (pair) {
    const w = Number(pair[1]);
    const l = Number(pair[2]);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(l) && l > 0) {
      return { wideMm: clampMm(w), lengthMm: clampMm(l) };
    }
  }
  // 念のため: "300X300" なども拾う（大文字X）
  const pair2 = t.match(/(\d{2,5})\s*[Xｘ]\s*(\d{2,5})/);
  if (pair2) {
    const w = Number(pair2[1]);
    const l = Number(pair2[2]);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(l) && l > 0) {
      return { wideMm: clampMm(w), lengthMm: clampMm(l) };
    }
  }

  // W=300 / W-300 / 幅300 / 巾300
  const w1 = t.match(/(?:\bW\s*[-=]?|幅\s*[:=]?|巾\s*[:=]?)\s*(\d{2,5})/i);
  // L=300 / L-300 / 長さ300
  const l1 = t.match(/(?:\bL\s*[-=]?|長さ\s*[:=]?)\s*(\d{2,5})/i);

  const out: { wideMm?: number; lengthMm?: number } = {};
  if (w1) {
    const n = Number(w1[1]);
    if (Number.isFinite(n) && n > 0) out.wideMm = clampMm(n);
  }
  if (l1) {
    const n = Number(l1[1]);
    if (Number.isFinite(n) && n > 0) out.lengthMm = clampMm(n);
  }
  return out;
}

function applyHardFallbackFromText(row: {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;
  _rawSizeText: string;
}) {
  const raw = row._rawSizeText;
  if (!raw) return;

  // overlap は「足せてない」原因の本丸なので最優先で補完
  if (row.overlapMm == null) {
    const ov = extractOverlapMmFromText(raw);
    if (ov != null) row.overlapMm = ov;
  }

  // height / wide/length も欠損時のみ補完
  if (row.heightMm == null) {
    const h = extractHeightMmFromText(raw);
    if (h != null) row.heightMm = h;
  }

  const wl = extractWideLengthMmFromText(raw);
  // AIが片側だけ返すケースがあるため、欠けている方だけでも必ず埋める
  if (wl.wideMm != null && row.wideMm == null) row.wideMm = wl.wideMm;
  if (wl.lengthMm != null && row.lengthMm == null) row.lengthMm = wl.lengthMm;
}

function clampMm(n: number): number {
  const v = Math.round(n);
  if (v < 0) return 0;
  if (v > 999999) return 999999;
  return v;
}

function pickNumMm(v: unknown): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  const mm = clampMm(v);
  return mm > 0 ? mm : undefined;
}

function pickFiniteNum(v: unknown): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  return v;
}

function safeExtractSize(obj: unknown): SizeResult {
  if (!isObject(obj)) return {};
  const out: SizeResult = {};

  const h = pickNumMm(obj.heightMm);
  const w = pickNumMm(obj.wideMm);
  const l = pickNumMm(obj.lengthMm);

  // overlapMm は 0 は返さない（0は未指定扱い）
  const ovRaw = obj.overlapMm;
  let ov: number | undefined;
  if (typeof ovRaw === "number" && Number.isFinite(ovRaw)) {
    const mm = clampMm(ovRaw);
    if (mm > 0) ov = mm;
  }

  const sug = pickFiniteNum(obj.suggestedInput);
  const cm2 = pickFiniteNum(obj.calcM2);

  if (h != null) out.heightMm = h;
  if (w != null) out.wideMm = w;
  if (l != null) out.lengthMm = l;
  if (ov != null) out.overlapMm = ov;
  if (sug != null) out.suggestedInput = sug;
  if (cm2 != null) out.calcM2 = cm2;

  return out;
}

function stripCodeFence(s: string): string {
  const t = s.trim();
  return t
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function tryParseJsonArray(text: string): unknown[] | null {
  const stripped = stripCodeFence(text);
  try {
    const v: unknown = JSON.parse(stripped);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// ありがちな崩れを最小限で修復（末尾カンマ等）
function tryRepairAndParseJsonArray(text: string): unknown[] | null {
  const s0 = stripCodeFence(text);
  const s1 = s0.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}").trim();
  try {
    const v: unknown = JSON.parse(s1);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

// unit=m のとき「使用(m)」を決める（最優先：height+overlap、次点：wide）
function suggestedInputForUnitM(size: SizeResult): number | null {
  if (size.heightMm != null) {
    const h = size.heightMm + (size.overlapMm ?? 0);
    const m = h / 1000;
    return Number.isFinite(m) && m > 0 ? m : null;
  }
  if (size.wideMm != null) {
    const m = size.wideMm / 1000;
    return Number.isFinite(m) && m > 0 ? m : null;
  }
  return null;
}

// --- size sanitization ---
// W-100 のように「幅だけ」書かれている場合、AIが lengthMm まで同値で埋めてしまうことがある。
// その場合は lengthMm を捨てる（300×300 等のペア指定や L/長さ 指定がある時だけ lengthMm を採用）
function hasPairDimensionText(t: string): boolean {
  const s = normalizeText(t);
  return (
    /(\d{2,4})\s*[×x＊*]\s*(\d{2,4})/.test(s) ||
    /(\d{2,4})\s*[Xｘ]\s*(\d{2,4})/.test(s)
  );
}

function hasExplicitLengthText(t: string): boolean {
  // L= / L- / 長さ
  return /\bL\s*[-=]?\s*\d{2,5}\b/i.test(t) || /長さ\s*[:=]?\s*\d{2,5}/.test(t);
}

function sanitizeAiSizeByText(
  size: SizeResult,
  rawSizeText: string,
): SizeResult {
  const t = normalizeText(rawSizeText);
  if (!t) return size;

  const hasPair = hasPairDimensionText(t);
  const hasLen = hasExplicitLengthText(t);

  // ペア指定も L/長さ指定も無いのに wide と length が同値で入っている場合は length を捨てる
  if (!hasPair && !hasLen) {
    if (
      size.wideMm != null &&
      size.lengthMm != null &&
      Number.isFinite(size.wideMm) &&
      Number.isFinite(size.lengthMm) &&
      size.wideMm === size.lengthMm
    ) {
      return { ...size, lengthMm: undefined };
    }
  }

  return size;
}

// --- Additional helpers for AI size sanitization ---
function hasExplicitHeightText(t: string): boolean {
  // H= / H- / 高さ / 立上り / 糸尺
  return (
    /\bH\s*[-=]?\s*\d{1,5}\b/i.test(t) ||
    /高さ\s*[:=]?\s*\d{1,5}/.test(t) ||
    /立上り\s*[:=]?\s*\d{1,5}/.test(t) ||
    /糸尺\s*[:=]?\s*\d{1,5}/.test(t)
  );
}

// 量(m)がそのまま「高さmm」に化ける事故を除去する（qty*1000mm に近い値を捨てる）
function sanitizeSuspiciousMmFromQty(
  unitNormalized: string,
  qty: number,
  rawSizeText: string,
  size: SizeResult,
): SizeResult {
  const u = normalizeText(unitNormalized).replace(/\s+/g, "");
  if (u !== "m") return size;

  const t = normalizeText(rawSizeText);
  const hasH = hasExplicitHeightText(t);

  const out: SizeResult = { ...size };

  // 立上り等の現実的な範囲ガード（qty誤爆もここで止まる）
  // 防水の立上り/高さは通常数十〜数千mmなので 5000mm を上限にする
  const MAX_H_MM = 5000;

  const qtyMm = Number.isFinite(qty) ? qty * 1000 : NaN;
  const tol = Number.isFinite(qtyMm) ? Math.max(30, Math.abs(qtyMm) * 0.02) : 0; // 2% or 30mm

  if (out.heightMm != null) {
    if (out.heightMm > MAX_H_MM) {
      out.heightMm = undefined;
    } else if (
      !hasH &&
      Number.isFinite(qtyMm) &&
      Math.abs(out.heightMm - qtyMm) <= tol
    ) {
      // raw に H/高さ/立上り/糸尺 の根拠が無いのに qty*1000 に近い → 誤爆
      out.heightMm = undefined;
    }
  }

  // wide/length に qty*1000 が入る誤爆も一応潰す（同条件）
  if (out.wideMm != null) {
    if (out.wideMm > 50000) {
      out.wideMm = undefined;
    } else if (Number.isFinite(qtyMm) && Math.abs(out.wideMm - qtyMm) <= tol) {
      out.wideMm = undefined;
    }
  }
  if (out.lengthMm != null) {
    if (out.lengthMm > 50000) {
      out.lengthMm = undefined;
    } else if (
      Number.isFinite(qtyMm) &&
      Math.abs(out.lengthMm - qtyMm) <= tol
    ) {
      out.lengthMm = undefined;
    }
  }

  return out;
}

// unit=箇所 / その他 → 「使用(㎡/単位)」を決める（wide×lengthが取れたら面積）
function suggestedInputForArea(size: SizeResult): number | null {
  if (size.wideMm != null && size.lengthMm != null) {
    const m2 = (size.wideMm / 1000) * (size.lengthMm / 1000);
    return Number.isFinite(m2) && m2 > 0 ? m2 : null;
  }
  return null;
}

// unit=段 などの特殊補正（最小差分）
function normalizeForIncludes(s: string): string {
  return normalizeText(s).replace(/\s+/g, "");
}

// 階段の「踏み面2面で1段」など、段だけ補正したいケース
// - ルールは狭く：unit が「段」で、テキストに踏み面が含まれる時だけ 2倍
function applyUnitSpecificMultiplier(
  unitNormalized: string,
  rawSizeText: string,
  suggested: number | null,
): number | null {
  if (suggested == null) return null;

  const u = normalizeText(unitNormalized).replace(/\s+/g, "");
  if (u !== "段") return suggested;

  const t = normalizeForIncludes(rawSizeText);
  // 「踏み面」「踏面」「踏み」「蹴上」などの表記揺れを最小限で拾う
  const hasTread =
    t.includes("踏み面") || t.includes("踏面") || t.includes("踏み");

  if (!hasTread) return suggested;

  const v = suggested * 2;
  return Number.isFinite(v) && v > 0 ? v : suggested;
}

function calcM2ForUnitM(qtyM: number, size: SizeResult): number | null {
  const m = suggestedInputForUnitM(size);
  if (m == null) return null;
  const m2 = qtyM * m;
  return Number.isFinite(m2) ? m2 : null;
}

async function aiExtractSizesBatch(
  items: PendingAi[],
): Promise<Map<number, SizeResult>> {
  const out = new Map<number, SizeResult>();
  if (items.length === 0) return out;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return out;

  const model = process.env.OPENAI_MODEL_SIZE_FALLBACK?.trim() || "gpt-4o-mini";
  const client = new OpenAI({ apiKey });

  const payload = items.map((x) => ({
    id: x.id,
    text: x.text,
    unit: x.unit,
    qty: x.qty,
  }));

  const prompt = [
    "あなたは建築明細のサイズ抽出＆換算アシスタントです。",
    "入力配列の各要素について、サイズ抽出(mm)と入力欄(suggestedInput)と換算㎡(calcM2)を返してください。",
    "",
    "重要: 文字列には '計118m' や '東棟→61m' のように **メートル(m)** が混ざります。",
    "- 'm' が付く数値(例: 118m, 61m, 230m, 3.5m。正規表現例: /\\d+(?:\\.\\d+)?m\\b/) は **メートル**。heightMm/wideMm/lengthMm/overlapMm には絶対に入れない（mm抽出対象外）。",
    "- mm抽出は H/W/L/高さ/巾/幅/長さ/立上り/糸尺/重ね/カサネ/かさね 等、または '300×300' のような寸法表記のみから行ってください。",
    "",
    "必須ルール(mm抽出):",
    "- 数字は基本 mm とみなす（mm表記がなくてもmm）※ただし 'm' 付きは除外",
    "- キー揺れに対応: H/W/L/高さ/巾/幅/長さ/立上り/糸尺/重ね/カサネ/かさね 等",
    "- 例: '300×300' は wideMm=300, lengthMm=300",
    "- '重ね 100' / '重ね=100' / '重ね:100' / '重ね100' / '重ね代100' / 'かさね100' / 'カサネ100' は overlapMm=100（最重要）",
    "- unit が 'm' の時、suggestedInput は **必ず** (heightMm + overlapMm)/1000 を優先する（overlapMm が取れているのに heightMm/1000 だけにしない）",
    "- '糸尺=410' のような場合は heightMm=410 としてよい",
    "- 不明はそのフィールドを出さない（nullも出さない）",
    "",
    "suggestedInput の決め方:",
    "- unit が 'm' の時: 使用(m) を返す。優先は (heightMm + overlapMm)/1000（overlapMm が無い場合は 0 扱い）、次点は wideMm/1000。取れなければ suggestedInput を出さない。",
    "- unit が '箇所' の時: 使用(㎡/箇所) を返す。wideMm と lengthMm が取れれば (wideMm/1000)*(lengthMm/1000)。取れなければ出さない。",
    "- unit が '㎡' の時: suggestedInput は不要（出さなくてOK）。",
    "- それ以外の unit の時: 使用(㎡/単位) を返す。wideMm と lengthMm が取れれば (wideMm/1000)*(lengthMm/1000)。取れなければ出さない。",
    "",
    "calcM2 の決め方:",
    "- unit が 'm' の時は **必ず** calcM2 を返す。calcM2 = qty * suggestedInput。suggestedInput が無いなら、heightMm/overlapMm/wideMm から suggestedInput を決めてから計算する。",
    "- unit が '㎡' の時は calcM2 は出さない（出力しない）。",
    "- その他の unit は calcM2 は出さない（出力しない）。",
    "",
    "出力は **必ず JSON のみ**（配列）。説明禁止。markdown禁止。",
    '出力形式: [{"id": number, "heightMm"?: number, "wideMm"?: number, "lengthMm"?: number, "overlapMm"?: number, "suggestedInput"?: number, "calcM2"?: number}]',
    "",
    "入力:",
    JSON.stringify(payload),
  ].join("\n");

  const r = await client.chat.completions.create({
    model,
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Return ONLY valid JSON array. No markdown. No explanation. JSON only.",
      },
      { role: "user", content: prompt },
    ],
  });

  const content = r.choices[0]?.message?.content ?? "";
  if (!content) return out;

  const parsed =
    tryParseJsonArray(content) ?? tryRepairAndParseJsonArray(content);
  if (!parsed) return out;

  for (const row of parsed) {
    if (!isObject(row)) continue;
    const idRaw = row.id;
    if (typeof idRaw !== "number" || !Number.isFinite(idRaw)) continue;
    const id = Math.floor(idRaw);
    const size = safeExtractSize(row);
    out.set(id, size);
  }

  return out;
}

/* =========================
   POST
========================= */

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const file = fd.get("file");
    if (!(file instanceof File)) {
      const res: ExcelSumError = { ok: false, error: "file がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    const query = normalizeText(
      toStr(fd.get("query")) || toStr(fd.get("code")),
    );
    if (!query) {
      const res: ExcelSumError = { ok: false, error: "query がありません" };
      return NextResponse.json(res, { status: 400 });
    }
    const tokens = splitQuery(query);

    const requestedSheetNameRaw = normalizeText(toStr(fd.get("sheetName")));

    const hideZeroAmount =
      normalizeText(toStr(fd.get("hideZeroAmount"))).toLowerCase() === "true" ||
      normalizeText(toStr(fd.get("hideNoPrice"))).trim() === "1";

    const useManualCols =
      normalizeText(toStr(fd.get("useManualCols"))).trim() === "1";

    const previewAll =
      normalizeText(toStr(fd.get("previewAll"))).trim() === "1";

    // ✅ AIサイズ抽出は基本ON（"0" でOFF）
    const useAiSize = normalizeText(toStr(fd.get("useAiSize"))).trim() !== "0";

    // ✅ AI処理上限（重さ対策）
    const sizeAiMax = (() => {
      const raw = normalizeText(toStr(fd.get("sizeAiMax")));
      const n = raw ? Number(raw) : NaN;
      if (Number.isFinite(n) && n > 0) return Math.floor(n);
      return 200;
    })();

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });

    function normalizeSheetNameForMatch(s: string): string {
      const t = toHalfWidthAscii(normalizeText(s));
      return t
        .replace(/\s+/g, "")
        .replace(
          /[\-\uFF0D\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u2500\u2501\u30FC]/g,
          "",
        )
        .toLowerCase();
    }

    function findBestSheetName(
      sheetNames: string[],
      requested: string,
    ):
      | { ok: true; name: string }
      | { ok: false; reason: "not_found" | "ambiguous"; candidates: string[] } {
      const reqN = normalizeText(requested);
      if (!reqN) return { ok: true, name: sheetNames[0] || "" };

      if (sheetNames.includes(reqN)) return { ok: true, name: reqN };

      const reqKey = normalizeSheetNameForMatch(reqN);
      const hits = sheetNames.filter(
        (n) => normalizeSheetNameForMatch(n) === reqKey,
      );

      if (hits.length === 1) return { ok: true, name: hits[0] };
      if (hits.length >= 2)
        return { ok: false, reason: "ambiguous", candidates: hits };

      return { ok: false, reason: "not_found", candidates: sheetNames };
    }

    const sheetPick = findBestSheetName(wb.SheetNames, requestedSheetNameRaw);
    if (sheetPick.ok === false) {
      const res: ExcelSumError = {
        ok: false,
        error:
          sheetPick.reason === "ambiguous"
            ? `指定シートが曖昧です: ${requestedSheetNameRaw}（一致候補: ${sheetPick.candidates.join(", ")}）`
            : `指定シートが見つかりません: ${requestedSheetNameRaw}（候補: ${sheetPick.candidates.join(", ")}）`,
      };
      return NextResponse.json(res, { status: 400 });
    }

    const sheetName = sheetPick.name;
    if (!sheetName) {
      const res: ExcelSumError = { ok: false, error: "シートが見つかりません" };
      return NextResponse.json(res, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];

    // シートの開始行/開始列（!ref が A1 とは限らない）
    const ref = (ws as XLSX.WorkSheet)["!ref"] as string | undefined;
    const sheetRange = ref ? XLSX.utils.decode_range(ref) : null;
    const startRow0 = sheetRange ? sheetRange.s.r : 0; // 0-based
    const startCol0 = sheetRange ? sheetRange.s.c : 0; // 0-based

    const rowsRaw = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: "",
      // 空行を落とすと Excel の行番号とズレるので保持する
      blankrows: true,
      // !ref の開始位置から AoA が始まる前提で処理する
      // （sheet_to_json は基本 !ref を基準に配列化される）
    }) as unknown[];

    function fillMergedCellsAoA(
      aoa: unknown[][],
      merges: XLSX.Range[] | undefined,
      startRow0: number,
      startCol0: number,
    ): unknown[][] {
      if (!merges || merges.length === 0) return aoa;

      const out: unknown[][] = aoa.map((r) => (Array.isArray(r) ? [...r] : []));

      const ensureRowLen = (row: unknown[], len: number) => {
        while (row.length < len) row.push("");
      };

      for (const m of merges) {
        const s = m.s;
        const e = m.e;

        // merges はシート絶対座標。AoA は !ref の開始行/開始列からの相対。
        const r0 = s.r - startRow0;
        const c0 = s.c - startCol0;
        const r1 = e.r - startRow0;
        const c1 = e.c - startCol0;

        // AoA の範囲外は無視
        if (r1 < 0 || c1 < 0) continue;
        if (r0 >= out.length) continue;

        while (out.length <= r0) out.push([]);
        const startRow = out[r0];
        ensureRowLen(startRow, c0 + 1);

        const topLeft = startRow[c0];
        const topLeftStr = normalizeText(toStr(topLeft));
        if (!topLeftStr) continue;

        const rrStart = Math.max(0, r0);
        const rrEnd = Math.min(out.length - 1, r1);

        for (let rr = rrStart; rr <= rrEnd; rr++) {
          const row = out[rr];
          const ccStart = Math.max(0, c0);
          const ccEnd = Math.max(ccStart, c1);
          ensureRowLen(row, ccEnd + 1);

          for (let cc = ccStart; cc <= ccEnd; cc++) {
            const cur = row[cc];
            const curStr = normalizeText(toStr(cur));
            if (!curStr) row[cc] = topLeft;
          }
        }
      }
      return out;
    }

    const rows2dRaw = rowsRaw.filter((r) => Array.isArray(r)) as unknown[][];
    const merges = (ws as XLSX.WorkSheet)["!merges"] as
      | XLSX.Range[]
      | undefined;
    const rows2d = fillMergedCellsAoA(rows2dRaw, merges, startRow0, startCol0);

    let maxCols = 0;
    for (const r of rows2d.slice(0, 200)) {
      maxCols = Math.max(maxCols, r.length);
    }

    const detected = detectColumnsSmart(rows2d, toStr, toNum);

    let itemCol = detected.item;
    let descCol = detected.desc;
    let qtyCol = detected.qty;
    let unitCol = detected.unit;
    let amountCol = detected.amount;
    let headerRowIndex: number | null = detected.headerRowIndex;
    // ★ sizeText が未検出(undefined)のときは null（未指定）に明示
    // ★ auto検出の sizeText は信用しない（manual / fallback で確定させる）
    // auto検出は参考値。manual指定があれば必ず manual を採用する
    let sizeTextCol: number | null =
      typeof detected.sizeText === "number" ? detected.sizeText : null;
    if (useManualCols && (sizeTextCol == null || sizeTextCol < 0)) {
      throw new Error(
        "sizeCol（サイズ列）が未指定です。列指定ON時は必須です。",
      );
    }
    // ★ auto検出で qty と同じ列なら無効化するが、manual指定は絶対に殺さない
    if (!useManualCols && sizeTextCol != null && sizeTextCol === qtyCol) {
      sizeTextCol = null;
    }

    if (useManualCols) {
      const hr = read1BasedRow(fd, "headerRowIndex");
      const mi = read1BasedCol(fd, "itemCol");
      const md = read1BasedCol(fd, "descCol");
      const mq = read1BasedCol(fd, "qtyCol");
      const mu = read1BasedCol(fd, "unitCol");
      const ma = read1BasedCol(fd, "amountCol"); // optional
      const ms = read1BasedCol(fd, "sizeCol"); // required

      if (mi == null || md == null || mq == null || mu == null || ms == null) {
        const res: ExcelSumError = {
          ok: false,
          error:
            "列指定ONの場合、itemCol/descCol/qtyCol/unitCol/sizeCol は必須です（左から数えて1,2,3...）",
        };
        return NextResponse.json(res, { status: 400 });
      }

      if (hr != null) headerRowIndex = hr;

      itemCol = clampColIndex(mi, maxCols);
      descCol = clampColIndex(md, maxCols);
      qtyCol = clampColIndex(mq, maxCols);
      unitCol = clampColIndex(mu, maxCols);
      amountCol = ma == null ? null : clampColIndex(ma, maxCols);
      sizeTextCol = clampColIndex(ms, maxCols); // ★ manual 指定を絶対採用

      // ★ デバッグ用：手指定 sizeCol を必ず反映させる
      // ここで sizeTextCol は null / undefined になってはいけない
      if (sizeTextCol == null) {
        throw new Error("sizeCol の manual 指定が反映されていません（null）");
      }

      // ★ sizeCol が qtyCol と同じならエラーにする（数量誤爆防止）
      if (sizeTextCol != null && sizeTextCol === qtyCol) {
        const res: ExcelSumError = {
          ok: false,
          error:
            "sizeCol（サイズ列）が数量列(qtyCol)と同じです。列指定を確認してください。",
        };
        return NextResponse.json(res, { status: 400 });
      }

      if (hideZeroAmount && amountCol == null) {
        const res: ExcelSumError = {
          ok: false,
          error:
            "「金額0/空除外」をONにする場合、amountCol（金額列）の指定が必要です",
        };
        return NextResponse.json(res, { status: 400 });
      }
      // ★ sizeCol は必須（qty等を誤読させないため）
      if (sizeTextCol == null || sizeTextCol < 0) {
        const res: ExcelSumError = {
          ok: false,
          error: "sizeCol（サイズ列）が正しく指定されていません",
        };
        return NextResponse.json(res, { status: 400 });
      }
    }

    const sumsByUnit: Record<string, number> = {};
    let matchedCount = 0;
    let sumM2 = 0;

    const previewTemp: Array<{
      rowIndex: number;
      item?: string;
      desc?: string;
      qty?: number;
      unit?: string;
      amount?: number;

      calcM2?: number;

      heightMm?: number;
      overlapMm?: number;
      wideMm?: number;
      lengthMm?: number;

      suggestedInput?: number;

      sizeText?: string;
      sizeFromAi?: boolean;
      autoSizeEnabled?: boolean;

      _unitNormalized: string;
      _qty: number;
      _rawSizeText: string;
    }> = [];

    const pendingAi: PendingAi[] = [];

    for (let i = 0; i < rows2d.length; i++) {
      if (headerRowIndex != null && i <= headerRowIndex) continue;

      const r = rows2d[i];
      const joined = rowToJoinedText(r);
      if (!includesAllTokens(joined, tokens)) continue;

      const qty = toNum(r[qtyCol]);
      if (qty == null || qty === 0) continue;

      const amount = amountCol != null ? toNum(r[amountCol]) : null;
      if (hideZeroAmount) {
        if (amount == null || amount === 0) continue;
      }

      matchedCount++;

      const unitRaw = toStr(r[unitCol]);
      const unit = normalizeUnit(unitRaw);
      const isUnitM = unit === "m";

      sumsByUnit[unit] = (sumsByUnit[unit] ?? 0) + qty;

      const itemTextAll = normalizeText(toStr(r[itemCol]));
      const descTextAll = normalizeText(toStr(r[descCol]));

      const sizeTextColRaw =
        sizeTextCol != null && sizeTextCol >= 0
          ? normalizeText(toStr(r[sizeTextCol]))
          : "";

      // =========================================================
      // ✅ サイズは「m の行だけ」扱う
      //    - m以外はサイズ自動抽出しない
      //    - m以外は表示用 sizeText も出さない（UI上で誤解が起きるため）
      // =========================================================
      const sizeTextForDisplay = isUnitM ? sizeTextColRaw : "";

      let sizeTextJoined = "";
      if (isUnitM) {
        // m の時だけ「抽出対象テキスト」を採用
        sizeTextJoined = sizeTextColRaw;

        // 1) 元セルに ✖ が含まれる／または「×だけ」なら無効扱い
        if (isCrossOnlyMarker(sizeTextColRaw)) {
          sizeTextJoined = "";
        }

        // 2) 「寸法ペア + 面積 + 全体/含む」系は誤計算になりやすいので除外
        if (sizeTextJoined && shouldSkipSizeExtraction(sizeTextJoined)) {
          sizeTextJoined = "";
        }
      }

      // Excel の実行行番号（1-based）。!ref の開始行 + AoA index を補正する
      const rowIndex1Based = startRow0 + i + 1;

      const shouldPreview = previewAll || previewTemp.length < 30;
      if (!shouldPreview) continue;

      const idx = previewTemp.length;

      previewTemp.push({
        rowIndex: rowIndex1Based,
        item: itemTextAll || undefined,
        desc: descTextAll || undefined,
        qty,
        unit,
        amount: amount ?? undefined,

        calcM2: undefined,

        heightMm: undefined,
        overlapMm: undefined,
        wideMm: undefined,
        lengthMm: undefined,

        suggestedInput: undefined,

        // 表示用：m 以外でもサイズ列の文字は出してよい（ただし自動抽出はしない）
        sizeText: sizeTextForDisplay ? sizeTextForDisplay : undefined,
        // 自動抽出は m の行だけ
        sizeFromAi: useAiSize && isUnitM ? true : false,
        // UI側の自動入力/自動換算も unit=m の行だけ許可する
        autoSizeEnabled: isUnitM,

        _unitNormalized: unit,
        _qty: qty,
        // 自動抽出用：m 以外は必ず ""（AI/regex の対象外）
        _rawSizeText: sizeTextJoined,
      });

      // unit=㎡ はそのまま㎡合計に入れる（AI不要）
      if (unit === "㎡") {
        const row = previewTemp[idx];
        row.calcM2 = qty;
        sumM2 += qty;
      }

      // =========================================================
      // ✅ AIに渡すのも「m だけ」
      // =========================================================
      if (useAiSize && isUnitM && sizeTextJoined) {
        pendingAi.push({ id: idx, text: sizeTextJoined, unit, qty });
      } else {
        // ✅ m以外は「自動抽出」だけ無効化（表示用 sizeText は残す）
        previewTemp[idx]._rawSizeText = "";

        previewTemp[idx].heightMm = undefined;
        previewTemp[idx].overlapMm = undefined;
        previewTemp[idx].wideMm = undefined;
        previewTemp[idx].lengthMm = undefined;
        previewTemp[idx].suggestedInput = undefined;

        // ※ calcM2 は unit=㎡ の時は必要なので消さない
        if (unit !== "㎡") previewTemp[idx].calcM2 = undefined;

        previewTemp[idx].sizeFromAi = false;
        previewTemp[idx].autoSizeEnabled = false;
      }
    }

    if (useAiSize && pendingAi.length > 0) {
      const limited = pendingAi.slice(0, sizeAiMax);
      const filled = await aiExtractSizesBatch(limited);

      for (const [id, sz] of filled.entries()) {
        const row = previewTemp[id];
        if (!row) continue;

        // AIの結果をそのまま反映（100% AI運用）
        if (sz.heightMm != null) row.heightMm = sz.heightMm;
        if (sz.wideMm != null) row.wideMm = sz.wideMm;
        if (sz.lengthMm != null) row.lengthMm = sz.lengthMm;
        if (sz.overlapMm != null) row.overlapMm = sz.overlapMm;

        // ✅ AIが落とした「重ね/かさね」を確実に拾う（ここが“足せてない”の主因）
        applyHardFallbackFromText(row);

        // ✅ AI値のサニタイズ（テキスト根拠のない length=wide や qty→mm誤爆を除去）
        {
          const base: SizeResult = {
            heightMm: row.heightMm,
            wideMm: row.wideMm,
            lengthMm: row.lengthMm,
            overlapMm: row.overlapMm,
            suggestedInput: row.suggestedInput,
            calcM2: row.calcM2,
          };

          // 1) Wだけなのに Lまで同値で埋めた…等を修正
          let s1 = sanitizeAiSizeByText(base, row._rawSizeText);

          // 2) qty(m) がそのまま高さmmになった事故（例: qty=58.8 → heightMm=58800）を除去
          s1 = sanitizeSuspiciousMmFromQty(
            row._unitNormalized,
            row._qty,
            row._rawSizeText,
            s1,
          );

          row.heightMm = s1.heightMm;
          row.wideMm = s1.wideMm;
          row.lengthMm = s1.lengthMm;
          row.overlapMm = s1.overlapMm;
        }

        // suggestedInput / calcM2 は AI を最優先。ただし、AIが省略した場合は最小限の確定計算で穴埋めする。
        if (sz.suggestedInput != null) row.suggestedInput = sz.suggestedInput;

        // フェイルセーフ: unit=m は (height+overlap)/1000 を最優先で確定させる
        if (row._unitNormalized === "m") {
          // まずテキストfallback適用後のフィールドで再計算
          const sug0 = suggestedInputForUnitM({
            heightMm: row.heightMm,
            wideMm: row.wideMm,
            lengthMm: row.lengthMm,
            overlapMm: row.overlapMm,
          });
          const sug = applyUnitSpecificMultiplier(
            row._unitNormalized,
            row._rawSizeText,
            sug0,
          );

          // AIが suggestedInput を返していても、重ねを足していないケースを潰すため、
          // sug が取れたら必ずそれを採用する
          if (sug != null) row.suggestedInput = sug;
        }

        // unit=m / 箇所 / ㎡ の行だけ m換算(㎡) を確定して sumM2 に足す
        if (row._unitNormalized === "m") {
          // unit=m の calcM2 は「確定した suggestedInput」から必ず作る（AIの calcM2 は採用しない）
          const calc =
            row.suggestedInput != null ? row._qty * row.suggestedInput : null;

          if (calc != null && Number.isFinite(calc)) {
            row.calcM2 = calc;
            sumM2 += calc;
          }
        } else if (row._unitNormalized === "箇所") {
          // ✅ 今回の方針：箇所は自動換算しない（事故防止）
        } else if (row._unitNormalized === "㎡") {
          // unit=㎡ は qty がそのまま㎡（ただし既にループ前で入れているので二重加算しない）
          // AIが calcM2 を返しても無視してOK
        } else {
          // その他 unit は m換算合計には入れない
          // （AIが calcM2 を返しても sumM2 を壊さない）
        }
      }
    }

    const preview: ExcelSumResponse["preview"] = previewTemp.map((r) => ({
      rowIndex: r.rowIndex,
      item: r.item,
      desc: r.desc,
      qty: r.qty,
      unit: r.unit,
      amount: r.amount,

      calcM2: r.calcM2,

      heightMm: r.heightMm,
      overlapMm: r.overlapMm,
      wideMm: r.wideMm,
      lengthMm: r.lengthMm,

      suggestedInput: r.suggestedInput,

      sizeText: r.sizeText,
      sizeFromAi: r.sizeFromAi,
      autoSizeEnabled: r.autoSizeEnabled,
    }));

    // ★ 最終的に使用した sizeTextCol を確定させる（manual優先）
    const resolvedSizeTextCol =
      typeof sizeTextCol === "number" ? sizeTextCol : null;

    const res: ExcelSumResponse = {
      ok: true,
      query,
      matchedCount,
      sumsByUnit,
      sumM2,
      detectedCols: {
        // 返却は 1-based
        item: itemCol + 1,
        desc: descCol + 1,
        qty: qtyCol + 1,
        unit: unitCol + 1,
        amount: amountCol == null ? null : amountCol + 1,
        headerRowIndex: headerRowIndex == null ? null : headerRowIndex + 1,
        usedManualCols: useManualCols,

        // 互換: size は sizeText と同じ値を返す
        size: resolvedSizeTextCol == null ? null : resolvedSizeTextCol + 1,
        sizeText: resolvedSizeTextCol == null ? null : resolvedSizeTextCol + 1,
      },
      preview,
    };

    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const res: ExcelSumError = { ok: false, error: `Excel解析失敗: ${msg}` };
    return NextResponse.json(res, { status: 500 });
  }
}
