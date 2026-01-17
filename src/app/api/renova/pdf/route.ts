// src/app/api/renova/pdf/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * OpenAI Responses API からテキスト部分だけを安全に取り出すヘルパー
 */
function extractOutputText(res: unknown): string {
  if (!res || typeof res !== "object") return "";

  const obj = res as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  // 新しいレスポンス形式のショートカット
  if (typeof obj.output_text === "string") {
    return obj.output_text;
  }

  // 旧互換の content[] 形式
  if (Array.isArray(obj.output) && obj.output.length > 0) {
    const first = obj.output[0];
    if (first && Array.isArray(first.content)) {
      const textPart = first.content.find(
        (c) => c && c.type === "output_text" && typeof c.text === "string"
      );
      if (textPart && typeof textPart.text === "string") {
        return textPart.text;
      }
    }
  }

  return "";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const pageFromRaw = form.get("pageFrom");
    const pageToRaw = form.get("pageTo");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "PDFファイルが送信されていません。" },
        { status: 400 }
      );
    }

    // ---- ページ範囲（任意） ----
    let pageRangeInstruction = "";
    let pageRangeLabel = "";

    const from =
      typeof pageFromRaw === "string" && pageFromRaw.trim() !== ""
        ? Number(pageFromRaw)
        : NaN;
    const to =
      typeof pageToRaw === "string" && pageToRaw.trim() !== ""
        ? Number(pageToRaw)
        : NaN;

    if (Number.isInteger(from) && Number.isInteger(to) && from > 0 && to >= from) {
      pageRangeLabel = `ページ ${from}〜${to}`;
      pageRangeInstruction = [
        "",
        "【ページ範囲指定】",
        `・このPDF全体のうち、「${from} ページ目」から「${to} ページ目」までに含まれる内容だけをテキスト化してください。`,
        "・それ以外のページに書かれている内容は出力しないでください。",
      ].join("\n");
    }

    // ---- PDF を base64 化 ----
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mime = file.type || "application/pdf";

    // ==== プロンプト（PDF全文を素直にテキスト化） ====
    const systemPrompt = [
      "あなたはPDFファイルをOCRしてテキスト化するエンジンです。",
      "PDF内の文字や数字を、可能な限りそのままテキストに転記してください。",
      "",
      "【絶対ルール】",
      "・要約・省略・並べ替え・解釈は禁止です。",
      "・数量・単位・金額・記号も原本どおりに出力してください（カンマも保持）。",
      "・読めない文字は '?' に置き換えても構いませんが、行自体は削除しないでください。",
      "・表の行が何百行あっても、できる限りすべて出力してください。",
      "・コメントや説明文を追加してはいけません。",
    ].join("\n");

    const userPrompt = [
      pageRangeLabel
        ? `添付したPDFファイルのうち、${pageRangeLabel} に含まれる内容をテキスト化してください。`
        : "添付したPDFファイル全体を、ページ順にテキスト化してください。",
      "",
      "【出力形式】",
      "・PDFの各ページごとに、先頭に必ず '=== PAGE N ===' という1行を出力してください。",
      "  - N にはページ番号（1, 2, 3, ...）を入れてください。",
      "・それ以外は、読み取ったテキストをそのまま順番に出力してください。",
      "・改行やインデントがある場合は、元のレイアウトに近い形で残してください。",
      "・JSON やコードブロック、解説文などは一切書かず、テキストだけを出力してください。",
      pageRangeInstruction, // 必要なら追加の条件
    ]
      .filter((s) => s !== "")
      .join("\n");

    // ==== OpenAI Responses API 呼び出し ====
    const response = await client.responses.create(
      {
        model: "gpt-5.1",
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text: systemPrompt,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                // PDF 本体（data URL 形式）
                type: "input_file",
                filename: file.name,
                file_data: `data:${mime};base64,${base64}`,
              },
              {
                // 変換ルール
                type: "input_text",
                text: userPrompt,
              },
            ],
          },
        ],
        temperature: 0,
        // 大きな工事だときついので、ある程度余裕を持たせつつ、
        // ページ範囲で分割して呼ぶ前提にする
        max_output_tokens: 12000,
      },
      {
        timeout: 240_000, // 240秒
      }
    );

    const text = extractOutputText(response);

    if (!text) {
      return NextResponse.json(
        { error: "OpenAI から有効なテキスト応答が得られませんでした。" },
        { status: 500 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("PDF parse error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error during PDF parse";

    if (message.includes("timed out")) {
      return NextResponse.json(
        {
          error: "OpenAI への PDF 解析リクエストがタイムアウトしました。",
          detail: message,
          retryable: true,
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "PDF解析に失敗しました。", detail: message },
      { status: 500 }
    );
  }
}
