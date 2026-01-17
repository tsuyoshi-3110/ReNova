// src/components/renova/ItemsSummarySection.tsx

import React from "react";
import type { SpecItem, ParseSpecResponse } from "@/types/pdf";
import { estimateAreaFromSpecItem } from "@/lib/renova/specUtils";
import type { SpecCodeSummaryRow } from "@/lib/specCodeSummary";

type Props = {
  items: SpecItem[] | null;
  keyword: string;
  setKeyword: React.Dispatch<React.SetStateAction<string>>;
  keywordAreaError: string | null;
  keywordArea: number | null;
  setKeywordAreaError: React.Dispatch<React.SetStateAction<string | null>>;
  setKeywordArea: React.Dispatch<React.SetStateAction<number | null>>;
  specCodeSummary: SpecCodeSummaryRow[];
  guessSpecCode: (item: SpecItem) => string | null | undefined;

  // ここからは「念のため items が未取得のとき parse-spec を呼ぶ」ために必要なもの
  text: string;
  setItems: React.Dispatch<React.SetStateAction<SpecItem[] | null>>;
};

const ItemsSummarySection: React.FC<Props> = ({
  items,
  keyword,
  setKeyword,
  keywordAreaError,
  keywordArea,
  setKeywordAreaError,
  setKeywordArea,
  specCodeSummary,
  guessSpecCode,
  text,
  setItems,
}) => {
  // items が無いときは何も表示しない（ボタンも出さない）
  if (!items || items.length === 0) return null;

  // ★ キーワードで行を絞って㎡合計
  const handleKeywordAreaSum = async () => {
    const key = keyword.trim();
    if (!key) {
      alert("キーワードを入力してください。");
      return;
    }

    setKeywordAreaError(null);
    setKeywordArea(null);

    try {
      // 現在の items をベースにする
      let currentItems: SpecItem[] | null = items;

      // 念のため items が未取得で、テキストだけある場合は parse-spec を呼ぶ
      if (!currentItems) {
        if (!text) {
          throw new Error("先にPDFからテキストを抽出してください。");
        }

        const res = await fetch("/api/renova/parse-spec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });

        const data = (await res.json()) as ParseSpecResponse;

        if (!res.ok) {
          throw new Error(data.detail || data.error || "数量解析APIエラー");
        }

        currentItems = Array.isArray(data.items) ? data.items : [];
        setItems(currentItems);
      }

      if (!currentItems || currentItems.length === 0) {
        throw new Error("数量行が取得できませんでした。");
      }

      const lowerKey = key.toLowerCase();

      // キーワードを含む行だけフィルタ（name に対して）
      const matched = currentItems.filter((it) =>
        it.name.toLowerCase().includes(lowerKey)
      );

      if (matched.length === 0) {
        setKeywordArea(0);
        return;
      }

      // 行ごとの推定㎡を合計
      const totalArea = matched.reduce((sum, it) => {
        const area = estimateAreaFromSpecItem(it);
        return sum + (area ?? 0);
      }, 0);

      setKeywordArea(totalArea);
    } catch (e) {
      console.error("handleKeywordAreaSum error:", e);
      setKeywordAreaError(
        e instanceof Error
          ? e.message
          : "キーワード別㎡合計の計算に失敗しました。"
      );
    }
  };

  return (
    <>
      {/* 行単位の数量解析（デバッグ用）＋ 仕様番号別サマリ */}
      <section className="space-y-2 border rounded p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-sm">行単位の数量解析結果（サマリ）</h2>
        <div className="border rounded p-2 max-h-80 overflow-auto text-xs bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          {items.map((it, idx) => {
            const code = guessSpecCode(it);
            return (
              <div
                key={`${it.section}-${it.name}-${idx}`}
                className="py-1 border-b last:border-b-0 border-gray-200 dark:border-gray-700"
              >
                <div className="font-semibold text-[11px] text-gray-700 dark:text-gray-100">
                  {it.section}
                </div>
                <div className="text-gray-900 dark:text-gray-100">
                  {it.name}
                </div>
                <div className="text-[11px] text-gray-600 dark:text-gray-300">
                  {it.quantity} {it.unit}
                  {code ? ` ／ 仕様番号: ${code}` : ""}
                </div>
              </div>
            );
          })}
        </div>

        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-gray-600 dark:text-gray-300">
            JSON を表示（デバッグ用）
          </summary>
          <pre className="mt-1 p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-auto">
            {JSON.stringify(items, null, 2)}
          </pre>
        </details>

        {/* ★ キーワードで行を絞り込んで㎡合計 */}
        <div className="mt-3 border-t pt-2 border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-xs mb-1">
            キーワードで行を絞り込んで㎡合計
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="例）溝防水、屋上防水、長尺シート、防水-1 など"
              className="flex-1 min-w-[140px] border rounded px-2 py-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              type="button"
              onClick={handleKeywordAreaSum}
              className="rounded px-3 py-1.5 text-white bg-purple-600 hover:bg-purple-700"
            >
              ㎡合計を計算
            </button>
          </div>

          {keywordAreaError && (
            <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
              {keywordAreaError}
            </p>
          )}

          {keywordArea !== null && (
            <p className="mt-1 text-[11px] text-gray-800 dark:text-gray-100">
              「{keyword}」を含む行の推定合計：
              <span className="font-semibold">
                {keywordArea.toFixed(2)} ㎡
              </span>
            </p>
          )}
        </div>

        {/* ★ 仕様番号別 推定数量サマリ */}
        {specCodeSummary.length > 0 && (
          <div className="mt-3 border-t pt-2 border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-xs mb-1">
              仕様番号別 推定数量サマリ（㎡＋段数など）
            </h3>
            <div className="border rounded bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-[11px]">
              {specCodeSummary.map((row) => (
                <div
                  key={row.code}
                  className="flex items-center justify-between px-2 py-1 border-b last:border-b-0 border-gray-200 dark:border-gray-700"
                >
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {row.code}
                  </span>
                  <span className="text-gray-800 dark:text-gray-100">
                    {row.mainText}
                    <span className="ml-1 text-[10px] text-gray-500 dark:text-gray-400">
                      ({row.lineCount}行)
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
              ※ 単位が m の行は、行内のサイズ（例: 300mm, 0.6m）から幅を推定して㎡換算しています。
              サイズの記載が無い行や、段数・式などの行は元の単位のまま集計しています。
            </p>
          </div>
        )}
      </section>
    </>
  );
};

export default ItemsSummarySection;
