// src/lib/sizeExtractor.ts
import OpenAI from "openai";

export type SizeResult = {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;

  /** 0..1（AI補完時のみ） */
  confidence?: number;

  /** デバッグ用（AI補完時のみ） */
  notes?: string[];
};

type JsonObject = Record<string, unknown>;

function isRecord(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

/** 全角英数記号：FF01-FF5E -> 21-7E */
function toHalfWidthAscii(s: string): string {
  return s.replace(/[！-～]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/** 半角カナ→全角、濁点結合など */
function normalizeNFKC(s: string): string {
  return s.normalize("NFKC");
}

function normalizeText(s: string): string {
  const t = toHalfWidthAscii(normalizeNFKC(s));
  return t.replace(/\s+/g, " ").trim();
}

function clampInt(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function clampMm(n: number | null, min: number, max: number): number | undefined {
  if (n == null) return undefined;
  if (!Number.isFinite(n)) return undefined;
  return clampInt(n, min, max);
}

/* --------------------------
   1) ルールベース抽出（優先）
-------------------------- */

/**
 * 建築の明細でよくある「暗黙の高さ」補完（必要なら増やせる）
 * 例: 溝 → 300mm、巾木 → 200mm
 */
function pickDefaultHeightMm(text: string): number | null {
  if (text.includes("溝")) return 300;
  if (text.includes("巾木")) return 200;
  return null;
}

/**
 * W/H/L の抽出
 * - "W-1200", "W=1200", "W 1200", "W：1200"
 * - "H-50",  "H=50",  "H 50"
 * - "L-1200", "L=1.2m"
 * - 「mm」は書かれないことが多いので “数字だけ” を mm 扱い
 *
 * ※注意：
 *  - “L=1.2m” の m 表記は mm に変換
 */
function extractSizeFromText(rowTextRaw: string): {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;
} {
  const text = normalizeText(rowTextRaw);

  const out: {
    heightMm?: number;
    wideMm?: number;
    lengthMm?: number;
    overlapMm?: number;
  } = {};

  // H-50 / H=50 / H 50 / Ｈ５０
  {
    const m = text.match(/\bH\s*[-=＝:：]?\s*(\d{2,5})\b/i);
    if (m) out.heightMm = Number(m[1]);
  }

  // W-200 / W=200 / W 200 / □200 / ×200
  {
    const m =
      text.match(/\bW\s*[-=＝:：]?\s*(\d{2,6})\b/i) ||
      text.match(/[□×]\s*(\d{2,6})\b/);
    if (m) out.wideMm = Number(m[1]);
  }

  // L-1200 / L=1200
  {
    const m = text.match(/\bL\s*[-=＝:：]?\s*(\d{2,7})\b/i);
    if (m) out.lengthMm = Number(m[1]);
  }

  // L-1.2m / L=1.2m -> mm
  if (out.lengthMm == null) {
    const m = text.match(/\bL\s*[-=＝:：]?\s*(\d+(?:\.\d+)?)\s*m\b/i);
    if (m) out.lengthMm = Math.round(Number(m[1]) * 1000);
  }

  // 重ね 50
  {
    const m = text.match(/重ね\s*[-=＝:：]?\s*(\d{1,5})/);
    if (m) out.overlapMm = Number(m[1]);
  }

  return out;
}

/**
 * ルールベースの最終値決定
 * - 取れない高さは default（溝/巾木）を当てる
 */
export function parseSizeFromRowText(rowTextRaw: string): SizeResult {
  const text = normalizeText(rowTextRaw);
  const size = extractSizeFromText(text);

  if (size.heightMm == null) {
    const def = pickDefaultHeightMm(text);
    if (def != null) size.heightMm = def;
  }

  return size;
}

/**
 * ルールベースで “十分取れたか” を判定
 * - 少なくとも H/W/L のどれか1つ取れたらOK（必要なら条件を強くできる）
 */
export function isRuleBasedEnough(s: SizeResult): boolean {
  return (
    (typeof s.heightMm === "number" && Number.isFinite(s.heightMm)) ||
    (typeof s.wideMm === "number" && Number.isFinite(s.wideMm)) ||
    (typeof s.lengthMm === "number" && Number.isFinite(s.lengthMm))
  );
}

/* --------------------------
   2) AI補完（ルールで取れない時だけ）
-------------------------- */

type AiSizeJsonItem = {
  rowIndex: number; // 1-based
  heightMm: number | null;
  wideMm: number | null;
  lengthMm: number | null;
  overlapMm: number | null;
  confidence: number;
  notes: string[];
};

function isAiSizeJsonItem(v: unknown): v is AiSizeJsonItem {
  if (!isRecord(v)) return false;

  const rowIndex = v["rowIndex"];
  const confidence = v["confidence"];
  const notes = v["notes"];

  const numOrNull = (x: unknown): x is number | null =>
    x === null || typeof x === "number";

  return (
    typeof rowIndex === "number" &&
    numOrNull(v["heightMm"]) &&
    numOrNull(v["wideMm"]) &&
    numOrNull(v["lengthMm"]) &&
    numOrNull(v["overlapMm"]) &&
    typeof confidence === "number" &&
    Array.isArray(notes) &&
    notes.every((x) => typeof x === "string")
  );
}

function safeJsonParse(s: string): unknown | null {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) return null;

  const cut = s.slice(first, last + 1);
  try {
    return JSON.parse(cut) as unknown;
  } catch {
    return null;
  }
}

function getItemsArray(parsed: unknown): unknown[] | null {
  if (!isRecord(parsed)) return null;
  const items = parsed["items"];
  return Array.isArray(items) ? items : null;
}

/**
 * AIに “行のテキスト” からサイズを推定させる（バッチ）
 * - rows: {rowIndex(1-based), text} の配列
 * - 戻り: rowIndex -> SizeResult
 */
export async function parseSizesByAiBatch(params: {
  rows: Array<{ rowIndex: number; text: string }>;
  model?: string;
  apiKey?: string;
}): Promise<Record<number, SizeResult>> {
  const apiKey = params.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return {};

  const rows = params.rows
    .map((r) => ({ rowIndex: r.rowIndex, text: normalizeText(r.text) }))
    .filter((r) => r.text !== "");

  if (rows.length === 0) return {};

  const openai = new OpenAI({ apiKey });

  // JSONだけ返させる（自前パースなので zod 不要）
  const system = `
あなたは日本の建築見積/明細の「摘要・仕様・規格」テキストからサイズを推定するエンジンです。
入力は行ごとのテキストです。W/H/L/重ね を mm の整数で推定してください。

ルール:
- W/H/L は "W-1200" "H=50" "L 1500" のような表記から拾う
- "L=1.2m" のように m 表記なら mm に換算する（1.2m -> 1200）
- "重ね 50" があれば overlapMm=50
- 明確でない場合は null にする
- 必ず JSON だけを返す。説明文は禁止。

出力形式:
{
  "items": [
    {
      "rowIndex": 1,
      "heightMm": 50|null,
      "wideMm": 1200|null,
      "lengthMm": 1500|null,
      "overlapMm": 50|null,
      "confidence": 0.0..1.0,
      "notes": ["短い根拠", ...]
    },
    ...
  ]
}
`.trim();

  const user = `
以下の行テキストからサイズを推定してください。

${rows
  .map((r) => `ROW${r.rowIndex}: ${r.text}`)
  .join("\n")}
`.trim();

  // Responses API（SDK v4系想定）
  const resp = await openai.responses.create({
    model: params.model ?? "gpt-4o-mini",
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });

  const text = normalizeText(resp.output_text ?? "");
  const parsedUnknown = safeJsonParse(text);
  const itemsUnknown = getItemsArray(parsedUnknown);
  if (!itemsUnknown) return {};

  const out: Record<number, SizeResult> = {};

  for (const raw of itemsUnknown) {
    if (!isAiSizeJsonItem(raw)) continue;

    // mm の妥当レンジ（必要なら調整）
    const heightMm = clampMm(raw.heightMm, 10, 50000);
    const wideMm = clampMm(raw.wideMm, 10, 50000);
    const lengthMm = clampMm(raw.lengthMm, 10, 200000);
    const overlapMm = clampMm(raw.overlapMm, 0, 5000);

    const confidence =
      raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : 0;

    out[raw.rowIndex] = {
      heightMm,
      wideMm,
      lengthMm,
      overlapMm,
      confidence,
      notes: raw.notes,
    };
  }

  return out;
}

/* --------------------------
   3) ルール → AI 補完 の統合ヘルパ
-------------------------- */

/**
 * まずルールベースで抽出し、取れない行だけ AI で補完する。
 * - 入力は (rowIndex, text) の配列
 * - 返り値は rowIndex -> SizeResult（ルールorAI）
 */
export async function parseSizesHybrid(params: {
  rows: Array<{ rowIndex: number; text: string }>;
  model?: string;
  apiKey?: string;
}): Promise<Record<number, SizeResult>> {
  // 1) まずルール
  const ruleOut: Record<number, SizeResult> = {};
  const needAi: Array<{ rowIndex: number; text: string }> = [];

  for (const r of params.rows) {
    const s = parseSizeFromRowText(r.text);
    ruleOut[r.rowIndex] = s;

    if (!isRuleBasedEnough(s)) {
      needAi.push({ rowIndex: r.rowIndex, text: r.text });
    }
  }

  // 2) AI補完（必要な分だけ）
  if (needAi.length === 0) return ruleOut;

  const aiOut = await parseSizesByAiBatch({
    rows: needAi,
    model: params.model,
    apiKey: params.apiKey,
  });

  // 3) マージ（AIが返せた行だけ上書き）
  for (const [k, v] of Object.entries(aiOut)) {
    const rowIndex = Number(k);
    if (!Number.isFinite(rowIndex)) continue;

    // ルール結果があっても、AIの推定値が入っていれば採用
    ruleOut[rowIndex] = {
      ...ruleOut[rowIndex],
      ...v,
    };
  }

  return ruleOut;
}
