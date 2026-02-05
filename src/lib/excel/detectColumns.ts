// lib/excel/detectColumns.ts
function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

function normalizeText(s: string): string {
  return s.replace(/[－―ー−]/g, "-").replace(/\s+/g, " ").trim();
}

function normalizeUnit(uRaw: string): string {
  const u = normalizeText(uRaw).replace(/\s+/g, "").trim();

  if (u === "ｍ" || u === "M" || u === "m") return "m";
  if (u === "㎡" || u === "m2" || u === "m^2" || u === "m²") return "㎡";
  if (u === "ｋｇ" || u === "KG" || u === "Kg" || u === "kg") return "kg";
  if (u === "Ｌ" || u === "L" || u === "l") return "L";

  return u;
}

const UNIT_SET = new Set<string>([
  "m",
  "㎡",
  "m2",
  "m²",
  "式",
  "個",
  "本",
  "枚",
  "袋",
  "缶",
  "kg",
  "L",
  "箇所",
  "ヶ所",
  "台",
  "人",
  "人工",
  "日",
  "セット",
]);

function looksLikeUnit(sRaw: string): boolean {
  const s = normalizeUnit(sRaw);
  if (!s) return false;
  if (UNIT_SET.has(s)) return true;
  if (s === "M") return true;
  return false;
}

function isHeaderLike(s: string): boolean {
  const t = normalizeText(s);
  if (!t) return false;
  const keys = ["数量", "単位", "金額", "摘要", "品名", "名称", "仕様", "規格"];
  return keys.some((k) => t.includes(k));
}

function detectHeaderRowIndex(rows: unknown[][]): number | null {
  const max = Math.min(rows.length, 40);
  for (let i = 0; i < max; i++) {
    const r = rows[i];
    if (!Array.isArray(r)) continue;
    const nonEmpty = r.filter((c) => normalizeText(toStr(c)) !== "");
    if (nonEmpty.length < 3) continue;

    const hits = nonEmpty.filter((c) => isHeaderLike(toStr(c))).length;
    if (hits >= 2) return i;
  }
  return null;
}

function detectColsByHeader(row: unknown[]): {
  item: number | null;
  desc: number | null;
  qty: number | null;
  unit: number | null;
  amount: number | null;
} {
  const map = {
    item: null as number | null,
    desc: null as number | null,
    qty: null as number | null,
    unit: null as number | null,
    amount: null as number | null,
  };

  for (let c = 0; c < row.length; c++) {
    const t = normalizeText(toStr(row[c]));
    if (!t) continue;

    if (map.qty == null && (t.includes("数量") || t.includes("数"))) map.qty = c;
    if (map.unit == null && t.includes("単位")) map.unit = c;

    if (
      map.amount == null &&
      (t.includes("金額") ||
        t.includes("金") ||
        t.includes("単価") ||
        t.includes("価格"))
    ) {
      map.amount = c;
    }

    if (
      map.item == null &&
      (t.includes("品名") ||
        t.includes("名称") ||
        t.includes("工種") ||
        t.includes("項目"))
    ) {
      map.item = c;
    }

    if (
      map.desc == null &&
      (t.includes("摘要") ||
        t.includes("仕様") ||
        t.includes("規格") ||
        t.includes("内容"))
    ) {
      map.desc = c;
    }
  }

  return map;
}

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

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function median(nums: number[]): number | null {
  const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
  if (a.length === 0) return null;
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 1) return a[mid];
  return (a[mid - 1] + a[mid]) / 2;
}

