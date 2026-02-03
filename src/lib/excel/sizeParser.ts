// src/lib/excel/sizeParser.ts
export type SizeParseResult = {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;

  // デバッグ用（必要なら）
  matched?: {
    h?: string;
    w?: string;
    l?: string;
  };
};

/** route.ts 側の normalizeText を使い回したいので、引数で受け取る */
type NormalizeText = (s: string) => string;

export function parseSizeFromText(
  rawText: string,
  normalizeText: NormalizeText,
): SizeParseResult {
  const t = normalizeText(rawText);

  // 区切りの揺れ: "-", "－", "ー", "=", ":", 空白など
  const SEP = String.raw`(?:\s*(?:[-‐-–—−ー－=:：])\s*|\s+)`;
  const NUM = String.raw`(\d+(?:\.\d+)?)`;
  const UNIT = String.raw`(?:\s*(mm|㎜|m))?`;

  const reW = new RegExp(String.raw`\bW${SEP}${NUM}${UNIT}`, "i");
  const reH = new RegExp(String.raw`\bH${SEP}${NUM}${UNIT}`, "i");
  const reL = new RegExp(String.raw`\bL${SEP}${NUM}${UNIT}`, "i");

  const out: SizeParseResult = {};

  const mw = t.match(reW);
  if (mw) {
    out.wideMm = toMmSmart(mw[1], mw[2]);
    out.matched = { ...(out.matched ?? {}), w: mw[0] };
  }

  const mh = t.match(reH);
  if (mh) {
    out.heightMm = toMmSmart(mh[1], mh[2]);
    out.matched = { ...(out.matched ?? {}), h: mh[0] };
  }

  const ml = t.match(reL);
  if (ml) {
    out.lengthMm = toMmSmart(ml[1], ml[2]);
    out.matched = { ...(out.matched ?? {}), l: ml[0] };
  }

  // 「mmは書かれない」前提のデフォルト（今のあなたの挙動維持）
  if (out.heightMm == null) {
    if (t.includes("溝")) out.heightMm = 300;
    if (t.includes("巾木")) out.heightMm = 200;
  }

  // 重ね 50（任意：いまのロジックがあるならここへ統合してOK）
  const kasane = t.match(/重ね\s*[-=＝:：]?\s*(\d{2,4})/);
  if (kasane) out.overlapMm = Number(kasane[1]);

  return out;
}

/**
 * 単位なしは基本 mm。
 * ただし単位なし小数は mっぽいので mm化（例: 1.2 -> 1200）
 */
function toMmSmart(numRaw: string, unitRaw?: string): number {
  const n = Number(String(numRaw).replace(/,/g, "").trim());
  const u = (unitRaw ?? "").toLowerCase().trim();

  if (u === "m") return Math.round(n * 1000);
  if (u === "mm" || u === "㎜") return Math.round(n);

  const isDecimal = String(numRaw).includes(".");
  if (isDecimal && n > 0 && n <= 20) return Math.round(n * 1000);

  return Math.round(n);
}
