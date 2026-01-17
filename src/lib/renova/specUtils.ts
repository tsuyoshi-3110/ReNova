// src/lib/renova/specUtils.ts
import type { SpecItem } from "@/types/pdf";

/** 仕様番号なしのラベル（画面表示用） */
export const NO_SPEC_LABEL = "（仕様番号なし）";

/** 仕様番号サマリ1行分の型 */
export type SpecCodeSummaryRow = {
  code: string;
  mainText: string;
  lineCount: number;
};

/**
 * API から返ってくる可能性がある拡張フィールドを乗せた型
 * - estimated_area_m2: LLM が計算した㎡
 * - specCode / spec_code: LLM 側で付与された仕様番号
 * - remark / note / 備考 / memo: 備考系のテキスト
 */
type SpecItemWithMeta = SpecItem & {
  estimated_area_m2?: number | null;
  specCode?: string | null;
  spec_code?: string | null;
  remark?: string | null;
  note?: string | null;
  備考?: string | null;
  memo?: string | null;
};

// ハイフン系記号を半角ハイフンに統一
const HYPHEN_VARIANTS = /[-‐-‒–—−ー－―]/g;

function normalizeHyphen(input: string): string {
  return input.replace(HYPHEN_VARIANTS, "-");
}

// 全角数字 → 半角数字
function normalizeDigits(input: string): string {
  return input.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 1行あたりの「推定㎡」を出すヘルパー
 * - まずは AI が返した estimated_area_m2 を優先的に使用
 * - 無い場合だけ、unit と name から簡易推定
 */
export function estimateAreaFromSpecItem(item: SpecItem): number | null {
  const ext: SpecItemWithMeta = item as SpecItemWithMeta;

  // 0. AI が計算してくれた㎡があれば、それを最優先で使う
  if (
    typeof ext.estimated_area_m2 === "number" &&
    Number.isFinite(ext.estimated_area_m2) &&
    ext.estimated_area_m2 > 0
  ) {
    return ext.estimated_area_m2;
  }

  const unit = (item.unit ?? "").replace(/[ 　]/g, ""); // 全角・半角スペース除去

  // ① すでに㎡の場合はそのまま数量を使う
  if (unit === "㎡" || unit === "m2" || unit === "m²") {
    return item.quantity;
  }

  // ② 単位が m の場合は、name 内のサイズ情報から幅[m]を推定して㎡換算
  if (unit === "m" || unit === "ｍ") {
    const text = item.name ?? "";

    // パターンA: 「300mm」「300㎜」のような書き方
    const widthMmMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(mm|㎜)/i);

    // パターンB: 「0.6m」「0.5ｍ」のような書き方
    const widthMMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(m|ｍ)/i);

    let widthM: number | null = null;

    if (widthMmMatch) {
      widthM = parseFloat(widthMmMatch[1]) / 1000; // mm → m
    } else if (widthMMatch) {
      widthM = parseFloat(widthMMatch[1]); // すでに m 単位
    }

    if (widthM !== null && widthM > 0) {
      // 「長さ[m]（= quantity）× 幅[m] = 面積[m²]」
      return item.quantity * widthM;
    }
  }

  // ③ それ以外は今は対象外
  return null;
}

/**
 * 1行の SpecItem から、できるだけ安定して「仕様番号」を推定する。
 * - specCode / spec_code があればそれを最優先
 * - 無い場合は section / name / 備考などから「RP-1」「床-2」「防水-3」などを拾う
 */
