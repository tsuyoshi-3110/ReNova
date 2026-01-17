// src/app/api/renova/parse-spec/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { SpecItem } from "@/types/pdf";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// 60秒くらいあれば十分
export const maxDuration = 60;

// LLM から一旦受け取る素の型
type RawSpecItem = {
  section?: string;
  name?: string;
  unit?: string;
  quantity?: number | string;

  specCode?: string | null;

  length_m?: number | string | null;
  width_m?: number | string | null;
  height_m?: number | string | null;
  depth_m?: number | string | null;
  steps?: number | string | null;

  estimated_area_m2?: number | string | null;
  unit_note?: string | null;
};

type LlmResponse = {
  items?: RawSpecItem[];
};

function toNumOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") {
    return Number.isFinite(v) ? v : null;
  }
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeItem(raw: RawSpecItem): SpecItem {
  const section = (raw.section ?? "").toString().trim();
  const name = (raw.name ?? "").toString().trim();
  const unit = (raw.unit ?? "").toString().trim();
  const quantity = toNumOrNull(raw.quantity) ?? 0;

  const specCodeRaw =
    raw.specCode === undefined || raw.specCode === null
      ? null
      : String(raw.specCode).trim() || null;

  return {
    section,
    name,
    unit,
    quantity,
    specCode: specCodeRaw,
    length_m: toNumOrNull(raw.length_m),
    width_m: toNumOrNull(raw.width_m),
    height_m: toNumOrNull(raw.height_m),
    depth_m: toNumOrNull(raw.depth_m),
    steps: toNumOrNull(raw.steps),
    estimated_area_m2: toNumOrNull(raw.estimated_area_m2),
    unit_note:
      raw.unit_note === undefined || raw.unit_note === null
        ? null
        : String(raw.unit_note).trim() || null,
  };
}

/**
 * LLM が ```json ...``` で返したり、前後に余計なテキストをつけた場合に
 * JSON 本体っぽい部分だけを抜き出す
 */