function buildColStats(rows: unknown[][], maxCols: number): ColStats[] {
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
      if (!Array.isArray(r)) continue;

      const v = r[c];
      const s = normalizeText(toStr(v));
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

        if (looksLikeUnit(s)) unitLike++;
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

function pickBest(
  stats: ColStats[],
  scoreFn: (s: ColStats) => number
): number | null {
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

function detectColsHeuristic(rows: unknown[][]): {
  item: number;
  desc: number;
  qty: number;
  unit: number;
  amount: number | null;
} {
  let maxCols = 0;
  for (const r of rows.slice(0, 200)) {
    if (Array.isArray(r)) maxCols = Math.max(maxCols, r.length);
  }
  if (maxCols <= 0) {
    return { item: 0, desc: 0, qty: 0, unit: 0, amount: null };
  }

  const stats = buildColStats(rows, maxCols);

  const unitCol = pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const unitRate = s.unitLike / Math.max(1, s.nonEmpty);
    const shortText = s.avgTextLen > 0 && s.avgTextLen <= 6 ? 1 : 0;
    return unitRate * 10 + shortText * 2 + s.rightBias * 0.5;
  });

  const qtyCol = pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const numRate = s.numeric / Math.max(1, s.nonEmpty);
    if (numRate < 0.6) return -1;
    const med = s.medianNum ?? 0;
    const smallness = med <= 0 ? 0 : med <= 500 ? 2 : med <= 2000 ? 0.5 : -1;
    return numRate * 5 + smallness + s.rightBias * 0.3;
  });

  const amountCol = pickBest(stats, (s) => {
    if (s.nonEmpty < 10) return -1;
    const numRate = s.numeric / Math.max(1, s.nonEmpty);
    if (numRate < 0.6) return -1;
    const med = s.medianNum ?? 0;
    const largeness = med >= 5000 ? 2 : med >= 1000 ? 1 : -1;
    return numRate * 3 + largeness + s.rightBias * 1.5;
  });

  const textCols = stats.filter((s) => s.text / Math.max(1, s.nonEmpty) >= 0.5);

  const itemCol = pickBest(textCols, (s) => {
    if (s.nonEmpty < 10) return -1;
    const lenScore = s.avgTextLen > 0 && s.avgTextLen <= 18 ? 2 : 0.5;
    const uniqScore = s.uniqText >= 10 ? 1 : 0;
    return lenScore + uniqScore + s.rightBias * 0.2;
  });

  const descCol = pickBest(textCols, (s) => {
    if (s.nonEmpty < 10) return -1;
    const lenScore = s.avgTextLen >= 18 ? 2 : 0.2;
    return lenScore + s.rightBias * 0.2;
  });

  const safeUnit = unitCol ?? Math.min(3, maxCols - 1);
  const safeQty = qtyCol ?? Math.min(2, maxCols - 1);
  const safeItem = itemCol ?? 0;
  const safeDesc = descCol ?? Math.min(1, maxCols - 1);
  const safeAmount = amountCol ?? null;

  return {
    item: safeItem,
    desc: safeDesc,
    qty: safeQty,
    unit: safeUnit,
    amount: safeAmount,
  };
}

export type DetectedCols = {
  item: number;
  desc: number;
  qty: number;
  unit: number;
  amount: number | null;
  headerRowIndex: number | null;
};

export function detectColumns(rowsAll: unknown[][]): DetectedCols {
  const headerRowIndex = detectHeaderRowIndex(rowsAll);

  if (headerRowIndex != null) {
    const headerRow = rowsAll[headerRowIndex];
    if (Array.isArray(headerRow)) {
      const byHeader = detectColsByHeader(headerRow);

      const needHeuristic =
        byHeader.qty == null ||
        byHeader.unit == null ||
        byHeader.item == null ||
        byHeader.desc == null;

      if (!needHeuristic) {
        return {
          item: byHeader.item as number,
          desc: byHeader.desc as number,
          qty: byHeader.qty as number,
          unit: byHeader.unit as number,
          amount: byHeader.amount ?? null,
          headerRowIndex,
        };
      }

      const heuristic = detectColsHeuristic(rowsAll.slice(headerRowIndex + 1));
      return {
        item: byHeader.item ?? heuristic.item,
        desc: byHeader.desc ?? heuristic.desc,
        qty: byHeader.qty ?? heuristic.qty,
        unit: byHeader.unit ?? heuristic.unit,
        amount: byHeader.amount ?? heuristic.amount,
        headerRowIndex,
      };
    }
  }

  const heuristic = detectColsHeuristic(rowsAll);
  return { ...heuristic, headerRowIndex: null };
}
