// src/types/pdf.ts の中の SpecItem をこれに差し替え

export type SpecItem = {
  /** 見出し行（例: "A 共通仮設工事"、"B 直接仮設工事" など） */
  section: string;
  /** 明細行テキスト（仕様名＋サイズ＋説明など、行全体） */
  name: string;
  /** 単位（㎡, m, m2, 式, ヶ所, 段, 枚 など） */
  unit: string;
  /** 数量（カンマなしの数値） */
  quantity: number;

  /** 仕様番号（例: "RP-1", "床-3", "防水-1"。無ければ null） */
  specCode?: string | null;

  /** 長さ[m]（必要な場合のみ。単位が m のときなど） */
  length_m?: number | null;
  /** 巾(幅)[m]（W, 巾, 幅, 糸幅 などから推定。単位省略は mm 想定） */
  width_m?: number | null;
  /** 高さ[m]（H など） */
  height_m?: number | null;
  /** 奥行き/出[m]（D, 奥行き など） */
  depth_m?: number | null;
  /** 段数（階段など "○段" の数） */
  steps?: number | null;

  /**
   * AI が推定した塗り面積[m²]
   * - 単位が ㎡ の行 → quantity をそのまま
   * - 単位が m の行 → 長さ × 巾 で算出
   * - W×H×D の箱 → 5面分の表面積 × 個数（あいまいなら null）
   */
  estimated_area_m2?: number | null;

  /** ㎡に変換できなかった理由などのメモ（例: "段数なのでm²にしない"） */
  unit_note?: string | null;
};


export type QuantityTotal = {
  category: string; // 例: "屋上防水工事（アスファルト）"
  main_type?: string | null; // 例: "アスファルト防水"
  unit: string; // "㎡" / "ｍ" / "ヶ所" / "段" など
  total: number; // 合計数量
};

export type DurationResult = {
  category: string;
  main_type?: string | null;
  unit: string;
  total_quantity: number;
  houkake?: number;
  workers?: number;
  capacity_per_day?: number;
  days?: number;
  note?: string;
};

export type ParamState = {
  houkake: string; // 入力用（文字列）
  workers: string; // 入力用（文字列）
};

// AI の歩掛り自動提案 API の戻り値想定
export type AutoWorkrateSuggestion = {
  index: number;
  houkake: number;
  workers: number;
  note?: string;
};

// -------- AI工程表プレビュー用（ざっくり型） --------
export type AiScheduleSection = {
  id?: string;
  title?: string;
  items?: {
    id?: string;
    label?: string;
    name?: string;
    phase?: string;
    startOffset?: number; // 0 起算
    duration?: number; // 日数
    days?: number; // duration の別名として来るかもしれない
  }[];
};

export type AiScheduleResponse = {
  sections?: AiScheduleSection[];
  [key: string]: unknown;
};

// --- API レスポンス型（any 回避用の最低限） ---
export type PdfApiResponse = {
  text?: string;
  error?: string;
  detail?: string;
};

export type ParseSpecResponse = {
  items?: SpecItem[];
  error?: string;
  detail?: string;
};

export type QuantitySummaryResponse = {
  totals?: QuantityTotal[];
  error?: string;
  detail?: string;
};

export type AutoWorkrateResponse = {
  suggestions?: unknown;
  error?: string;
  detail?: string;
};

export type DurationSummaryResponse = {
  results?: DurationResult[];
  total_days_sum?: number;
  error?: string;
  detail?: string;
};

export type AutoScheduleApiResponse = {
  error?: string;
  detail?: string;
  [key: string]: unknown;
};
