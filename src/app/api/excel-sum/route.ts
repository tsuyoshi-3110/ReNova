// app/api/excel-sum/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

type ExcelSumResponse = {
  ok: true;
  query: string;
  matchedCount: number;
  sumsByUnit: Record<string, number>;
  sumM2: number;
  detectedCols: {
    item: number;
    desc: number;
    qty: number;
    unit: number;
    amount: number | null;
    headerRowIndex: number | null;
    usedManualCols: boolean;
    sizeText: number;
  };
  preview: Array<{
    rowIndex: number; // ✅ Excelの実行番号（1始まり）
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
    sizeText?: string; // ✅ サイズ抽出に使った生テキスト（確認用）
  }>;
};

type ExcelSumError = { ok: false; error: string };

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

// ✅ 追加：全角英数 → 半角（仕様番号の一致ズレ対策）
function toHalfWidthAscii(s: string): string {
  // 全角英数記号：FF01-FF5E -> 21-7E
  return s.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

// ✅ 追加：検索・比較用の正規化（半角ｶﾅ→全角カナ、濁点結合など）
function normalizeNFKC(s: string): string {
  return s.normalize("NFKC");
}

function normalizeText(s: string): string {
  // ✅ NFKC → 半角カナ問題を解消、その後に全角英数→半角
  const t = toHalfWidthAscii(normalizeNFKC(s));
  return t
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// ✅ 検索用：空白を完全除去して一致ズレを潰す（下地 補修 / 下地補修 など）
function normalizeForSearch(s: string): string {
  // ✅ NFKC を必ず通す：ｹﾚﾝ→ケレン、ﾊﾞ→バ など
  const t = toHalfWidthAscii(normalizeNFKC(s));
  return t
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
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

/* -------------------- サイズパース（元のまま） -------------------- */

function pickHeightMmFromText(text: string): number | null {
  {
    const m = text.match(/H\s*[=＝:：≈≒~]?\s*(\d{2,4})/i);
    if (m) return Number(m[1]);
  }
  {
    const m = text.match(/(?:糸尺|糸)\s*[=＝:：≈≒~]?\s*(\d{2,4})/);
    if (m) return Number(m[1]);
  }
  return null;
}

function pickOverlapMm(text: string): number {
  const m = text.match(/重ね\s*[=＝:：≈≒~]?\s*(\d{2,4})/);
  if (!m) return 0;
  return Number(m[1]);
}

function pickDefaultHeightMm(text: string): number | null {
  if (text.includes("溝")) return 300;
  if (text.includes("巾木")) return 200;
  return null;
}

function pickWideMm(text: string): number | null {
  const m = text.match(/W\s*[=＝:：≈≒~]?\s*(\d{2,5})/i);
  return m ? Number(m[1]) : null;
}

function pickLengthMm(text: string): number | null {
  const m1 = text.match(/L\s*[=＝:：≈≒~]?\s*(\d{2,6})/i);
  if (m1) return Number(m1[1]);

  const m2 = text.match(/L\s*[=＝:：≈≒~]?\s*(\d+(?:\.\d+)?)\s*m\b/i);
  if (m2) return Math.round(Number(m2[1]) * 1000);

  return null;
}

function parseSizeFromRowText(rowText: string): {
  heightMm?: number;
  overlapMm?: number;
  wideMm?: number;
  lengthMm?: number;
} {
  const baseH = pickHeightMmFromText(rowText) ?? pickDefaultHeightMm(rowText);
  const kasane = pickOverlapMm(rowText);
  const w = pickWideMm(rowText);
  const l = pickLengthMm(rowText);

  const out: {
    heightMm?: number;
    overlapMm?: number;
    wideMm?: number;
    lengthMm?: number;
  } = {};

  if (baseH != null) out.heightMm = baseH;
  if (kasane > 0) out.overlapMm = kasane;
  if (w != null) out.wideMm = w;
  if (l != null) out.lengthMm = l;

  return out;
}

function calcM2ForUnitM(qtyM: number, rowText: string): number | null {
  const baseH = pickHeightMmFromText(rowText) ?? pickDefaultHeightMm(rowText);
  const kasane = pickOverlapMm(rowText);

  if (baseH != null) {
    const heightM = (baseH + kasane) / 1000;
    return qtyM * heightM;
  }

  const w = pickWideMm(rowText);
  if (w != null) {
    const wideM = w / 1000;
    return qtyM * wideM;
  }

  return null;
}

/* -------------------- 列検出（元のまま） -------------------- */

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

    if (map.qty == null && (t.includes("数量") || t.includes("数")))
      map.qty = c;
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
  scoreFn: (s: ColStats) => number,
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

function detectColumns(rowsAll: unknown[][]): {
  item: number;
  desc: number;
  qty: number;
  unit: number;
  amount: number | null;
  headerRowIndex: number | null;
} {
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

/* -------------------- ✅ 手動列指定（1始まり） -------------------- */

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

/* -------------------- POST -------------------- */

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
    // ✅ UI から選択されたシート名（必須UIでもAPI側で使わないと常に先頭シートになる）
    const requestedSheetNameRaw = normalizeText(toStr(fd.get("sheetName")));

    const hideZeroAmount =
      normalizeText(toStr(fd.get("hideZeroAmount"))).toLowerCase() === "true" ||
      normalizeText(toStr(fd.get("hideNoPrice"))).trim() === "1";

    const useManualCols =
      normalizeText(toStr(fd.get("useManualCols"))).trim() === "1";

    const previewAll =
      normalizeText(toStr(fd.get("previewAll"))).trim() === "1";

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });

    // ✅ シート名のゆらぎ吸収：
    // - 全角/半角
    // - 空白
    // - ハイフン類（- / － / ― / − 等）
    // - 長音（ー）
    // 例: "南棟ル-フ" -> "南棟ルーフ" に寄せて一致させる
    function normalizeSheetNameForMatch(s: string): string {
      const t = toHalfWidthAscii(normalizeText(s));
      return (
        t
          .replace(/\s+/g, "")
          // ハイフン/ダッシュ/長音を全部同一視（比較用に除去）
          .replace(
            /[\-\uFF0D\u2212\u2010\u2011\u2012\u2013\u2014\u2015\u2500\u2501\u30FC\u2015\u2014\u2013\u2012\u2011\u2010\u2015\u2014\u2013\u2212\uFF0D\u2015\u2014\u2013\u2012\u2011\u2010\u30FC]/g,
            "",
          )
          .toLowerCase()
      );
    }

    function findBestSheetName(
      sheetNames: string[],
      requested: string,
    ):
      | { ok: true; name: string; matchedBy: "exact" | "normalized" }
      | { ok: false; reason: "not_found" | "ambiguous"; candidates: string[] } {
      const req = normalizeText(requested);
      if (!req) {
        return { ok: true, name: sheetNames[0] || "", matchedBy: "exact" };
      }

      // 1) 完全一致を最優先
      if (sheetNames.includes(req)) {
        return { ok: true, name: req, matchedBy: "exact" };
      }

      // 2) 正規化一致（例: ル-フ と ルーフ を同一視）
      const reqN = normalizeSheetNameForMatch(req);
      const hits = sheetNames.filter(
        (n) => normalizeSheetNameForMatch(n) === reqN,
      );
      if (hits.length === 1) {
        return { ok: true, name: hits[0], matchedBy: "normalized" };
      }
      if (hits.length >= 2) {
        return { ok: false, reason: "ambiguous", candidates: hits };
      }

      return { ok: false, reason: "not_found", candidates: sheetNames };
    }

    const sheetPick = findBestSheetName(wb.SheetNames, requestedSheetNameRaw);

    if (sheetPick.ok === false) {
      const candidates = sheetPick.candidates;
      const reason = sheetPick.reason;

      const res: ExcelSumError = {
        ok: false,
        error:
          reason === "ambiguous"
            ? `指定シートが曖昧です: ${requestedSheetNameRaw}（一致候補: ${candidates.join(", ")}）`
            : `指定シートが見つかりません: ${requestedSheetNameRaw}（候補: ${candidates.join(", ")}）`,
      };
      return NextResponse.json(res, { status: 400 });
    }

    const sheetName = sheetPick.name;

    if (!sheetName) {
      const res: ExcelSumError = { ok: false, error: "シートが見つかりません" };
      return NextResponse.json(res, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[];

    const rows2d = rows.filter((r) => Array.isArray(r)) as unknown[][];

    let maxCols = 0;
    for (const r of rows2d.slice(0, 200)) {
      if (Array.isArray(r)) maxCols = Math.max(maxCols, r.length);
    }

    const detected = detectColumns(rows2d);

    // 0-based
    let itemCol = detected.item;
    let descCol = detected.desc;
    let qtyCol = detected.qty;
    let unitCol = detected.unit;
    let amountCol = detected.amount;

    let headerRowIndex: number | null = detected.headerRowIndex;

    // ✅ 新規：サイズ抽出列（0-based）
    let sizeTextCol = detected.desc;

    if (useManualCols) {
      // ✅ headerRowIndex は「任意」にする（要件）
      const hr = read1BasedRow(fd, "headerRowIndex");
      const mi = read1BasedCol(fd, "itemCol");
      const md = read1BasedCol(fd, "descCol");
      const mq = read1BasedCol(fd, "qtyCol");
      const mu = read1BasedCol(fd, "unitCol");
      const ma = read1BasedCol(fd, "amountCol"); // optional
      const ms = read1BasedCol(fd, "sizeCol"); // ✅ 必須

      // ✅ 必須から hr を外す（ここが要件の核心）
      if (mi == null || md == null || mq == null || mu == null || ms == null) {
        const res: ExcelSumError = {
          ok: false,
          error:
            "列指定ONの場合、itemCol/descCol/qtyCol/unitCol/sizeCol は必須です（左から数えて1,2,3...）",
        };
        return NextResponse.json(res, { status: 400 });
      }

      // ✅ 指定があればそれを使う。無ければ「検出結果 or null」をそのまま。
      if (hr != null) headerRowIndex = hr;

      itemCol = clampColIndex(mi, maxCols);
      descCol = clampColIndex(md, maxCols);
      qtyCol = clampColIndex(mq, maxCols);
      unitCol = clampColIndex(mu, maxCols);
      amountCol = ma == null ? null : clampColIndex(ma, maxCols);

      sizeTextCol = clampColIndex(ms, maxCols);

      if (hideZeroAmount && amountCol == null) {
        const res: ExcelSumError = {
          ok: false,
          error:
            "「金なしは非表示」をONにする場合、amountCol（金額列）の指定が必要です",
        };
        return NextResponse.json(res, { status: 400 });
      }
    }

    const sumsByUnit: Record<string, number> = {};
    const preview: ExcelSumResponse["preview"] = [];
    let matchedCount = 0;
    let sumM2 = 0;

    for (let i = 0; i < rows2d.length; i++) {
      if (headerRowIndex != null && i <= headerRowIndex) continue;

      const r = rows2d[i];

      // ✅ 検索ヒット判定は「行全体結合」（元のまま）
      const joined = rowToJoinedText(r);
      if (!includesAllTokens(joined, tokens)) continue;

      // ✅ 数量が 0 / 空 の行は除外（一覧にも集計にも出さない）
      const qty = toNum((r as unknown[])[qtyCol]);
      if (qty == null || qty === 0) continue;

      const amount =
        amountCol != null ? toNum((r as unknown[])[amountCol]) : null;

      if (hideZeroAmount) {
        if (amount == null || amount === 0) continue;
      }

      matchedCount++;

      const unitRaw = toStr((r as unknown[])[unitCol]);
      const unit = normalizeUnit(unitRaw);

      if (qty != null && unit) {
        sumsByUnit[unit] = (sumsByUnit[unit] ?? 0) + qty;
      }

      // ✅ サイズ抽出は sizeCol だけを見る（元の方針維持）
      const sizeTextRaw = normalizeText(toStr((r as unknown[])[sizeTextCol]));
      const size = parseSizeFromRowText(sizeTextRaw);

      let calcM2: number | undefined = undefined;
      if (qty != null && unit === "m") {
        const m2 = calcM2ForUnitM(qty, sizeTextRaw);
        if (m2 != null && Number.isFinite(m2)) {
          sumM2 += m2;
          calcM2 = m2;
        }
      }

      const rowIndex1Based = i + 1;

      if (previewAll || preview.length < 30) {
        preview.push({
          rowIndex: rowIndex1Based,
          item: normalizeText(toStr((r as unknown[])[itemCol])) || undefined,
          desc: normalizeText(toStr((r as unknown[])[descCol])) || undefined,
          qty: qty ?? undefined,
          unit: unit || undefined,
          amount: amount ?? undefined,
          calcM2,
          heightMm: size.heightMm,
          overlapMm: size.overlapMm,
          wideMm: size.wideMm,
          lengthMm: size.lengthMm,
          sizeText: sizeTextRaw || undefined,
        });
      }
    }

    const res: ExcelSumResponse = {
      ok: true,
      query,
      matchedCount,
      sumsByUnit,
      sumM2,
      detectedCols: {
        item: itemCol,
        desc: descCol,
        qty: qtyCol,
        unit: unitCol,
        amount: amountCol,
        headerRowIndex,
        usedManualCols: useManualCols,
        sizeText: sizeTextCol,
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
