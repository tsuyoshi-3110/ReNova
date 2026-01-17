// src/components/renova/WorkrateSummarySection.tsx

import React from "react";
import type {
  QuantityTotal,
  ParamState,
  DurationResult,
  DurationSummaryResponse,
  AutoScheduleApiResponse,
} from "@/types/pdf";
import AiSchedulePreview from "./pdf/AiSchedulePreview";

type Props = {
  totals: QuantityTotal[];
  houkakeInputs: ParamState[];
  setHoukakeInputs: React.Dispatch<React.SetStateAction<ParamState[]>>;

  durationLoading: boolean;
  setDurationLoading: React.Dispatch<React.SetStateAction<boolean>>;
  durationError: string | null;
  setDurationError: React.Dispatch<React.SetStateAction<string | null>>;
  durationResults: DurationResult[] | null;
  setDurationResults: React.Dispatch<
    React.SetStateAction<DurationResult[] | null>
  >;
  totalDaysSum: number | null;
  setTotalDaysSum: React.Dispatch<React.SetStateAction<number | null>>;

  aiScheduleLoading: boolean;
  setAiScheduleLoading: React.Dispatch<React.SetStateAction<boolean>>;
  aiScheduleError: string | null;
  setAiScheduleError: React.Dispatch<React.SetStateAction<string | null>>;
  aiScheduleRaw: unknown | null;
  setAiScheduleRaw: React.Dispatch<React.SetStateAction<unknown | null>>;
};

