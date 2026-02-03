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

function buildSampleText(rows2d: string[][], maxRows: number): { text: string; usedRows: number; usedCols: number } {
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

  const pick = body.length >= Math.min(10, maxRows) ? body : normalized.slice(0, maxRows);

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

    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) {
      const ng: DetectNg = { ok: false, error: "シートが見つかりません" };
      return NextResponse.json(ng, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    fillMergedCells(ws);

    const rowsUnknown: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as unknown[][];

    const rows2d: string[][] = rowsUnknown.map((r) => r.map((v) => normCell(v)));

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
- item: 工種/品名/項目/部位名（文字列中心、左寄りが多い）
- desc: 摘要/仕様/規格/内容（文字列中心、サイズ記号や型番が混ざりやすい）
- size: サイズ抽出元の列（多くのケースで desc と同じ。W- / H- / L- が出やすい列を優先）
- qty: 数量（数値中心）
- unit: 単位（㎡, m2, 式, 箇所, 枚, 本, kg, L などの短い語）
- amount: 金額（存在しない/金抜きなら null。ある場合は右寄り・桁が大きい）

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
    const clampCol = (n: number) => Math.max(1, Math.min(maxCol, n));

    const item = clampCol(out.item);
    const desc = clampCol(out.desc);
    const qty = clampCol(out.qty);
    const unit = clampCol(out.unit);
    const size = clampCol(out.size);
    const amount = out.amount == null ? null : clampCol(out.amount);

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
