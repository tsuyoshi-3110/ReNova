// src/app/renova/pdf-test/page.tsx
"use client";

import { useMemo, useState } from "react";

import {
  type SpecItem,
  type QuantityTotal,
  type DurationResult,
  type ParamState,
} from "@/types/pdf";

import PdfForeText from "@/components/PDFForeText";
import TextUpload from "@/components/TextUpload";
import ItemsSummarySection from "@/components/ItemsSummarySection";
import WorkrateSummarySection from "@/components/WorkrateSummarySection";
import RenovaHeader from "@/components/RenovaHeader";
import { buildSpecCodeSummary } from "@/lib/specCodeSummary";

// 1行あたりの「推定㎡」を出すヘルパー
// - まずは AI が返した estimated_area_m2 を優先的に使用
// - 無い場合だけ、従来どおり unit と name から簡易推定


/** 仕様番号のハイフンを正規化 */
function normalizeHyphen(s: string): string {
  return s.replace(/[－―ー−]/g, "-");
}

/**
 * 1行の SpecItem から、できるだけ安定して「仕様番号」を推定する。
 * - API が specCode を返していればそれを優先
 * - 無い場合は name の先頭から RP-1 / 床-2 / 防水-3 / 樹脂注入-16 などを正規表現で拾う
 * - H-5 のような一文字＋数字の怪しいコードは採用しない
 */
function guessSpecCode(it: SpecItem): string | null {
  // SpecItem に specCode があるかどうかを安全に見る
  let rawFromApi = "";

  if ("specCode" in it) {
    const value = (it as { specCode?: unknown }).specCode;
    if (typeof value === "string") {
      rawFromApi = value;
    } else if (value != null) {
      rawFromApi = String(value);
    }
  }

  const cleanedFromApi = normalizeHyphen(rawFromApi).replace(/\s+/g, "").trim();
  if (cleanedFromApi) {
    return cleanedFromApi;
  }

  const name = (it.name ?? "").trim();
  if (!name) return null;

  // 先頭の「◎」などを除去
  const head = name.replace(/^[◎○●◇◆・]/, "");

  // 英字2文字以上＋ハイフン＋数字 (RP-1 / RP-11 など) or W-18 を許容
  const alphaMatch = head.match(/^((?:[A-Z]{2,}|W)[\-－―ー−]\d{1,3})/);
  if (alphaMatch) {
    return normalizeHyphen(alphaMatch[1]).replace(/\s+/g, "");
  }

  // 漢字1〜4文字＋ハイフン＋数字 (床-1 / 防水-2 / 樹脂注入-16 / 常駐管理-1 など)
  const kanjiMatch = head.match(/^([\u4E00-\u9FFF々]{1,4})[\-－―ー−](\d{1,3})/);
  if (kanjiMatch) {
    const combined = `${kanjiMatch[1]}-${kanjiMatch[2]}`;
    return normalizeHyphen(combined).replace(/\s+/g, "");
  }

  // その他は仕様番号なし扱い
  return null;
}

