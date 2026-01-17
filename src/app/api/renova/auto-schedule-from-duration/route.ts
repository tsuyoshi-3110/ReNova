// src/app/api/renova/auto-schedule-from-duration/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type DurationResult = {
  category: string;
  main_type?: string | null;
  unit: string;
  total_quantity?: number;
  houkake?: number;
  workers?: number;
  capacity_per_day?: number;
  days?: number;
  note?: string;
};

type AiScheduleItem = {
  label: string; // 工程表のバーのラベル（例：足場組立、シーリング など）
  days: number;  // その工程に使う日数
};

type AiScheduleSection = {
  title: string;        // 例: "1工区"
  items: AiScheduleItem[];
};

type AiScheduleSuggestion = {
  sections: AiScheduleSection[];
};

// 型ガード
function isDurationResult(value: unknown): value is DurationResult {
  if (!value || typeof value !== "object") return false;
  const obj = value as Partial<DurationResult>;
  if (typeof obj.category !== "string") return false;
  if (typeof obj.unit !== "string") return false;
  if (
    obj.main_type !== undefined &&
    obj.main_type !== null &&
    typeof obj.main_type !== "string"
  ) {
    return false;
  }
  if (obj.days !== undefined && typeof obj.days !== "number") {
    return false;
  }
  return true;
}

// 足場系かどうか判定（category に「足場」を含むものを対象）
function isScaffold(result: DurationResult): boolean {
  return result.category.includes("足場");
}

// 日数を必ず切り上げ整数にする
function ceilDays(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.ceil(value);
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const durationResultsUnknown = (body as { durationResults?: unknown })
    .durationResults;
  if (!Array.isArray(durationResultsUnknown)) {
    return NextResponse.json(
      { error: "`durationResults` must be an array" },
      { status: 400 }
    );
  }

  const durationResults: DurationResult[] = durationResultsUnknown
    .filter(isDurationResult)
    .filter((r) => typeof r.days === "number" && (r.days ?? 0) > 0);

  if (durationResults.length === 0) {
    // 日数データが無ければ空で返す
    return NextResponse.json<AiScheduleSuggestion>({ sections: [] });
  }

  // ★ 足場系とそれ以外を分ける
  const scaffoldResults = durationResults.filter(isScaffold);
  const nonScaffoldResults = durationResults.filter((r) => !isScaffold(r));

  // 足場の合計日数（全体）
  const totalScaffoldDays = scaffoldResults.reduce(
    (sum, r) => sum + (r.days ?? 0),
    0
  );

  // 「足場しかない現場」の場合はAIに投げずにこちらで完結させる
  if (nonScaffoldResults.length === 0 && totalScaffoldDays > 0) {
    const assemblyRaw = totalScaffoldDays * (2 / 3);
    const dismantleRaw = totalScaffoldDays - assemblyRaw;

    const assemblyDays = ceilDays(assemblyRaw);
    const dismantleDays = ceilDays(dismantleRaw);

    const suggestion: AiScheduleSuggestion = {
      sections: [
        {
          title: "1工区",
          items: [
            { label: "足場組立", days: assemblyDays },
            { label: "足場解体", days: dismantleDays },
          ],
        },
      ],
    };

    return NextResponse.json(suggestion);
  }

  // 工程表側で使える工種ラベル候補
  const candidateLabels: string[] = [
    "足場組立",
    "下地補修",
    "シーリング",
    "塗装（外壁）",
    "塗装（鉄部）",
    "防水工事",
    "長尺シート",
    "美装",
    "検査",
    "手直し",
    "足場解体",
    "屋上塗装工事",
    "屋上防水工事",
    "その他防水工事",
    "塔屋ー足場組立工事",
    "塔屋ー下地補修工事",
    "塔屋ーシーリング工事",
    "塔屋ー塗装工事",
    "塔屋ー防水工事",
    "塔屋ー足場解体工事",
  ];

  const systemPrompt = `
あなたは建設工事の工程表を作成するアシスタントです。

入力として「工種別数量サマリから算出された DurationResult の配列」が与えられます。
各要素には
- category（工事種別：シーリング工事、外壁塗装工事、屋上防水工事など）
- main_type（任意：アスファルト防水、ウレタン防水など）
- unit（㎡, m, ヶ所, 段 など）
- days（その内容に必要な日数）
などが含まれます。

【重要なルール】
- category, main_type, unit が同じものは「同じ工程」とみなして days を合算してください。
  - 例：シーリング工事で 2 パターンに分かれている場合、それぞれの days を合計して
    「シーリング」という1つの工程日数にまとめるイメージです。
- 出力では、工程表で使う「ラベル」と「日数」を返します。
- ラベルは、できるだけ次の候補から選んでください:
  ${candidateLabels.join(", ")}
- もし上記候補にぴったり合わない場合は、category をベースに短いラベルを作ってください。
- 足場の工程（足場組立・足場解体）は別途こちらで追加するため、あなたの出力には含めなくて構いません。

【出力フォーマット】
以下の JSON オブジェクト「のみ」を返してください：

{
  "sections": [
    {
      "title": "1工区",
      "items": [
        { "label": "下地補修", "days": 10 },
        { "label": "シーリング", "days": 12 },
        { "label": "塗装（外壁）", "days": 20 },
        { "label": "塗装（鉄部）", "days": 8 },
        { "label": "防水工事", "days": 7 },
        { "label": "長尺シート", "days": 5 },
        { "label": "美装", "days": 3 },
        { "label": "検査", "days": 2 },
        { "label": "手直し", "days": 3 }
      ]
    }
  ]
}

- sections は 1 要素でも複数要素でも構いませんが、最低1件は含めてください。
- days は正の数（整数または小数）にしてください。
- items の順番は「下地→シーリング→塗装→防水→長尺→美装→検査→手直し」のように、
  建築工事の一般的な流れになるように並べてください（シンプルなパイプラインで構いません）。
  （足場組立・足場解体は出力しないでください。こちらで先頭と末尾に追加します。）
`;

  // ★ AI には「足場以外」の DurationResult だけ渡す
  const userContent = JSON.stringify({ durationResults: nonScaffoldResults });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No content from OpenAI" },
        { status: 500 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse OpenAI JSON:", e, content);
      return NextResponse.json(
        { error: "Failed to parse OpenAI JSON" },
        { status: 500 }
      );
    }

    const result = parsed as AiScheduleSuggestion;
    if (!Array.isArray(result.sections)) {
      return NextResponse.json(
        { error: "Invalid format from OpenAI" },
        { status: 500 }
      );
    }

    // ★ 足場日数があれば「組立2/3・解体1/3」で自動追加
    if (totalScaffoldDays > 0) {
      const assemblyRaw = totalScaffoldDays * (2 / 3);
      const dismantleRaw = totalScaffoldDays - assemblyRaw;

      const assemblyDays = ceilDays(assemblyRaw);
      const dismantleDays = ceilDays(dismantleRaw);

      if (result.sections.length === 0) {
        result.sections.push({ title: "1工区", items: [] });
      }

      const firstSection = result.sections[0];
      const existingItems = Array.isArray(firstSection.items)
        ? firstSection.items
        : [];

      firstSection.items = [
        { label: "足場組立", days: assemblyDays },
        ...existingItems,
        { label: "足場解体", days: dismantleDays },
      ];
    }

    // ★ 最後に、全ての工程の日数を「切り上げ整数」に統一
    result.sections = result.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        days: ceilDays(item.days),
      })),
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.error("OpenAI API error:", e);
    return NextResponse.json(
      { error: "OpenAI API error" },
      { status: 500 }
    );
  }
}
