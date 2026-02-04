import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import OpenAI from "openai";

export const runtime = "nodejs";

type DetectOk = {
  ok: true;
  sheetName: string;
  headerRowIndex: null;
  detectedCols: {
    item: number; // 1-based
    desc: number; // 1-based
    qty: number; // 1-based
    unit: number; // 1-based
    amount: number | null; // 1-based
    size: number; // 1-based（サイズ抽出元。基本はdesc）
  };
  debug: {
    sampledRows: number;
    sampledCols: number;
    notes: string[];
  };
};

type DetectNg = { ok: false; error: string };

function normCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.replace(/\s+/g, " ").trim();
  if (typeof v === "number") return String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

function toNumCell(v: string): number | null {
  const s = v
    .replace(/[,，\s]/g, "")
    .replace(/[¥￥]/g, "")
    .trim();
  if (!s) return null;
  // 数字/小数/マイナスのみ許可（カッコや文字が混ざる場合は除外）
  if (!/^-?\d+(?:\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return n;
}

/**
 * 金額列のヒューリスティック推定（1-based を返す / 見つからなければ null）
 * - 0 や空が混ざってもOK
 * - 数値が入るときは「他の数値列より桁が大きい」ことが多い
 * - 右側（後ろの列）にあることが多い
 * - 可能なら qty/unit より右側を優先
 */
function detectAmountColHeuristic(args: {
  rows2d: string[][];
  maxCols: number;
  qtyCol1Based: number;
  unitCol1Based: number;
  sampleRowsLimit?: number;
}): number | null {
  const { rows2d, maxCols, qtyCol1Based, unitCol1Based } = args;
  const limit = args.sampleRowsLimit ?? 200;

  // 本文っぽい行を優先（空行は除外）
  const normalized = rows2d
    .map((r) => r.map((x) => (x ?? "").trim()))
    .filter((r) => r.some((x) => x !== ""));

  const body: string[][] = [];
  for (const r of normalized) {
    if (!isLikelyBodyRow(r)) continue;
    body.push(r);
    if (body.length >= limit) break;
  }

  const pick = body.length > 0 ? body : normalized.slice(0, limit);

  const isDetailRow = (row: string[]): boolean => {
    const qtyCell = (row[qtyCol1Based - 1] ?? "").trim();
    const unitCell = (row[unitCol1Based - 1] ?? "").trim();

    const q = toNumCell(qtyCell);
    if (q == null || q === 0) return false;

    // 単位は短い語が多い。ここで明細っぽさを担保する
    const u = unitCell;
    if (!u) return false;
    if (!/(㎡|m2|m²|m|式|ヶ所|箇所|枚|本|kg|ＫＧ|l|L|ℓ|段)/i.test(u)) return false;

    return true;
  };

  const hasAnyNonZeroInCol = (col1Based: number): boolean => {
    for (const row of pick) {
      if (!isDetailRow(row)) continue;
      const cell = (row[col1Based - 1] ?? "").trim();
      const n = toNumCell(cell);
      if (n == null) continue;
      if (Math.abs(n) > 0) return true;
    }
    return false;
  };

  // --- ① ヘッダー文字から推定（amount列が空でも拾えるように） ---
  // 先頭付近の行から「ヘッダーっぽい行」を探し、金額/合計/価格などの文字がある列を採用する
  const headerPick = normalized.slice(0, Math.min(30, normalized.length));
  const headerRow = findLikelyHeaderRow(headerPick);

  const headerAmount = headerRow
    ? detectAmountColFromHeaderRow(headerRow, {
        qtyCol1Based,
        unitCol1Based,
        maxCols,
      })
    : null;

  if (headerAmount != null) {
    // ✅ 見出しで取れても、実データが全て 0/空 なら事故防止で null
    if (hasAnyNonZeroInCol(headerAmount)) return headerAmount;
    return null;
  }

  // 評価対象列（右側優先、かつ qty/unit より右側を優先）
  const minPreferCol = Math.max(qtyCol1Based, unitCol1Based) + 1;
  const startPrefer = Math.max(1, Math.floor(maxCols * 0.6));

  type Stat = {
    col: number; // 1-based
    nonZeroCount: number;
    maxDigits: number;
    maxAbs: number;
  };

  const stats: Stat[] = [];

  for (let c = 1; c <= maxCols; c++) {
    let nonZeroCount = 0;
    let maxDigits = 0;
    let maxAbs = 0;

    for (const row of pick) {
      const cell = (row[c - 1] ?? "").trim();
      const n = toNumCell(cell);
      if (n == null) continue;

      const abs = Math.abs(n);
      if (abs > 0) nonZeroCount++;
      if (abs > maxAbs) maxAbs = abs;

      // 桁数（整数部）
      const intPart = Math.trunc(abs);
      const digits = intPart === 0 ? 1 : String(intPart).length;
      if (digits > maxDigits) maxDigits = digits;
    }

    // 1つも数値が無い列は除外（0/空だけの列も除外）
    if (maxAbs === 0) continue;

    stats.push({ col: c, nonZeroCount, maxDigits, maxAbs });
  }

  // 数値が 1つも無い（= 金抜きで amount 列が全行空）場合は、
  // データからは桁推定できないので「位置関係」でフォールバックする。
  // 典型: ... 数量 / 単位 / 単価 / 金額 ... の並び。
  // - まずは「単位の右2列（単価の次）」を金額列として仮定
  // - それが範囲外なら「単位の右1列」
  // ※ ここは推定なので、UI側の手動指定で上書き可能にする前提。
  if (stats.length === 0) {
    return null;
  }

  // スコアリング
  // - 桁が大きいほど金額っぽい
  // - 右側（後ろ）ほど金額っぽい
  // - qty/unit より右側を強く優先
  const scored = stats
    .map((s) => {
      const rightBonus = s.col >= startPrefer ? 2 : 0;
      const afterQtyUnitBonus = s.col >= minPreferCol ? 3 : 0;
      const presenceBonus = s.nonZeroCount >= 2 ? 1 : 0;
      const score =
        s.maxDigits * 10 + rightBonus + afterQtyUnitBonus + presenceBonus;
      return { ...s, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // 同点なら右側を優先
      return b.col - a.col;
    });

  const best = scored[0]?.col ?? null;
  if (best == null) return null;

  // ✅ 候補列が取れても、全て 0/空 なら事故防止で null
  if (!hasAnyNonZeroInCol(best)) return null;

  return best;
}

function verifyAmountColHasAnyNonZero(args: {
  rows2d: string[][];
  amountCol1Based: number;
  qtyCol1Based: number;
  unitCol1Based: number;
  sampleRowsLimit?: number;
}): boolean {
  const { rows2d, amountCol1Based, qtyCol1Based, unitCol1Based } = args;
  const limit = args.sampleRowsLimit ?? 300;

  const normalized = rows2d
    .map((r) => r.map((x) => (x ?? "").trim()))
    .filter((r) => r.some((x) => x !== ""))
    .slice(0, limit);

  const isDetailRow = (row: string[]): boolean => {
    const qtyCell = (row[qtyCol1Based - 1] ?? "").trim();
    const unitCell = (row[unitCol1Based - 1] ?? "").trim();

    const q = toNumCell(qtyCell);
    if (q == null || q === 0) return false;

    if (!unitCell) return false;
    if (!/(㎡|m2|m²|m|式|ヶ所|箇所|枚|本|kg|ＫＧ|l|L|ℓ|段)/i.test(unitCell)) return false;

    return true;
  };

  for (const row of normalized) {
    if (!isDetailRow(row)) continue;

    const cell = (row[amountCol1Based - 1] ?? "").trim();
    const n = toNumCell(cell);
    if (n == null) continue;
    if (Math.abs(n) > 0) return true;
  }

  return false;
}

function findLikelyHeaderRow(rows: string[][]): string[] | null {
  // できるだけ「列名」が並んでいる行を探す
  // 例: 品名/名称, 摘要/仕様, 数量, 単位, 単価, 金額/合計
  const headerKeywords = [
    "品名",
    "名称",
    "工事",
    "項目",
    "摘要",
    "仕様",
    "数量",
    "単位",
    "単価",
    "金額",
    "合計",
    "価格",
  ];

  let best: { row: string[]; score: number } | null = null;

  for (const r of rows) {
    const cells = r.map((x) => (x ?? "").trim()).filter((x) => x !== "");
    if (cells.length < 3) continue;

    const joined = cells.join(" ");
    let score = 0;
    for (const kw of headerKeywords) {
      if (joined.includes(kw)) score += 1;
    }

    // 数値だらけの行はヘッダーではないので減点
    const digitCount = (joined.match(/\d/g) ?? []).length;
    if (digitCount >= 6) score -= 2;

    if (!best || score > best.score) {
      best = { row: r, score };
    }
  }

  // 2点以上ならヘッダーとみなす（必要なら調整可）
  if (best && best.score >= 2) return best.row;
  return null;
}

function detectAmountColFromHeaderRow(
  headerRow: string[],
  args: { qtyCol1Based: number; unitCol1Based: number; maxCols: number },
): number | null {
  const { qtyCol1Based, unitCol1Based, maxCols } = args;

  // amount候補の見出し
  const amountKeys = ["金額", "合計", "価格", "請求", "支払"];
  // 単価の見出し（あるときは「単価の右側」を強く優先）
  const unitPriceKeys = ["単価", "単価(円)", "単価（税込）", "単価(税抜)"];

  const norm = headerRow.map((x) => (x ?? "").trim());

  const findColByKeys = (keys: string[]): number | null => {
    for (let c = 1; c <= maxCols; c++) {
      const v = norm[c - 1] ?? "";
      if (!v) continue;
      if (keys.some((k) => v.includes(k))) return c;
    }
    return null;
  };

  const unitPriceCol = findColByKeys(unitPriceKeys);
  const amountCol = findColByKeys(amountKeys);

  // まず amount が直接見つかればそれを返す
  if (amountCol != null) {
    // qty/unit より右側を優先（ただし見出しがあるなら左でも許容）
    const minPreferCol = Math.max(qtyCol1Based, unitCol1Based) + 1;
    if (amountCol >= minPreferCol) return amountCol;
    // 左側にあっても見出しが明確なら採用
    return amountCol;
  }

  // amount 見出しが無いが、単価がある場合は「単価の右隣」を候補にする
  if (unitPriceCol != null) {
    const candidate = unitPriceCol + 1;
    if (candidate >= 1 && candidate <= maxCols) return candidate;
  }

  return null;
}

/**
 * 結合セルを “値で埋める”
 * - sheet_to_json(header:1) は結合セルの下側/右側が空になりやすい
 * - ここで結合範囲内をトップ左の値で補完して、テキスト化を安定させる
 */
function fillMergedCells(ws: XLSX.WorkSheet): void {
  const merges = (ws["!merges"] ?? []) as XLSX.Range[];
  if (merges.length === 0) return;

  for (const m of merges) {
    const start = m.s; // {r,c}
    const end = m.e;

    const topLeftAddr = XLSX.utils.encode_cell({ r: start.r, c: start.c });
    const topLeft = ws[topLeftAddr]?.v;
    if (topLeft == null || topLeft === "") continue;

    for (let r = start.r; r <= end.r; r++) {
      for (let c = start.c; c <= end.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cur = ws[addr]?.v;

        // 既に値があるなら尊重
        if (cur != null && cur !== "") continue;

        ws[addr] = {
          t: typeof topLeft === "number" ? "n" : "s",
          v: topLeft,
        } as XLSX.CellObject;
      }
    }
  }
}

function isLikelyBodyRow(row: string[]): boolean {
  const nonEmpty = row.filter((x) => x.trim() !== "");
  if (nonEmpty.length <= 1) return false; // タイトル行/見出し行を除外

  // 行に“数量っぽい数値”か“単位っぽい文字”か“サイズ記号”が含まれるなら本文の可能性が高い
  const joined = nonEmpty.join(" ");
  const hasNumber = /\d/.test(joined);
  const hasUnit = /(㎡|m2|m²|式|ヶ所|箇所|枚|本|kg|ＫＧ|L|ℓ)/i.test(joined);
  const hasSize = /\b[WHL]\s*[-=＝]?\s*\d+/i.test(joined); // W-1200 / H=250 など

  return hasNumber || hasUnit || hasSize;
}

function buildSampleText(
  rows2d: string[][],
  maxRows: number,
): { text: string; usedRows: number; usedCols: number } {
  const normalized = rows2d
    .map((r) => r.map((x) => (x ?? "").trim()))
    .filter((r) => r.some((x) => x !== ""));

  // 本文っぽい行を優先して抽出
  const body: string[][] = [];
  for (const r of normalized) {
    if (!isLikelyBodyRow(r)) continue;
    body.push(r);
    if (body.length >= maxRows) break;
  }

  const pick =
    body.length >= Math.min(10, maxRows) ? body : normalized.slice(0, maxRows);

  const maxCols = pick.reduce((m, r) => Math.max(m, r.length), 0);

  // 列ラベル（1-based）を付けて、AIが迷わないようにする
  // 例: [1]品名  [2]摘要  [3]数量 ...
  const lines = pick.map((r, idx) => {
    const cols = Array.from({ length: maxCols }, (_, i) => {
      const v = (r[i] ?? "").trim();
      return `[${i + 1}]${v}`;
    }).join("\t");
    return `ROW${idx + 1}\t${cols}`;
  });

  return {
    text: lines.join("\n"),
    usedRows: pick.length,
    usedCols: maxCols,
  };
}

// AIに返させる型（1-based）
type AiDetect = {
  item: number;
  desc: number;
  qty: number;
  unit: number;
  amount: number | null;
  size: number;
  confidence: number;
  notes: string[];
};

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      const ng: DetectNg = { ok: false, error: "file がありません" };
      return NextResponse.json(ng, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });

    // フロントがシートを選択している場合はそれを優先する
    const sheetNameFromForm = form.get("sheetName");
    const requestedSheetName =
      typeof sheetNameFromForm === "string" ? sheetNameFromForm.trim() : "";

    const sheetName =
      requestedSheetName && wb.SheetNames.includes(requestedSheetName)
        ? requestedSheetName
        : wb.SheetNames?.[0];

    if (!sheetName) {
      const ng: DetectNg = { ok: false, error: "シートが見つかりません" };
      return NextResponse.json(ng, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];

    // シート全体の列数（末尾が空でも列自体は存在するケースがあるため）
    const ref = ws["!ref"] as string | undefined;
    const range = ref ? XLSX.utils.decode_range(ref) : null;
    const sheetMaxCols = range ? range.e.c + 1 : 0; // 1-based

    // ✅ 重要: 結合セル補完(fillMergedCells)は「金額列の非ゼロ判定」を壊すことがある
    // （合計行などの結合範囲にトップ左の数値が広がり、amount列に誤って数値が入る）
    // なので、amount判定用は「補完前(raw)」を保持し、AI/列推定用は「補完後(filled)」を使う。

    // ---- raw（結合セル補完前）----
    const rowsUnknownRaw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as unknown[][];

    const rows2dRaw: string[][] = rowsUnknownRaw.map((r) => r.map((v) => normCell(v)));

    // ---- filled（結合セル補完後）----
    fillMergedCells(ws);

    const rowsUnknownFilled: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as unknown[][];

    const rows2d: string[][] = rowsUnknownFilled.map((r) => r.map((v) => normCell(v)));

    const sample = buildSampleText(rows2d, 60);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      const ng: DetectNg = { ok: false, error: "OPENAI_API_KEY が未設定です" };
      return NextResponse.json(ng, { status: 500 });
    }

    // 「摘要はサイズが入りやすい」を強いヒントにする
    const system = `
あなたは日本の建築見積/明細Excelの列推定エンジンです。
与えられるのは “セル結合を値で埋めた後” の行テキストです。
目的：列番号(1-based)で item/desc/qty/unit/amount/size を推定してください。

重要ルール:
- item: 名称/工事名/品名/項目/部位名（文字列中心、左寄りが多い）
- desc: 摘要/仕様/規格/内容（文字列中心、サイズ記号や型番が混ざりやすい）
- size: サイズ抽出元の列（多くのケースで desc と同じ。W- / H- / L- が出やすい列を優先）
- qty: 数量（数値中心）
- unit: 単位（㎡, m2, 式, 箇所, 枚, 本, kg, L などの短い語）
- amount: 金額（存在しない/金抜きなら null。0 や空の行が混ざることもある。列自体は存在するが全行が空のケースもある。その場合は見出し(例: 金額/合計/価格)や「単価の右側」などの位置関係で推定する。数値が入るときは他の数値列より桁が大きいことが多く、右寄りで、原則「単価」の後ろ側に出ることが多い）
- もし amount が不確実なら null を返してよい（こちらで右寄り・最大桁の列を補正する）

出力は必ずスキーマに従ってください。`;

    const user = `
以下はExcelの一部行です。各セルは [列番号]値 形式です。
この情報だけで列を推定し、列番号(1-based)で返してください。

--- SAMPLE START ---
${sample.text}
--- SAMPLE END ---
`;

    const resp = await openai.responses.create({
      model: "gpt-4o-2024-08-06",
      input: [
        { role: "system", content: system.trim() },
        { role: "user", content: user.trim() },
      ],
      // JSON を強制（zod 依存なし）
      text: {
        format: {
          type: "json_schema",
          name: "detect_cols",
          schema: {
            type: "object",
            additionalProperties: false,
            required: [
              "item",
              "desc",
              "qty",
              "unit",
              "amount",
              "size",
              "confidence",
              "notes",
            ],
            properties: {
              item: { type: "integer", minimum: 1 },
              desc: { type: "integer", minimum: 1 },
              qty: { type: "integer", minimum: 1 },
              unit: { type: "integer", minimum: 1 },
              amount: { type: ["integer", "null"], minimum: 1 },
              size: { type: "integer", minimum: 1 },
              confidence: { type: "number", minimum: 0, maximum: 1 },
              notes: { type: "array", items: { type: "string" } },
            },
          },
          strict: true,
        },
      },
    });

    const raw = (resp.output_text ?? "").trim();
    let out: AiDetect;

    try {
      out = JSON.parse(raw) as AiDetect;
    } catch {
      throw new Error(`AI returned invalid JSON: ${raw.slice(0, 300)}`);
    }

    // 念のための整形
    out.notes = Array.isArray(out.notes) ? out.notes : [];
    out.confidence =
      typeof out.confidence === "number" && Number.isFinite(out.confidence)
        ? Math.max(0, Math.min(1, out.confidence))
        : 0;

    // 最低限の安全策：範囲外は落とす
    const maxCol = Math.max(1, sample.usedCols);

    // amount 推定は「全行空」でも列自体はあるので、シート全体の列数も考慮する
    const maxColForAmount = Math.max(maxCol, sheetMaxCols || 0);
    const clampCol = (n: number) => Math.max(1, Math.min(maxCol, n));

    const item = clampCol(out.item);
    const desc = clampCol(out.desc);
    const qty = clampCol(out.qty);
    const unit = clampCol(out.unit);
    const size = clampCol(out.size);

    // amount は AI が null を返すことがある（0/空が混ざる、金抜き等）
    // → その場合は「右寄り」「最大桁」を優先するヒューリスティックで補完する
    const amountFromAi = out.amount == null ? null : clampCol(out.amount);
    const amountHeuristic = detectAmountColHeuristic({
      rows2d: rows2dRaw,
      maxCols: maxColForAmount,
      qtyCol1Based: qty,
      unitCol1Based: unit,
      sampleRowsLimit: 200,
    });

    // ✅ AI/heuristic が返した列でも、実データが全て 0/空なら null に落とす（事故防止）
    const amountCandidate = amountFromAi ?? amountHeuristic;
    const amount =
      amountCandidate != null &&
      verifyAmountColHasAnyNonZero({
        rows2d: rows2dRaw,
        amountCol1Based: amountCandidate,
        qtyCol1Based: qty,
        unitCol1Based: unit,
        sampleRowsLimit: 300,
      })
        ? amountCandidate
        : null;

    const ok: DetectOk = {
      ok: true,
      sheetName,
      headerRowIndex: null,
      detectedCols: {
        item,
        desc,
        qty,
        unit,
        amount,
        size,
      },
      debug: {
        sampledRows: sample.usedRows,
        sampledCols: sample.usedCols,
        notes: [
          `confidence=${out.confidence}`,
          `amountFromAi=${amountFromAi ?? "null"}`,
          `amountHeuristic=${amountHeuristic ?? "null"}`,
          `amountHeuristicMode=${amountFromAi == null ? "heuristic" : "ai"}`,
          `amountSelected=${amount ?? "null"}`,
          `rows2dRawRows=${rows2dRaw.length}`,
          `rows2dFilledRows=${rows2d.length}`,
          `amountNonZero=${amount != null ? "true" : "false"}`,
          ...out.notes,
        ],
      },
    };

    return NextResponse.json(ok);
  } catch (e: unknown) {
    const ng: DetectNg = {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    };
    return NextResponse.json(ng, { status: 500 });
  }
}
