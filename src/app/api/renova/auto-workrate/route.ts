// src/app/api/renova/auto-workrate/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type QuantityTotal = {
  category: string;
  main_type?: string | null;
  unit: string;
  total: number;
};

type WorkrateSuggestion = {
  index: number;
  houkake: number;
  workers: number;
  note?: string;
};

type RawSuggestion = {
  index?: unknown;
  houkake?: unknown;
  workers?: unknown;
  note?: unknown;
};

// ★ 標準歩掛り・人数（屋上防水だけ、指示どおりに細かく定義）
const STANDARD_RULES_TEXT = [
  "【標準ルール（category / main_type / unit ごとの固定値）】",
  "",
  "■ 足場・仮設工事（汎用）",
  "  - category: 足場・仮設工事, main_type: (指定なし), unit: ㎡",
  "    → houkake = 50, workers = 5   // 外部足場 100㎡/人日, 5人編成イメージ",
  "",
  "■ 直接仮設工事（足場工事）",
  "  ※ 基本は4人体制。以下の数量は「4人1日でこなせる目安」から逆算している。",
  "  - category: 直接仮設工事（足場工事）, main_type: 外部足場, unit: ㎡",
  "    → houkake = 10, workers = 4   // 外部足場 40㎡/4人日 ≒ 10㎡/人日",
  "  - category: 直接仮設工事（足場工事）, main_type: メッシュシート張り, unit: ㎡",
  "    → houkake = 50, workers = 4   // メッシュシート 200㎡/4人日 ≒ 50㎡/人日",
  "  - category: 直接仮設工事（足場工事）, main_type: 落下防止水平ネット（ラッセルネット）, unit: m",
  "    → houkake = 25, workers = 4   // 水平ネット 100m/4人日 ≒ 25m/人日",
  "  - category: 直接仮設工事（足場工事）, main_type: 朝顔, unit: m",
  "    → houkake = 50, workers = 4   // 朝顔 200m/4人日 ≒ 50m/人日",
  "",
  "■ 屋上防水工事（共通ルール）",
  "  対象 category 例: ",
  "   ・屋上防水工事（塩ビシート防水）",
  "   ・屋上防水工事（ウレタン防水）",
  "   ・屋上防水工事（アスファルト防水）",
  "   ・屋上防水工事（ゴムシート防水）",
  "   ・屋上防水工事（FRP防水）",
  "  これらの屋上防水種別について、main_type が下記の名称であれば全て同じ標準値を使う。",
  "  基本は 2 名体制（workers = 2）とする。",
  "",
  "  --- 既存撤去・下地調整・付帯 ---",
  "  - category: 屋上防水工事（各種） , main_type: 既存球砂利撤去及び復旧, unit: ㎡",
  "    → houkake = 10, workers = 4   // 例: 4人で40㎡/日 程度",
  "  - category: 屋上防水工事（各種） , main_type: 既存防水立上り撤去, unit: ㎡",
  "    → houkake = 10, workers = 4   // 例: 4人で40㎡/日 程度",
  "  - category: 屋上防水工事（各種） , main_type: 笠置脱着, unit: m",
  "    → houkake = 10, workers = 4   // 例: 4人で40m/日 程度",
  "  - category: 屋上防水工事（各種） , main_type: 下地調整, unit: ㎡",
  "    → houkake = 100, workers = 4  // 例: 4人で400㎡/日 程度",
  "  - category: 屋上防水工事（各種） , main_type: 端末金物取り付け, unit: m",
  "    → houkake = 25, workers = 4   // 例: 4人で100m/日 程度",
  "",
  "  --- 新規防水（平場・立上り・笠木・パラペット） ---",
  "  ※ 平場・立上り・笠木・パラペットは、基本的に「2人で1日 20㎡ 程度」を標準とし、",
  "     そこから houkake（数量/人日）を決める。",
  "",
  "  【平場防水】",
  "  - category: 屋上防水工事（各種） , main_type: 平場防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日",
  "",
  "  【立上り防水】",
  "  - category: 屋上防水工事（各種） , main_type: 立上り防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日",
  "  - category: 屋上防水工事（各種） , main_type: 立上り防水, unit: m",
  "    → houkake = 10, workers = 2   // 単位がmの場合も、基本は20㎡/日を高さ1mとみなして20m/日 ≒ 10m/人日 で扱う",
  "",
  "  【笠木防水】",
  "  - category: 屋上防水工事（各種） , main_type: 笠木防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日",
  "  - category: 屋上防水工事（各種） , main_type: 笠木防水, unit: m",
  "    → houkake = 10, workers = 2   // 単位がmの場合も、20㎡/日を基準に㎡/m換算でおおよそ10m/人日とする",
  "",
  "  【パラペット】",
  "  - category: 屋上防水工事（各種） , main_type: パラペット, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日",
  "  - category: 屋上防水工事（各種） , main_type: パラペット, unit: m",
  "    → houkake = 10, workers = 2   // 単位がmの場合も、20㎡/日を基準に㎡/m換算でおおよそ10m/人日とする",
  "",
  "  --- 付帯部材（ドレン・脱気筒・架台） ---",
  "  ※ 以下は「2人で1日 7 ヶ所程度」を標準として houkake を決める。",
  "",
  "  - category: 屋上防水工事（各種） , main_type: 改修用ドレン取り付け, unit: ヶ所",
  "    → houkake = 3.5, workers = 2  // 2人で7ヶ所/日 → 3.5ヶ所/人日",
  "  - category: 屋上防水工事（各種） , main_type: 脱気筒取り付け, unit: ヶ所",
  "    → houkake = 3.5, workers = 2  // 2人で7ヶ所/日 → 3.5ヶ所/人日",
  "  - category: 屋上防水工事（各種） , main_type: 架台防水, unit: ヶ所",
  "    → houkake = 3.5, workers = 2  // 2人で7ヶ所/日 → 3.5ヶ所/人日",
  "",
  "■ バルコニー床防水（ウレタン）",
  "  ※ 基本は2名体制。",
  "  - category: バルコニー床防水（ウレタン）, main_type: ウレタン防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 汎用ルール（主に平場など）",
  "  - category: バルコニー床防水（ウレタン）, main_type: ウレタン防水, unit: ｍ",
  "    → houkake = 50, workers = 2   // 汎用ルール（端部・溝など）",
  "  - category: バルコニー床防水（ウレタン）, main_type: 溝防水, unit: m",
  "    → houkake = 15, workers = 2   // 2人で30m/日程度を目安",
  "  - category: バルコニー床防水（ウレタン）, main_type: 巾木防水, unit: m",
  "    → houkake = 25, workers = 2   // 2人で50m/日程度を目安",
  "  - category: バルコニー床防水（ウレタン）, main_type: 平場防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日程度を目安",
  "  - category: バルコニー床防水（ウレタン）, main_type: 立上り防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日程度を目安",
  "  - category: バルコニー床防水（ウレタン）, main_type: 室外機置き場防水, unit: ㎡",
  "    → houkake = 10, workers = 2   // 2人で20㎡/日程度を目安",
  "",
  "■ バルコニー床仕上げ",
  "  - category: バルコニー床仕上げ, main_type: その他, unit: ㎡",
  "    → houkake = 25, workers = 2",
  "",
  "■ 外壁・天井塗装工事",
  "  - category: 外壁・天井塗装工事, main_type: (指定なし), unit: ㎡",
  "    → houkake = 100, workers = 5",
  "",
  "■ 鉄部塗装工事",
  "  - category: 鉄部塗装工事, main_type: (指定なし), unit: ㎡",
  "    → houkake = 40, workers = 3",
  "  - category: 鉄部塗装工事, main_type: (指定なし), unit: ｍ",
  "    → houkake = 70, workers = 3",
  "  - category: 鉄部塗装工事, main_type: (指定なし), unit: ヶ所",
  "    → houkake = 40, workers = 3",
  "",
  "■ シーリング工事",
  "  ※ シーリングは基本2名体制。単位ごとの標準は以下とする。",
  "  - category: シーリング工事, main_type: (指定なし), unit: ｍ",
  "    → houkake = 50, workers = 2   // 2人で100m/日程度を目安（m単位）",
  "  - category: シーリング工事, main_type: (指定なし), unit: ヶ所",
  "    → houkake = 40, workers = 2   // 2人で80ヶ所/日程度を目安（箇所単位）",
  "    ※ 開口が大きい場合や複雑な納まりの場合は、±20〜30% 程度の範囲で houkake を調整してよい。",
  "",
  "■ 廊下長尺シート工事",
  "  - category: 廊下長尺シート工事, main_type: 塩ビシート／長尺シート, unit: ㎡",
  "    → houkake = 40, workers = 3",
  "  - category: 廊下長尺シート工事, main_type: 塩ビシート／長尺シート, unit: 段",
  "    → houkake = 20, workers = 1",
  "",
  "■ 下地補修工事",
  "  ※ 下地補修は工事内容によってばらつきが大きいため、以下を標準値として扱い、必要に応じて±20〜30% 程度の範囲で調整してよい。",
  "  - category: 下地補修工事, main_type: 調査, unit: ㎡",
  "    → houkake = 260, workers = 3   // 3人で800㎡/日程度を目安",
  "  - category: 下地補修工事, main_type: クラック補修（刷り込み）, unit: ｍ",
  "    → houkake = 200, workers = 2   // 2人で400m/日程度を目安",
  "  - category: 下地補修工事, main_type: クラック補修（低圧注入）, unit: ｍ",
  "    → houkake = 5, workers = 2     // 2人で10m/日程度を目安（慎重な作業）",
  "  - category: 下地補修工事, main_type: クラック補修（Uカットシール）, unit: ｍ",
  "    → houkake = 12.5, workers = 2  // 2人で25m/日程度を目安",
  "  - category: 下地補修工事, main_type: 浮補修（アンカーピンニング・エポキシ樹脂注入）, unit: ㎡",
  "    → houkake = 3.5, workers = 3   // 3人で7㎡/日程度を目安",
  "  - category: 下地補修工事, main_type: 浮補修（アンカーピンニング・エポキシ樹脂注入）, unit: ヶ所",
  "    → houkake = 18.5, workers = 3  // 7㎡≒112ヶ所 → 112/3人日≒37ヶ所/人日（目安）",
  "  - category: 下地補修工事, main_type: 欠損補修, unit: ヶ所",
  "    → houkake = 10, workers = 2    // 2人で20ヶ所/日程度を目安。大きさに応じて調整可。",
  "  - category: 下地補修工事, main_type: 塗膜補修, unit: ㎡",
  "    → houkake = 10, workers = 2    // 2人で20㎡/日程度を目安",
  "",
  "■ 外壁改修工事（タイル）",
  "  - category: 外壁改修工事（タイル）, main_type: 調査, unit: ㎡",
  "    → houkake = 260, workers = 3   // 3人で800㎡/日程度を目安",
  "  - category: 外壁改修工事（タイル）, main_type: アンカーピンニング・エポキシ樹脂注入, unit: ㎡",
  "    → houkake = 3.5, workers = 3   // 3人で7㎡/日程度を目安",
  "  - category: 外壁改修工事（タイル）, main_type: アンカーピンニング・エポキシ樹脂注入, unit: ヶ所",
  "    → houkake = 18.5, workers = 3  // 7㎡≒112ヶ所 → 112/3人日≒37ヶ所/人日（目安）",
  "  - category: 外壁改修工事（タイル）, main_type: タイル張替え, unit: ㎡",
  "    → houkake = 3.3, workers = 3   // 3人で10㎡/日程度を目安",
  "  - category: 外壁改修工事（タイル）, main_type: タイル張替え, unit: 枚",
  "    → houkake = 330, workers = 3   // 10㎡≒2000枚を目安 → 2000/3人日≒660枚/人日",
  "  - category: 外壁改修工事（タイル）, main_type: 洗浄, unit: ㎡",
  "    → houkake = 100, workers = 3   // 3人で300㎡/日程度を目安",
  "",
  "■ 一式工事（共通ルール）",
  "  - unit が「一式」または「式」の場合、その行の total は金額（円）とみなす。",
  "    → houkake = total / 20000, workers = 2〜4 を基本とする。",
  "      例: total = 400000（円）の場合、houkake = 20 とし、2〜3人程度で計画するイメージ。",
  "    ※ 一式工事については、カテゴリがどの工種であってもこのルールを優先する。",
  "",
  "【使い方】",
  "1. 各入力行について、category / main_type / unit の組み合わせを上の表から探す。",
  "2. main_type が (指定なし) のルールは「main_type に関係なく使ってよい汎用ルール」とする。",
  "3. 一致するルールがあれば、その houkake と workers をそのまま採用する（特に明記がない限り、値を変えない）。",
  "4. 一致するルールが1つも無い場合のみ、あなたが妥当な値で houkake と workers を推定する。",
  "   ・その場合は、似ている工種や数量規模を参考に、無理のない標準的な値を決める。",
  "5. 「大きさによって微調整」などの注記がある工種は、記載されている標準値を基準に ±20〜30% 程度の範囲で調整してよい。",
  "6. unit が「一式」または「式」の場合は、上記の一式工事のルールに従い、必ず total を金額として扱い houkake = total / 20000 となるように計算すること。",
  "7. どの行も必ず数値を出力する（houkake と workers のどちらも数値にする）。",
].join("\n");