export default function PdfTestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [parseError, setParseError] = useState<string | null>(null);
  const [items, setItems] = useState<SpecItem[] | null>(null);

  // 工種別数量サマリ
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [totals, setTotals] = useState<QuantityTotal[] | null>(null);

  // 歩掛り・人数入力（AIの提案を初期値として入れる）
  const [houkakeInputs, setHoukakeInputs] = useState<ParamState[]>([]);

  // 日数計算
  const [durationLoading, setDurationLoading] = useState(false);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [durationResults, setDurationResults] = useState<
    DurationResult[] | null
  >(null);
  const [totalDaysSum, setTotalDaysSum] = useState<number | null>(null);

  // AI工程表案
  const [aiScheduleLoading, setAiScheduleLoading] = useState(false);
  const [aiScheduleError, setAiScheduleError] = useState<string | null>(null);
  const [aiScheduleRaw, setAiScheduleRaw] = useState<unknown | null>(null);

  // ダークモード（このページ内だけ）
  const [isDark, setIsDark] = useState(false);

  // ★ キーワード別㎡合計用
  const [keyword, setKeyword] = useState("");
  const [keywordArea, setKeywordArea] = useState<number | null>(null);
  const [keywordAreaError, setKeywordAreaError] = useState<string | null>(null);

  // ★ 算出された日数を元に AI に工程表案を作らせて保存 ＋ プレビュー



  // ✅ ここで buildSpecCodeSummary を使用
  const specCodeSummary = useMemo(() => {
    if (!items || items.length === 0) return [];
    return buildSpecCodeSummary(items, guessSpecCode, "仕様番号なし");
  }, [items]);

  return (
    // ここで isDark に応じて .dark クラスを付ける（このページだけ）
    <div className={isDark ? "dark" : ""}>
      <main className="max-w-4xl mx-auto p-4 space-y-6 min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {/* 上部ヘッダー＋トグルボタン */}
        <RenovaHeader isDark={isDark} setIsDark={setIsDark} />
        {/* 2. 抽出テキスト表示 ＆ ボタン */}

        <PdfForeText
          file={file}
          setFile={setFile}
          setLoading={setLoading}
          setError={setError}
          setText={setText}
          setItems={setItems}
          setParseError={setParseError}
          setSummaryLoading={setSummaryLoading}
          setSummaryError={setSummaryError}
          setTotals={setTotals}
          setHoukakeInputs={setHoukakeInputs}
          setDurationLoading={setDurationLoading}
          setDurationError={setDurationError}
          setDurationResults={setDurationResults}
          setTotalDaysSum={setTotalDaysSum}
          setAiScheduleLoading={setAiScheduleLoading}
          setAiScheduleError={setAiScheduleError}
          setAiScheduleRaw={setAiScheduleRaw}
          setKeyword={setKeyword}
          setKeywordArea={setKeywordArea}
          setKeywordAreaError={setKeywordAreaError}
          loading={loading}
          error={error}
        />

         <TextUpload
          setSummaryLoading={setSummaryLoading}
          setSummaryError={setSummaryError}
          setTotals={setTotals}
          setHoukakeInputs={setHoukakeInputs}
          setDurationLoading={() => {}} // 使わないなら空関数OK
          setDurationError={setDurationError}
          setDurationResults={setDurationResults}
          setTotalDaysSum={setTotalDaysSum}
          setAiScheduleLoading={setAiScheduleLoading}
          setAiScheduleError={setAiScheduleError}
          setAiScheduleRaw={setAiScheduleRaw}
          text={text}
          setItems={setItems}
          setParseError={setParseError}
          loading={summaryLoading}
          error={summaryError}
          items={items}
          parseError={parseError}
        />
        {/* 行単位の数量解析（デバッグ用）＋ 仕様番号別サマリ */}
        <ItemsSummarySection
          items={items}
          keyword={keyword}
          setKeyword={setKeyword}
          keywordAreaError={keywordAreaError}
          keywordArea={keywordArea}
          setKeywordAreaError={setKeywordAreaError}
          setKeywordArea={setKeywordArea}
          specCodeSummary={specCodeSummary}
          guessSpecCode={guessSpecCode}
          text={text}
          setItems={setItems}
        />
        {/* 3. 工種別数量サマリ ＋ 歩掛り・人数入力 ＋ 日数計算 */}
        {totals && totals.length > 0 && (
          <WorkrateSummarySection
            totals={totals}
            houkakeInputs={houkakeInputs}
            setHoukakeInputs={setHoukakeInputs}
            durationLoading={durationLoading}
            setDurationLoading={setDurationLoading}
            durationError={durationError}
            setDurationError={setDurationError}
            durationResults={durationResults}
            setDurationResults={setDurationResults}
            totalDaysSum={totalDaysSum}
            setTotalDaysSum={setTotalDaysSum}
            aiScheduleLoading={aiScheduleLoading}
            setAiScheduleLoading={setAiScheduleLoading}
            aiScheduleError={aiScheduleError}
            setAiScheduleError={setAiScheduleError}
            aiScheduleRaw={aiScheduleRaw}
            setAiScheduleRaw={setAiScheduleRaw}
          />
        )}
      </main>
    </div>
  );
}