function extractJsonCore(text: string): string {
  const trimmed = text.trim();

  // ```json ... ``` 形式
  if (trimmed.startsWith("```")) {
    const withoutFirstFence = trimmed.replace(/^```[a-zA-Z]*\s*/u, "");
    const endFenceIndex = withoutFirstFence.lastIndexOf("```");
    const core =
      endFenceIndex >= 0
        ? withoutFirstFence.slice(0, endFenceIndex)
        : withoutFirstFence;
    return core.trim();
  }

  // 最初の { から最後の } までを抜き出す
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

/**
 * OpenAI ChatCompletion の message から「テキスト部分だけ」を安全に取り出す
 * - content が string のとき: そのまま
 * - content が配列のとき: text フィールドを全部つなぐ
 * - それ以外: String() で無理やり文字列化
 */
function extractMessageText(message: { content?: unknown } | null | undefined): string {
  const raw = message?.content;

  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    const parts = raw as Array<{ text?: unknown }>;
    const texts: string[] = [];
    for (const part of parts) {
      if (typeof part.text === "string") {
        texts.push(part.text);
      }
    }
    if (texts.length > 0) {
      return texts.join("\n");
    }
  }

  if (raw === null || raw === undefined) {
    return "";
  }

  return String(raw);
}

/** 本番の解析用プロンプトで LLM を叩いて「JSON っぽい文字列」をもらう */
async function callMainModel(trimmedText: string): Promise<string> {
  const systemPrompt = `
あなたは日本の建築工事内訳書を読み取る専門家です。
入力は PDF から抽出されたテキストで、A共通仮設工事 / B直接仮設工事 / C防水工事 などの見出しと、
その下に仕様・数量・単位が並んだ明細行が含まれます。

### あなたのタスク
数量が記載された「明細行」だけを抽出し、次の TypeScript 型 SpecItem[] に相当する JSON を返してください。

type SpecItem = {
  section: string;         // 見出し (例: "A 共通仮設工事")
  name: string;            // 明細行テキスト全体
  unit: string;            // 単位 (例: "㎡", "m", "m2", "式", "ヶ所", "段", "枚" など)
  quantity: number;        // 数量 (数値, カンマ無し)

  specCode?: string | null;  // 仕様番号 (例: "RP-1", "RP-11", "床-3", "防水-1"。無ければ null)

  length_m?: number | null;        // 長さ[m] (単位が m の場合など)
  width_m?: number | null;         // 巾[m] (W, 巾, 幅, 糸幅などから推定)
  height_m?: number | null;        // 高さ[m]
  depth_m?: number | null;         // 奥行き/出[m]
  steps?: number | null;           // 段数 (階段など "11段" の 11)

  estimated_area_m2?: number | null; // 推定した塗り面積[m²]
  unit_note?: string | null;       // ㎡にしなかった理由などの短いメモ
};

### 仕様番号 (specCode)
- 行の中に「RP-1」「RP-11」「床-1」「床-2」「床-3」「防水-1」などの短い記号があれば、それを specCode に入れてください。
- たいてい行頭か行の早い位置に書かれています。
- 見つからなければ specCode は null にしてください。

### サイズと単位の読み方
- 数字の後ろに単位が無い場合は mm とみなします（建築の慣例）。
  - 例: "巾250" → 巾 250mm → width_m = 0.25
  - "糸幅300" → 巾 300mm → width_m = 0.3
- "W300×H300×D250" のような表記は
  - width_m = 0.3, height_m = 0.3, depth_m = 0.25
- 「0.6m」「0.5ｍ」 のように m が書かれていればそのまま m として扱います。
- 巾・幅・W・糸幅 などの語があれば width とみなしてください。

### estimated_area_m2 の計算ルール
以下のルールで「その行で実際に塗る/貼る面積[m²]」を推定し、estimated_area_m2 に入れてください。

1. 行の単位が ㎡, m2, m² の場合
   - 単純に quantity をそのまま estimated_area_m2 に入れてください。

2. 行の単位が m / ｍ の場合
   - テキスト内に巾や幅の情報があれば width_m を求め、
     estimated_area_m2 = 長さ[m] (quantity) × 巾[m] (width_m)
   - 巾や幅がまったく書かれていない場合は、estimated_area_m2 は null にし、
     unit_note に「巾不明のため長さmのまま」などと書いてください。

3. W×H×D の箱などの立体の場合
   - 例: W300×H300×D250
   - 数値は mm として読み取り、m に変換してください。
   - 基本的には壁や床に密着している箱なので、5面分の表面積を塗ると仮定します。
     - 直方体の 3種の面積: A = W×H, B = H×D, C = W×D
     - 6面全体: 2×(A + B + C)
     - 接地して塗らない面を最も小さい面とみなして 1枚分引き、
       5面分の面積 ≒ 2×(A + B + C) - min(A, B, C)
   - 1個あたりの 5面分表面積 × 個数(quantity) を estimated_area_m2 に入れてください。
   - 箱なのかどうか判断が難しい場合は無理に計算せず null にして構いません。

4. 階段段数など、㎡換算しない方が自然なもの
   - 単位が「段」や、明らかに段数だけを示している行は、estimated_area_m2 は null のままにし、
     unit_note に「段数なのでm²に変換しない」などと書いてください。

### JSON 出力上の注意（重要）
- 必ず有効な JSON オブジェクトを返してください。
- ルートは { "items": SpecItem[] } という形にしてください。
- 文字列の中で二重引用符 (") を使うときは、JSON として正しくエスケープしてください。
- コメントや説明文は一切書かないでください。JSON オブジェクトのみを返してください。
`.trim();

  const userPrompt = `
以下は建築工事内訳書から抽出したテキストです。
これを解析し、指示通り SpecItem[] を JSON で返してください。

--- BEGIN TEXT ---
${trimmedText}
--- END TEXT ---
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const message = completion.choices[0]?.message;
  const content = extractMessageText(message);

  if (!content.trim()) {
    throw new Error("LLM からの出力が空でした。");
  }

  return content;
}

/**
 * 壊れている JSON 文字列を、もう一度 LLM に渡して
 * 「有効な JSON オブジェクト」に修正してもらう
 */
async function repairJson(brokenJsonLike: string): Promise<string> {
  const systemPrompt = `
あなたは JSON 修正の専門家です。
ユーザーから、壊れている可能性がある JSON 文字列が渡されます。
それをできる限り元の意図を保ったまま、有効な JSON オブジェクトに修正して返してください。

- ルートは { "items": [...] } という形にしてください。
- 追加のコメントや説明文は出力しないでください。JSON オブジェクトだけを返してください。
- 文字列の中に二重引用符 (") がある場合は、JSON として正しくエスケープされるようにしてください。
`.trim();

  const userPrompt = `
次の文字列は JSON オブジェクトのはずですが、パース時に SyntaxError になっています。
同じ構造を保ったまま、有効な JSON オブジェクトに修正して返してください。

--- BROKEN JSON BEGIN ---
${brokenJsonLike}
--- BROKEN JSON END ---
`.trim();

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: 4096,
  });

  const message = completion.choices[0]?.message;
  const content = extractMessageText(message);

  if (!content.trim()) {
    throw new Error("JSON 修正 LLM からの出力が空でした。");
  }

  return content;
}

/**
 * LLM からの文字列を JSON.parse し、
 * 失敗したら repairJson を使ってもう一度整形してから parse する
 */
async function parseLlmJsonWithRepair(content: string): Promise<LlmResponse> {
  const core1 = extractJsonCore(content);

  try {
    return JSON.parse(core1) as LlmResponse;
  } catch (err) {
    console.error("parse-spec first JSON parse error:", err);
  }

  const repaired = await repairJson(core1);
  const core2 = extractJsonCore(repaired);

  try {
    return JSON.parse(core2) as LlmResponse;
  } catch (err2) {
    console.error("parse-spec repair JSON parse error:", err2);
    throw new Error(err2 instanceof Error ? err2.message : String(err2));
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text) {
      return NextResponse.json(
        { error: "text がありません。" },
        { status: 400 }
      );
    }

    // 安全のため長さを制限（PDFテキストが異常に長い場合）
    const trimmedText = text.length > 15000 ? text.slice(0, 15000) : text;

    let mainContent: string;
    try {
      mainContent = await callMainModel(trimmedText);
    } catch (err) {
      console.error("parse-spec callMainModel error:", err);
      return NextResponse.json(
        {
          error: "LLM 呼び出し中にエラーが発生しました。",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    let parsed: LlmResponse;
    try {
      parsed = await parseLlmJsonWithRepair(mainContent);
    } catch (err) {
      return NextResponse.json(
        {
          error: "LLM 出力の JSON パースに失敗しました。",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    const rawItems: RawSpecItem[] = Array.isArray(parsed.items)
      ? parsed.items
      : [];

    const items: SpecItem[] = rawItems.map((raw) => normalizeItem(raw));

    return NextResponse.json({ items });
  } catch (e: unknown) {
    console.error("parse-spec route error:", e);
    return NextResponse.json(
      {
        error: "parse-spec API でエラーが発生しました。",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
