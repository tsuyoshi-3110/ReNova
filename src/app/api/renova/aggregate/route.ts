// src/app/api/renova/aggregate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 集計結果の型
type TotalsByCategory = Record<
  string,
  Record<string, number> // unit => total quantity
>;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const tsv: string | undefined = body?.tsv;
    if (!tsv || typeof tsv !== "string") {
      return NextResponse.json(
        { error: "tsv（タブ区切りテキスト）が必要です。" },
        { status: 400 }
      );
    }

    // TSVを行ごとに分解（余計な空行は除外）
    const lines = tsv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "有効な行がありません。" },
        { status: 400 }
      );
    }

    // ===== 1. 行ごとに「工事種別」を分類してもらう（GPT） =====

    const systemPrompt = [
      "あなたは建設工事の見積明細を分類するエキスパートです。",
      "入力として、工事明細のTSV形式（タブ区切り）の行が与えられます。",
      "各行を、以下のいずれか1つの『工事種別カテゴリ』に分類してください。",
      "",
      "カテゴリ候補:",
      "- 足場",
      "- 下地補修",
      "- シーリング",
      "- 外壁塗装",
      "- 鉄部塗装",
      "- 屋上防水",
      "- バルコニー防水",
      "- 廊下防水",
      "- その他",
      "",
      "分類の目安は次の通りです（必ずしもこれだけには限りません）：",
      "- 足場: 外部足場、メッシュシート、水平ネット、仮設資材運搬など足場関連。",
      "- 下地補修: 躯体補修、クラック補修、調査・マーキング、図面作成、下地処理・調整など。",
      "- シーリング: 目地打替、シーリング、雑シールなどシール材の充填工事。",
      "- 外壁塗装: 外壁塗装、高圧水洗浄、天井塗装、廊下・バルコニーの『塗装』など。",
      "- 鉄部塗装: 鉄部、手摺、扉、設備盤、ガラリなど金属部の塗装。",
      "- 屋上防水: 屋上・屋根・庇・花台などの防水工事（アスファルト防水、シート防水、ウレタン防水など）。",
      "- バルコニー防水: バルコニー床や花壇周りなどの防水・長尺シート貼りなど。",
      "- 廊下防水: 共用廊下・階段まわりの床防水・長尺シート貼りなど。",
      "- その他: 仮設事務所、現場管理費、一般管理費、洗浄のみの工事、ドア交換など、上記に分類しづらいもの。",
      "",
      "各行は必ずどれか1つのカテゴリに分類してください。",
      "出力は純粋なJSONのみで、説明文を加えないでください。",
    ].join("\n");

    // 各行にインデックスを振ったテキストを作成
    const indexedText = lines
      .map((line, idx) => `${idx}\t${line}`)
      .join("\n");

    const userPrompt = [
      "以下に、工事明細のTSV行（行頭にインデックス）が与えられます。",
      "各行について、 index と、対応する category（工事種別）をJSONで返してください。",
      "",
      "【必須条件】",
      "- すべての行について、必ず1件ずつ分類結果を返してください。",
      "- index は 0 から始まり、入力行と同じ行数だけ存在する必要があります。",
      "- category は次のいずれかのみを使用してください：",
      '  [\"足場\", \"下地補修\", \"シーリング\", \"外壁塗装\", \"鉄部塗装\", \"屋上防水\", \"バルコニー防水\", \"廊下防水\", \"その他\"]',
      "- 出力は次の形式のJSONのみとし、余計な文字やコメントを含めないでください。",
      "",
      "出力フォーマット例:",
      "{",
      "  \"lines\": [",
      "    { \"index\": 0, \"category\": \"足場\" },",
      "    { \"index\": 1, \"category\": \"下地補修\" }",
      "  ]",
      "}",
      "",
      "対象TSV（index付き）:",
      indexedText,
    ].join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      temperature: 0,
      max_output_tokens: 4000,
    });

    const r = response as unknown as { output_text?: string };
    const outText = r.output_text ?? "";

    let parsed: { lines: { index: number; category: string }[] };
    try {
      parsed = JSON.parse(outText);
    } catch (e) {
      console.error("Failed to parse JSON from OpenAI:", outText);
      return NextResponse.json(
        {
          error: "分類結果(JSON)の解析に失敗しました。",
          raw: outText,
        },
        { status: 500 }
      );
    }

    if (!parsed.lines || !Array.isArray(parsed.lines)) {
      return NextResponse.json(
        {
          error: "分類結果の形式が不正です。",
          raw: parsed,
        },
        { status: 500 }
      );
    }

    // ===== 2. TypeScript側で数量を集計 =====

    const totals: TotalsByCategory = {};
    const classifiedRows: {
      index: number;
      category: string;
      kubun: string;
      content: string;
      unit: string;
      quantity: number;
    }[] = [];

    for (const { index, category } of parsed.lines) {
      if (
        typeof index !== "number" ||
        index < 0 ||
        index >= lines.length ||
        typeof category !== "string"
      ) {
        continue;
      }

      const line = lines[index];
      const cols = line.split("\t");

      // 想定フォーマット:
      // 区分\t工事内容\t単位\t数量\t単価\t金額\t備考...
      const kubun = (cols[0] ?? "").trim();
      const content = (cols[1] ?? "").trim();
      const unit = (cols[2] ?? "").trim();
      const qtyRaw = (cols[3] ?? "").trim();

      // 数量（カンマ除去してから数値化）
      const qty = parseFloat(qtyRaw.replace(/,/g, ""));

      classifiedRows.push({
        index,
        category,
        kubun,
        content,
        unit,
        quantity: Number.isFinite(qty) ? qty : 0,
      });

      if (!Number.isFinite(qty)) continue; // 数量が無い行は集計スキップ

      if (!totals[category]) {
        totals[category] = {};
      }
      if (!totals[category][unit]) {
        totals[category][unit] = 0;
      }
      totals[category][unit] += qty;
    }

    return NextResponse.json({
      totals,
      rows: classifiedRows,
    });
  } catch (err) {
    console.error("Aggregate error:", err);
    const message =
      err instanceof Error ? err.message : "Unknown error during aggregate";

    return NextResponse.json(
      { error: "集計に失敗しました。", detail: message },
      { status: 500 }
    );
  }
}