// totals のゆるい正規化（変な値が混じっても落とさない）
function normalizeTotals(rawTotals: unknown): QuantityTotal[] {
  if (!Array.isArray(rawTotals)) return [];

  return rawTotals.map((row, index) => {
    const r = row as {
      category?: unknown;
      main_type?: unknown;
      unit?: unknown;
      total?: unknown;
    };

    const categoryRaw =
      typeof r.category === "string" ? r.category.trim() : "";
    const category =
      categoryRaw !== "" ? categoryRaw : `行${index + 1}（カテゴリ不明）`;

    const main_type =
      typeof r.main_type === "string" && r.main_type.trim() !== ""
        ? r.main_type.trim()
        : null;

    const unit =
      typeof r.unit === "string" && r.unit.trim() !== "" ? r.unit.trim() : "";

    const totalNum = Number(r.total);
    const total = Number.isFinite(totalNum) ? totalNum : 0;

    return { category, main_type, unit, total };
  });
}

export async function POST(req: Request) {
  try {
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

    const rawTotals = (body as { totals?: unknown }).totals;
    const totals = normalizeTotals(rawTotals);

    if (totals.length === 0) {
      return NextResponse.json(
        {
          error: "totals が空です。先に数量サマリを作成してください。",
        },
        { status: 400 }
      );
    }

    const systemPrompt = [
      "あなたは日本の大規模修繕工事（マンション）の工程計画を補助するエキスパートです。",
      "与えられた「工事種別ごとの合計数量」から、歩掛り（1人1日あたりの施工量）と標準人数を決定します。",
      "",
      "まず、下記の【標準ルール】を厳密に適用してください。",
      "category / main_type / unit の組み合わせがルールと一致する場合は、ルールに書かれた houkake と workers をそのまま使います。",
      "ルールにない組み合わせについてのみ、あなたが妥当な値を推定して構いません。",
      "",
      "【出力仕様】",
      "・出力は JSON オブジェクト 1 つのみ。",
      '・プロパティ \"suggestions\" に、各行の結果オブジェクトを配列で格納してください。',
      "・各要素は次のプロパティを必ず持ちます:",
      "  - index: 入力で与えられた行の index（数値）",
      "  - houkake: 1人1日あたりの施工量（数量/人日）",
      "  - workers: 標準人数（整数でも小数でもよいが、一般的には 2〜6 程度）",
      "  - note: その判断理由や注意点（短い日本語の説明）",
      "・JSON 以外のテキスト（説明文や```など）は一切書かないでください。",
      "",
      STANDARD_RULES_TEXT,
    ].join("\n");

    const listText = totals
      .map((t, idx) => {
        const main = t.main_type ? ` / ${t.main_type}` : "";
        return `[${idx}] category: ${t.category}${main}, unit: ${t.unit}, total: ${t.total}`;
      })
      .join("\n");

    const userPrompt = [
      "以下が工種別数量サマリです。",
      "各行ごとに { index, houkake, workers, note } を決めてください。",
      "",
      listText,
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0]?.message?.content;

    if (typeof content !== "string" || content.trim() === "") {
      console.error("auto-workrate: Empty content from OpenAI", completion);
      return NextResponse.json(
        {
          error: "AI 応答からテキストが取得できませんでした。",
        },
        { status: 500 }
      );
    }

    let parsedRoot: unknown;
    try {
      parsedRoot = JSON.parse(content);
    } catch (e) {
      console.error(
        "auto-workrate JSON parse error:",
        e,
        content.slice(0, 500)
      );
      return NextResponse.json(
        {
          error: "AI からの歩掛り提案(JSON)の解析に失敗しました。",
          detail: e instanceof Error ? e.message : "unknown json parse error",
        },
        { status: 500 }
      );
    }

    const rootObj = parsedRoot as { suggestions?: unknown };
    const suggestionsRaw = rootObj.suggestions;

    if (!Array.isArray(suggestionsRaw)) {
      return NextResponse.json(
        {
          error:
            "AI 応答の形式が不正です。(suggestions 配列が見つかりません)",
        },
        { status: 500 }
      );
    }

    const suggestions: WorkrateSuggestion[] = (suggestionsRaw as RawSuggestion[])
      .map((item): WorkrateSuggestion | null => {
        const index = Number(item.index);
        const houkake = Number(item.houkake);
        const workers = Number(item.workers);

        if (
          !Number.isFinite(index) ||
          !Number.isFinite(houkake) ||
          !Number.isFinite(workers)
        ) {
          return null;
        }

        const suggestion: WorkrateSuggestion = {
          index,
          houkake,
          workers,
        };

        if (typeof item.note === "string" && item.note.trim() !== "") {
          suggestion.note = item.note.trim();
        }

        return suggestion;
      })
      .filter((v): v is WorkrateSuggestion => v !== null);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("auto-workrate error:", err);
    return NextResponse.json(
      {
        error: "歩掛り自動提案の処理に失敗しました。",
        detail: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