const WorkrateSummarySection: React.FC<Props> = ({
  totals,
  houkakeInputs,
  setHoukakeInputs,
  durationLoading,
  setDurationLoading,
  durationError,
  setDurationError,
  durationResults,
  setDurationResults,
  totalDaysSum,
  setTotalDaysSum,
  aiScheduleLoading,
  setAiScheduleLoading,
  aiScheduleError,
  setAiScheduleError,
  aiScheduleRaw,
  setAiScheduleRaw,
}) => {
  // 工種別数量 ＋ 歩掛り・人数 → 日数計算
  const handleDurationSummary = async () => {
    if (!totals || totals.length === 0) {
      alert("先に工種別数量サマリを作成してください。");
      return;
    }

    setDurationLoading(true);
    setDurationError(null);
    setDurationResults(null);
    setTotalDaysSum(null);
    setAiScheduleLoading(false);
    setAiScheduleError(null);
    setAiScheduleRaw(null);

    try {
      // 入力された行だけ params にする
      const params = totals
        .map((t, idx) => {
          const p = houkakeInputs[idx];
          if (!p) return null;

          const houkake = Number(p.houkake);
          const workers = Number(p.workers);

          if (!Number.isFinite(houkake) || houkake <= 0) return null;
          if (!Number.isFinite(workers) || workers <= 0) return null;

          return {
            category: t.category,
            main_type: t.main_type ?? null,
            unit: t.unit,
            houkake,
            workers,
          };
        })
        .filter(
          (
            v
          ): v is {
            category: string;
            main_type: string | null;
            unit: string;
            houkake: number;
            workers: number;
          } => v !== null
        );

      const res = await fetch("/api/renova/duration-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totals, params }),
      });

      const data = (await res.json()) as DurationSummaryResponse;

      if (!res.ok) {
        throw new Error(data.detail || data.error || "API Error");
      }

      setDurationResults(data.results ?? null);
      setTotalDaysSum(
        typeof data.total_days_sum === "number" ? data.total_days_sum : null
      );
    } catch (err) {
      console.error(err);
      setDurationError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDurationLoading(false);
    }
  };

  // 工種別日数結果 → AI工程表案生成
  const handleSaveAiSchedule = async () => {
    if (!durationResults || durationResults.length === 0) {
      alert("先に『必要日数を計算』を実行してください。");
      return;
    }

    setAiScheduleLoading(true);
    setAiScheduleError(null);

    try {
      const res = await fetch("/api/renova/auto-schedule-from-duration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationResults }),
      });

      const raw = (await res.json()) as AutoScheduleApiResponse;

      if (!res.ok) {
        const errMsg =
          typeof raw === "object" && raw !== null && "error" in raw
            ? String(
                (raw as { error?: unknown; detail?: unknown }).error ??
                  (raw as { detail?: unknown }).detail ??
                  "API Error"
              )
            : "API Error";
        throw new Error(errMsg);
      }

      setAiScheduleRaw(raw);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("renova_ai_schedule", JSON.stringify(raw));
      }
    } catch (e) {
      console.error("handleSaveAiSchedule error:", e);
      setAiScheduleError(
        e instanceof Error ? e.message : "AI工程表案の生成に失敗しました。"
      );
    } finally {
      setAiScheduleLoading(false);
    }
  };

  // 1行の DurationResult を totals の行から探すヘルパー
  const findDurationFor = (
    t: QuantityTotal
  ): DurationResult | undefined => {
    if (!durationResults) return undefined;
    return durationResults.find(
      (r) =>
        r.category === t.category &&
        (r.main_type ?? "") === (t.main_type ?? "") &&
        r.unit === t.unit
    );
  };

  return (
    <section className="space-y-3 border rounded p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold">
            3. 工種別数量サマリ ＋ 歩掛り・人数入力
          </h2>
          <p className="text-[11px] text-gray-600 dark:text-gray-300">
            ※ AI の提案値は上書きして調整できます。
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleDurationSummary}
            disabled={durationLoading}
            className={`rounded px-3 py-1.5 text-white text-xs ${
              durationLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {durationLoading ? "日数計算中..." : "必要日数を計算"}
          </button>

          {/* AI工程表案を保存＋プレビュー */}
          <button
            type="button"
            onClick={handleSaveAiSchedule}
            disabled={
              !durationResults ||
              durationResults.length === 0 ||
              aiScheduleLoading
            }
            className={`rounded px-3 py-1.5 text白 text-xs ${
              !durationResults ||
              durationResults.length === 0 ||
              aiScheduleLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {aiScheduleLoading
              ? "AI工程表案作成中..."
              : "AI工程表案を作成・保存"}
          </button>
        </div>
      </div>

      {durationError && (
        <p className="text-xs text-red-500 dark:text-red-400">
          日数計算エラー: {durationError}
        </p>
      )}

      <div className="space-y-2 max-h-[420px] overflow-auto text-xs">
        {totals.map((t, idx) => {
          const input = houkakeInputs[idx] ?? {
            houkake: "",
            workers: "",
          };
          const d = findDurationFor(t);

          return (
            <div
              key={`${t.category}-${t.main_type ?? ""}-${t.unit}-${idx}`}
              className="border rounded p-2 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
            >
              <div className="font-semibold text-[12px] text-gray-800 dark:text-gray-100">
                {t.category}
                {t.main_type ? `（${t.main_type}）` : ""}
              </div>
              <div className="text-[11px] text-gray-700 dark:text-gray-300">
                合計数量: {t.total} {t.unit}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-700 dark:text-gray-300">
                    歩掛り
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={input.houkake}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHoukakeInputs((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...(next[idx] ?? {
                            houkake: "",
                            workers: "",
                          }),
                          houkake: value,
                        };
                        return next;
                      });
                    }}
                    placeholder="数量/人日"
                    className="w-24 border rounded px-2 py-1 text-[11px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-gray-700 dark:text-gray-300">
                    人数
                  </span>
                  <input
                    type="number"
                    step="1"
                    min={0}
                    value={input.workers}
                    onChange={(e) => {
                      const value = e.target.value;
                      setHoukakeInputs((prev) => {
                        const next = [...prev];
                        next[idx] = {
                          ...(next[idx] ?? {
                            houkake: "",
                            workers: "",
                          }),
                          workers: value,
                        };
                        return next;
                      });
                    }}
                    placeholder="人"
                    className="w-16 border rounded px-2 py-1 text-[11px] bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {d && (
                  <div className="flex flex-col gap-1 mt-1 text-[11px] text-gray-800 dark:text-gray-100">
                    {typeof d.capacity_per_day === "number" && (
                      <div>
                        1日あたり施工量: {d.capacity_per_day} {t.unit}/日
                      </div>
                    )}
                    {typeof d.days === "number" && (
                      <div>必要日数: {d.days} 日</div>
                    )}
                    {d.note && (
                      <div className="text-[11px] text-red-600 dark:text-red-400">
                        ※ {d.note}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {totalDaysSum !== null && (
        <div className="mt-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          全工種の必要日数合計（歩掛りと人数を入力した工種のみ集計）:{" "}
          {totalDaysSum} 日
        </div>
      )}

      {/* AI工程表案のエラー表示 */}
      {typeof aiScheduleError === "string" && (
        <p className="text-xs text-red-500 dark:text-red-400">
          AI工程表案エラー: {aiScheduleError}
        </p>
      )}

      {/* AI工程表案プレビュー */}
      {aiScheduleRaw !== null && (
        <div className="mt-4 border-t pt-3 border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-sm mb-1">
            4. AI工程表案プレビュー（/auto-schedule-from-duration の結果）
          </h3>
          <AiSchedulePreview data={aiScheduleRaw} />
          <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">
            ※ このデータは localStorage(<code>renova_ai_schedule</code>) にも保存され、
            /schedule ページで読み込めます。
          </p>
        </div>
      )}
    </section>
  );
};

export default WorkrateSummarySection;
