// src/lib/excel/columnDetect.ts
export type DetectedCols = {
  item: number;
  desc: number;
  qty: number;
  unit: number;
  amount: number | null;
  headerRowIndex: number | null;
  sizeText: number; // ✅ サイズ抽出に使う列
};

type ColStats = {
  col: number;
  nonEmpty: number;
  numeric: number;
  text: number;
  unitLike: number;
  avgTextLen: number;
  uniqText: number;
  medianNum: number | null;
  rightBias: number;
};

function median(nums: number[]): number | null {
  const a = nums.filter(Number.isFinite).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 === 1 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

// ヘッダー判定は「空白除去 & 表記揺れ」対応（でもオプショナル）
function normalizeHeaderKey(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\s+/g, "")
    .replace(/[－―ー−]/g, "-")
    .toLowerCase();
}

function looksLikeUnitCell(sRaw: string): boolean {
  const s = normalizeHeaderKey(sRaw);
  if (!s) return false;
  const set = new Set([
    "m", "㎡", "m2", "m²", "式", "個", "本", "枚", "袋", "缶",
    "kg", "l", "箇所", "ヶ所", "台", "人", "人工", "日", "セット",
  ]);
  if (set.has(s)) return true;
  if (s === "ｍ") return true;
  return false;
}

function buildColStats(
  rows: unknown[][],
  maxCols: number,
  toStr: (v: unknown) => string,
  toNum: (v: unknown) => number | null,
): ColStats[] {
  const sampleLimit = Math.min(rows.length, 300);
  const out: ColStats[] = [];

  for (let c = 0; c < maxCols; c++) {
    let nonEmpty = 0;
    let numeric = 0;
    let text = 0;
    let unitLike = 0;
    let textLenSum = 0;

    const nums: number[] = [];
    const texts: string[] = [];

    for (let i = 0; i < sampleLimit; i++) {
      const r = rows[i];
      const v = r?.[c];
      const s = toStr(v).trim();
      if (!s) continue;

      nonEmpty++;

      const n = toNum(v);
      if (n != null) {
        numeric++;
        nums.push(n);
      } else {
        text++;
        texts.push(s);
        textLenSum += s.length;
        if (looksLikeUnitCell(s)) unitLike++;
      }
    }

    const uniqText = new Set(texts).size;
    const avgTextLen = text > 0 ? textLenSum / text : 0;
    const medianNum = median(nums);

    out.push({
      col: c,
      nonEmpty,
      numeric,
      text,
      unitLike,
      avgTextLen,
      uniqText,
      medianNum,
      rightBias: maxCols > 1 ? c / (maxCols - 1) : 0,
    });
  }
  return out;
}

function pickBest(stats: ColStats[], scoreFn: (s: ColStats) => number): number | null {
  let bestCol: number | null = null;
  let bestScore = -Infinity;
  for (const s of stats) {
    const sc = scoreFn(s);
    if (sc > bestScore) {
      bestScore = sc;
      bestCol = s.col;
    }
  }
  if (bestCol == null) return null;
  if (!Number.isFinite(bestScore) || bestScore <= 0) return null;
  return bestCol;
}

/**
 * ✅ サイズ列っぽさスコア
 * - W-200 / H=300 / L:1200 / Ｗ２００ など
 * - □200 / ×200
 * - 「巾木」「立上り」「溝」など
 * ※ mm は書かれない想定
 */
function scoreSizeColumn(
  rows: unknown[][],
  col: number,
  toStr: (v: unknown) => string,
): number {
  const limit = Math.min(rows.length, 400);
  let hit = 0;
  let nonEmpty = 0;

  const re = /(?:\b[HWL]\s*[-=＝:：]?\s*\d{2,6}\b|[□×]\s*\d{2,5}|巾木|立上り|立上|溝|重ね)/i;

  for (let i = 0; i < limit; i++) {
    const s = toStr(rows[i]?.[col]).normalize("NFKC");
    const t = s.replace(/\s+/g, "");
    if (!t) continue;
    nonEmpty++;
    if (re.test(t)) hit++;
  }

  if (nonEmpty === 0) return 0;
  // ヒット率を強めに見る
  const rate = hit / nonEmpty;
  return rate * 100 + hit; // rate優先 + 実数も加点
}

function detectHeaderRowIndexLoose(
  rows: unknown[][],
  toStr: (v: unknown) => string,
): number | null {
  const max = Math.min(rows.length, 40);
  const keys = ["数量", "単位", "金額", "摘要", "品名", "名称", "仕様", "規格", "内容", "備考"];

  for (let i = 0; i < max; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;

    const cells = r
      .map((c) => normalizeHeaderKey(toStr(c)))
      .filter((t) => t.length > 0);

    if (cells.length < 3) continue;

    const hits = cells.filter((t) => keys.some((k) => t.includes(normalizeHeaderKey(k)))).length;
    if (hits >= 2) return i;
  }
  return null;
}