export function guessSpecCode(item: SpecItem): string | null {
  const ext: SpecItemWithMeta = item as SpecItemWithMeta;

  // 1) API が specCode / spec_code を返していればそれを優先
  const fromApiRaw =
    (typeof ext.specCode === "string" && ext.specCode) ||
    (typeof ext.spec_code === "string" && ext.spec_code) ||
    "";

  const fromApiClean = normalizeDigits(normalizeHyphen(fromApiRaw))
    .replace(/\s+/g, "")
    .trim();

  if (fromApiClean) {
    return fromApiClean;
  }

  // 2) section / name / 備考系を全部つなげてからパターンマッチ
  const parts: string[] = [];

  if (typeof item.section === "string") parts.push(item.section);
  if (typeof item.name === "string") parts.push(item.name);
  if (typeof ext.remark === "string") parts.push(ext.remark);
  if (typeof ext.note === "string") parts.push(ext.note);
  if (typeof ext["備考"] === "string") parts.push(ext["備考"]);
  if (typeof ext.memo === "string") parts.push(ext.memo);

  if (parts.length === 0) return null;

  const text = normalizeDigits(normalizeHyphen(parts.join(" ")));

  // 例: 「防水-1」「防水１」「防水(1)」「RP-1」「RP 1」などを狙う
  const m = text.match(
    /([A-Za-z]{1,4}|[\u4E00-\u9FFF々]{1,4})\s*(?:-|\(|（)?\s*(\d{1,3})/
  );

  if (!m) {
    return null;
  }

  const head = m[1].toUpperCase();
  const num = m[2].replace(/^0+/, "") || "0";

  return `${head}-${num}`;
}

/**
 * 仕様番号ごとの推定数量サマリ（㎡＋その他の単位）を作成
 */
export function buildSpecCodeSummary(
  items: SpecItem[] | null
): SpecCodeSummaryRow[] {
  if (!items || items.length === 0) return [];

  type UnitAgg = { qty: number; lines: number };
  type Acc = {
    areaM2: number;
    areaLines: number;
    units: Record<string, UnitAgg>;
  };

  const map = new Map<string, Acc>();

  for (const it of items) {
    const code = guessSpecCode(it) ?? NO_SPEC_LABEL;

    const existing = map.get(code);
    const acc: Acc =
      existing ?? { areaM2: 0, areaLines: 0, units: {} };

    const area = estimateAreaFromSpecItem(it);

    if (area !== null && Number.isFinite(area) && area > 0) {
      acc.areaM2 += area;
      acc.areaLines += 1;
    } else {
      const rawUnit = (it.unit ?? "").toString().trim() || "式";
      const existingUnit = acc.units[rawUnit];
      const u: UnitAgg = existingUnit ?? { qty: 0, lines: 0 };
      u.qty += it.quantity;
      u.lines += 1;
      acc.units[rawUnit] = u;
    }

    map.set(code, acc);
  }

  const rows: SpecCodeSummaryRow[] = [];

  for (const [code, acc] of map.entries()) {
    const unitEntries = Object.entries(acc.units);

    const totalLines =
      acc.areaLines +
      unitEntries.reduce<number>(
        (sum, [, v]) => sum + v.lines,
        0
      );

    const parts: string[] = [];

    if (acc.areaM2 > 0) {
      const val = Math.round(acc.areaM2 * 100) / 100;
      parts.push(`${val.toFixed(2)} ㎡`);
    }

    if (unitEntries.length > 0) {
      const ordered = unitEntries.sort(([uA], [uB]) => {
        const order = ["m", "㎡", "ヶ所", "式"];
        const ia = order.indexOf(uA);
        const ib = order.indexOf(uB);
        if (ia === -1 && ib === -1) {
          return uA.localeCompare(uB, "ja");
        }
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      const unitTexts = ordered.map(([u, v]) => {
        const q = v.qty;
        if (u === "m") {
          const val = Math.round(q * 10) / 10;
          return `${val}m`;
        }
        if (u === "㎡") {
          const val = Math.round(q * 100) / 100;
          return `${val.toFixed(2)}㎡`;
        }
        return `${q}${u}`;
      });

      parts.push(unitTexts.join(" / "));
    }

    const mainText = parts.length > 0 ? parts.join(" / ") : "-";

    rows.push({
      code,
      mainText,
      lineCount: totalLines,
    });
  }

  // 並び順：仕様番号なし → それ以外を日本語ロケール順
  rows.sort((a, b) => {
    if (a.code === NO_SPEC_LABEL && b.code !== NO_SPEC_LABEL) return -1;
    if (b.code === NO_SPEC_LABEL && a.code !== NO_SPEC_LABEL) return 1;
    return a.code.localeCompare(b.code, "ja");
  });

  return rows;
}
