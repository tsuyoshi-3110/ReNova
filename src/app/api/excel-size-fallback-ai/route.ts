// src/app/api/excel-size-fallback-ai/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

/**
 * AIに渡す入力（1行分を想定）
 * - text: 摘要/仕様のセル文字列（サイズが含まれやすい）
 * - hintUnit: "m" など（任意）
 * - context: item/desc 等まとめ（任意）
 */

type SizeResult = {
  heightMm?: number;
  wideMm?: number;
  lengthMm?: number;
  overlapMm?: number;
  // AIが「なぜそう判断したか」を短く
  reason?: string;
};

type OkRes = {
  ok: true;
  normalizedText: string;
  size: SizeResult;
};

type NgRes = { ok: false; error: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

function normalizeText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function clampMm(n: number): number {
  // 建築で現実的な範囲に軽く丸め（暴走防止）
  const v = Math.round(n);
  if (v < 0) return 0;
  if (v > 999999) return 999999;
  return v;
}

function pickNum(v: unknown): number | undefined {
  if (typeof v !== "number") return undefined;
  if (!Number.isFinite(v)) return undefined;
  return clampMm(v);
}

function parseJsonFromText(maybeJson: string): unknown {
  // 念のため ```json ``` の囲いを剥がす
  const t = maybeJson.trim();
  const stripped = t
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(stripped);
}

function safeExtractSize(obj: unknown): SizeResult {
  if (!isObject(obj)) return {};

  const heightMm = pickNum(obj.heightMm);
  const wideMm = pickNum(obj.wideMm);
  const lengthMm = pickNum(obj.lengthMm);
  const overlapMm = pickNum(obj.overlapMm);

  const reasonRaw = obj.reason;
  const reason =
    typeof reasonRaw === "string" ? reasonRaw.slice(0, 120) : undefined;

  const out: SizeResult = {};
  if (heightMm != null && heightMm > 0) out.heightMm = heightMm;
  if (wideMm != null && wideMm > 0) out.wideMm = wideMm;
  if (lengthMm != null && lengthMm > 0) out.lengthMm = lengthMm;
  if (overlapMm != null && overlapMm >= 0) out.overlapMm = overlapMm;
  if (reason) out.reason = reason;

  return out;
}

export async function POST(req: Request) {
  try {
    const bodyUnknown: unknown = await req.json().catch(() => null);

    if (!isObject(bodyUnknown)) {
      const ng: NgRes = { ok: false, error: "JSON body が必要です" };
      return NextResponse.json(ng, { status: 400 });
    }

    const text = normalizeText(toStr(bodyUnknown.text));
    const hintUnit = normalizeText(toStr(bodyUnknown.hintUnit));
    const context = normalizeText(toStr(bodyUnknown.context));

    if (!text) {
      const ng: NgRes = { ok: false, error: "text が空です" };
      return NextResponse.json(ng, { status: 400 });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // ※ モデル名はあなたの環境に合わせて変更OK
    // 例: "gpt-4.1-mini" / "gpt-4o-mini" 等
    const model = process.env.OPENAI_MODEL_SIZE_FALLBACK ?? "gpt-4o-mini";

    const prompt = [
      "次の文字列から、建築明細のサイズ情報を抽出してください。",
      "対象は (H/W/L/重ね) の数値で、単位は mm として返してください。",
      "",
      "重要:",
      "- 'mm' 表記が無いことが多いので、数字は基本 mm とみなしてよい。",
      "- W-200, H=50, L:1200, W200, H50, L1.2m(=>1200) など揺れに対応。",
      "- 300×300 のような表記は wideMm=300, lengthMm=300 としてよい。",
      "- '重ね 50' があれば overlapMm=50。",
      "- 不明なら該当フィールドは出さない（nullも出さない）。",
      "- 出力は **必ず JSON のみ**。",
      "",
      "出力JSON形式:",
      "{",
      '  "heightMm": number?,',
      '  "wideMm": number?,',
      '  "lengthMm": number?,',
      '  "overlapMm": number?,',
      '  "reason": string? (短く)',
      "}",
      "",
      "入力:",
      `text: ${text}`,
      hintUnit ? `hintUnit: ${hintUnit}` : "",
      context ? `context: ${context}` : "",
    ]
      .filter((x) => x !== "")
      .join("\n");

    const r = await client.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a careful extractor. Return ONLY valid JSON. No markdown, no explanation outside JSON.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = r.choices[0]?.message?.content ?? "";
    if (!content) {
      const ng: NgRes = { ok: false, error: "AIの応答が空です" };
      return NextResponse.json(ng, { status: 500 });
    }

    const jsonUnknown = parseJsonFromText(content);
    const size = safeExtractSize(jsonUnknown);

    const ok: OkRes = {
      ok: true,
      normalizedText: text,
      size,
    };

    return NextResponse.json(ok);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const ng: NgRes = { ok: false, error: `size fallback failed: ${msg}` };
    return NextResponse.json(ng, { status: 500 });
  }
}