function detectColsByHeaderLoose(row: unknown[], toStr: (v: unknown) => string) {
  const map = {
    item: null as number | null,
    desc: null as number | null,
    qty: null as number | null,
    unit: null as number | null,
    amount: null as number | null,
  };

  const ITEM_KEYS = ["品名", "名称", "工種", "項目"];
  const DESC_KEYS = ["摘要", "内容", "仕様", "規格", "備考"];
  const QTY_KEYS = ["数量", "数"];
  const UNIT_KEYS = ["単位"];
  const AMT_KEYS = ["金額", "単価", "価格", "金"];

  for (let c = 0; c < row.length; c++) {
    const t = normalizeHeaderKey(toStr(row[c]));
    if (!t) continue;

    if (map.qty == null && QTY_KEYS.some((k) => t.includes(normalizeHeaderKey(k)))) map.qty = c;
    if (map.unit == null && UNIT_KEYS.some((k) => t.includes(normalizeHeaderKey(k)))) map.unit = c;
    if (map.amount == null && AMT_KEYS.some((k) => t.includes(normalizeHeaderKey(k)))) map.amount = c;
    if (map.item == null && ITEM_KEYS.some((k) => t.includes(normalizeHeaderKey(k)))) map.item = c;
    if (map.desc == null && DESC_KEYS.some((k) => t.includes(normalizeHeaderKey(k)))) map.desc = c;
  }

  return map;
}

export function detectColumnsSmart(
  rowsAll: unknown[][],
  toStr: (v: unknown) => string,
  toNum: (v: unknown) => number | null,
): DetectedCols {
  // maxCols
  let maxCols = 0;
  for (const r of rowsAll.slice(0, 200)) {
    if (Array.isArray(r)) maxCols = Math.max(maxCols, r.length);
  }
  if (maxCols <= 0) {
    return { item: 0, desc: 0, qty: 0, unit: 0, amount: null, headerRowIndex: null, sizeText: 0 };
  }

  // 1) ヘッダーは “見つかったら補助”
  const headerRowIndex = detectHeaderRowIndexLoose(rowsAll, toStr);
  let headerCols = {
    item: null as number | null,
    desc: null as number | null,
    qty: null as number | null,
    unit: null as number | null,
    amount: null as number | null,
  };

  if (headerRowIndex != null && Array.isArray(rowsAll[headerRowIndex])) {
    headerCols = detectColsByHeaderLoose(rowsAll[headerRowIndex], toStr);
  }

  // 2) 中身で推定（主）
  const bodyRows = headerRowIndex != null ? rowsAll.slice(headerRowIndex + 1) : rowsAll;
  const stats = buildColStats(bodyRows, maxCols, toStr, toNum);

  const unitCol = headerCols.unit ?? pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const unitRate = s.unitLike / Math.max(1, s.nonEmpty);
    const shortText = s.avgTextLen > 0 && s.avgTextLen <= 6 ? 1 : 0;
    return unitRate * 10 + shortText * 2 + s.rightBias * 0.5;
  }) ?? Math.min(3, maxCols - 1);

  const qtyCol = headerCols.qty ?? pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const numRate = s.numeric / Math.max(1, s.nonEmpty);
    if (numRate < 0.6) return -1;
    const med = s.medianNum ?? 0;
    const smallness = med <= 0 ? 0 : med <= 500 ? 2 : med <= 2000 ? 0.5 : -1;
    return numRate * 5 + smallness + s.rightBias * 0.3;
  }) ?? Math.min(2, maxCols - 1);

  const amountCol = headerCols.amount ?? pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const numRate = s.numeric / Math.max(1, s.nonEmpty);
    if (numRate < 0.6) return -1;
    const med = s.medianNum ?? 0;
    const largeness = med >= 5000 ? 2 : med >= 1000 ? 1 : -1;
    return numRate * 3 + largeness + s.rightBias * 1.5;
  }) ?? null;

  const textCols = stats.filter((s) => s.text / Math.max(1, s.nonEmpty) >= 0.5);

  const itemCol = headerCols.item ?? pickBest(textCols, (s) => {
    if (s.nonEmpty < 10) return -1;
    // item は「短め・ユニーク多め」
    const lenScore = s.avgTextLen > 0 && s.avgTextLen <= 18 ? 2 : 0.5;
    const uniqScore = s.uniqText >= 10 ? 1 : 0;
    return lenScore + uniqScore + s.rightBias * 0.2;
  }) ?? 0;

  const descCol = headerCols.desc ?? pickBest(textCols, (s) => {
    if (s.nonEmpty < 10) return -1;
    // desc は「長め」
    const lenScore = s.avgTextLen >= 18 ? 2 : 0.2;
    return lenScore + s.rightBias * 0.2;
  }) ?? Math.min(1, maxCols - 1);

  // 3) ✅ sizeText 列は「サイズパターンが一番多いテキスト列」を採用
  let bestSizeCol = descCol;
  let bestSizeScore = -1;
  for (const s of textCols) {
    const sc = scoreSizeColumn(bodyRows, s.col, toStr);
    if (sc > bestSizeScore) {
      bestSizeScore = sc;
      bestSizeCol = s.col;
    }
  }

  // sizeスコアが弱い場合は desc をそのまま
  const sizeTextCol = bestSizeScore >= 5 ? bestSizeCol : descCol;

  return {
    item: itemCol,
    desc: descCol,
    qty: qtyCol,
    unit: unitCol,
    amount: amountCol,
    headerRowIndex: headerRowIndex,
    sizeText: sizeTextCol,
  };
}
