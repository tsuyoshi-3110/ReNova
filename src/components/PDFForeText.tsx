// src/components/pdf/PdfForeText.tsx
import React from "react";
import type {
  PdfApiResponse,
  SpecItem,
  QuantityTotal,
  ParamState,
  DurationResult,
} from "@/types/pdf";

type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

type Props = {
  file: File | null;
  setFile: Setter<File | null>;

  setLoading: Setter<boolean>;
  setError: Setter<string | null>;
  setText: Setter<string>;
  setItems: Setter<SpecItem[] | null>;
  setParseError: Setter<string | null>;

  setSummaryLoading: Setter<boolean>;
  setSummaryError: Setter<string | null>;
  setTotals: Setter<QuantityTotal[] | null>;
  setHoukakeInputs: Setter<ParamState[]>;

  setDurationLoading: Setter<boolean>;
  setDurationError: Setter<string | null>;
  setDurationResults: Setter<DurationResult[] | null>;
  setTotalDaysSum: Setter<number | null>;

  setAiScheduleLoading: Setter<boolean>;
  setAiScheduleError: Setter<string | null>;
  setAiScheduleRaw: Setter<unknown | null>; // unknown なら no-explicit-any に怒られない

  setKeyword: Setter<string>;
  setKeywordArea: Setter<number | null>;
  setKeywordAreaError: Setter<string | null>;

  loading: boolean;
  error: string | null;
};

const PdfForeText: React.FC<Props> = ({
  setLoading,
  setError,
  setText,
  setItems,
  setParseError,
  file,
  setSummaryLoading,
  setSummaryError,
  setTotals,
  setHoukakeInputs,
  setDurationLoading,
  setDurationError,
  setDurationResults,
  setTotalDaysSum,
  setAiScheduleLoading,
  setAiScheduleError,
  setAiScheduleRaw,
  setKeyword,
  setKeywordArea,
  setKeywordAreaError,
  setFile,
  loading,
  error,
}) => {
  // PDF → テキスト抽出
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      alert("PDFファイルを選択してください。");
      return;
    }

    setLoading(true);
    setError(null);
    setText("");
    setItems(null);
    setParseError(null);

    // サマリ系もリセット
    setSummaryLoading(false);
    setSummaryError(null);
    setTotals(null);
    setHoukakeInputs([]);
    setDurationLoading(false);
    setDurationError(null);
    setDurationResults(null);
    setTotalDaysSum(null);
    setAiScheduleLoading(false);
    setAiScheduleError(null);
    setAiScheduleRaw(null);
    setKeyword("");
    setKeywordArea(null);
    setKeywordAreaError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/renova/pdf", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as PdfApiResponse;

      if (!res.ok) {
        throw new Error(data.detail || data.error || "API Error");
      }

      setText(data.text ?? "");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-3 border rounded p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <h2 className="font-semibold">1. PDFアップロード → テキスト抽出</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
            }}
            className="text-sm text-gray-800 dark:text-gray-100"
          />
        </div>

        <button
          type="submit"
          disabled={!file || loading}
          className={`rounded px-4 py-2 text-white text-sm ${
            !file || loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {loading ? "解析中..." : "アップロードして解析"}
        </button>
      </form>

      {error && (
        <p className="text-sm text-red-500 dark:text-red-400">
          エラー: {error}
        </p>
      )}
    </section>
  );
};

export default PdfForeText;
