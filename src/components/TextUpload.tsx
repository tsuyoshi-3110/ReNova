"use client";

import React from "react";
import {
  AutoWorkrateResponse,
  ParamState,
  ParseSpecResponse,
  QuantitySummaryResponse,
  QuantityTotal,
  SpecItem,
  DurationResult,
} from "@/types/pdf";
import { extractAutoWorkrateSuggestions } from "./pdf/helper";

type Props = {
  setSummaryLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSummaryError: React.Dispatch<React.SetStateAction<string | null>>;
  setTotals: React.Dispatch<React.SetStateAction<QuantityTotal[] | null>>;
  setHoukakeInputs: React.Dispatch<React.SetStateAction<ParamState[]>>;
  setDurationLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setDurationError: React.Dispatch<React.SetStateAction<string | null>>;
  setDurationResults: React.Dispatch<React.SetStateAction<DurationResult[] | null>>;
  setTotalDaysSum: React.Dispatch<React.SetStateAction<number | null>>;
  setAiScheduleLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setAiScheduleError: React.Dispatch<React.SetStateAction<string | null>>;
  setAiScheduleRaw: React.Dispatch<React.SetStateAction<unknown | null>>;
  text: string;
  setItems: React.Dispatch<React.SetStateAction<SpecItem[] | null>>;
  setParseError: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  error: string | null;
  items: SpecItem[] | null;
  parseError: string | null;
};

export default function TextUpload({
  setSummaryLoading,
  setSummaryError,
  setTotals,
  setHoukakeInputs,
  setDurationError,
  setDurationResults,
  setTotalDaysSum,
  setAiScheduleLoading,
  setAiScheduleError,
  setAiScheduleRaw,
  text,
  setItems,
  setParseError,
  loading: summaryLoading,
  error: summaryError,
  items,
  parseError,
}: Props) {
  const [parsing, setParsing] = React.useState(false);

  // 抽出テキスト → 工種別数量サマリ & AI自動歩掛り
  const handleQuantitySummary = async () => {
    if (!text) {
      alert("先にPDFからテキストを抽出してください。");
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    setTotals(null);
    setHoukakeInputs([]);
    setDurationResults(null);
    setDurationError(null);
    setTotalDaysSum(null);
    setAiScheduleLoading(false);
    setAiScheduleError(null);
    setAiScheduleRaw(null);

    try {
      // 1) 行単位解析
      let currentItems: SpecItem[] | null = items;

      if (!currentItems) {
        const parseRes = await fetch("/api/renova/parse-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        const parseData = (await parseRes.json()) as ParseSpecResponse;

        if (!parseRes.ok) {
          throw new Error(parseData.detail || parseData.error || "数量解析APIエラー");
        }

        const parsedItems = Array.isArray(parseData.items) ? parseData.items : [];
        currentItems = parsedItems;
        setItems(parsedItems);
      }

      if (!currentItems || currentItems.length === 0) {
        throw new Error("数量行が取得できませんでした。");
      }

      // 2) 工種別数量サマリ
      const summaryRes = await fetch("/api/renova/quantity-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: currentItems }),
      });

      const summaryData = (await summaryRes.json()) as QuantitySummaryResponse;

      if (!summaryRes.ok) {
        throw new Error(summaryData.detail || summaryData.error || "工種別サマリAPIエラー");
      }

      const totals = Array.isArray(summaryData.totals) ? summaryData.totals : [];
      setTotals(totals);

      let initialInputs: ParamState[] = totals.map(() => ({
        houkake: "",
        workers: "",
      }));

      // 3) AI に歩掛り・人数を自動提案させる
      try {
        const autoRes = await fetch("/api/renova/auto-workrate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totals }),
        });

        if (autoRes.ok) {
          let autoData: AutoWorkrateResponse | null = null;

          try {
            autoData = (await autoRes.json()) as AutoWorkrateResponse;
          } catch (e) {
            console.warn("auto-workrate JSON parse error:", e);
          }

          console.log("auto-workrate response:", autoData);

          const suggestions = extractAutoWorkrateSuggestions(autoData);

          initialInputs = totals.map((_, idx) => {
            const s = suggestions.find((it) => it.index === idx);
            return s
              ? { houkake: String(s.houkake), workers: String(s.workers) }
              : { houkake: "", workers: "" };
          });
        } else {
          const textBody = await autoRes.text();
          console.warn("auto-workrate status:", autoRes.status, "body:", textBody);
        }
      } catch (e) {
        console.warn("auto-workrate fetch error, 手入力にフォールバック:", e);
      }

      setHoukakeInputs(initialInputs);
    } catch (err) {
      console.error(err);
      setSummaryError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSummaryLoading(false);
    }
  };

  // 抽出テキスト → 行単位の数量JSON（デバッグ用）
  const handleParseSpec = async () => {
    if (!text) {
      alert("先にPDFからテキストを抽出してください。");
      return;
    }

    setParsing(true);
    setParseError(null);
    setItems(null);

    try {
      const res = await fetch("/api/renova/parse-spec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = (await res.json()) as ParseSpecResponse;

      if (!res.ok) {
        throw new Error(data.detail || data.error || "API Error");
      }

      const parsedItems = Array.isArray(data.items) ? data.items : [];
      setItems(parsedItems);
    } catch (err) {
      console.error(err);
      setParseError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setParsing(false);
    }
  };

  return (
    <div>
      {text && (
        <section className="space-y-2 border rounded p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold">2. 抽出されたテキスト</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleParseSpec}
                disabled={parsing}
                className={`rounded px-3 py-1.5 text-white text-xs ${
                  parsing ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {parsing ? "数量解析中..." : "行単位の数量解析（デバッグ用）"}
              </button>

              <button
                type="button"
                onClick={handleQuantitySummary}
                disabled={summaryLoading}
                className={`rounded px-3 py-1.5 text-white text-xs ${
                  summaryLoading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {summaryLoading
                  ? "工種別数量サマリ作成中..."
                  : "工種別数量サマリを作成（AIが歩掛りを自動入力）"}
              </button>
            </div>
          </div>

          <textarea
            className="w-full h-72 border rounded p-2 text-xs whitespace-pre-wrap bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            value={text}
            readOnly
          />

          {parseError && (
            <p className="text-xs text-red-500 dark:text-red-400">数量解析エラー: {parseError}</p>
          )}
          {summaryError && (
            <p className="text-xs text-red-500 dark:text-red-400">
              工種別数量サマリエラー: {summaryError}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
