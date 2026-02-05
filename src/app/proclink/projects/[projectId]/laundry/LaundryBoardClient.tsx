"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LaundryBoardConfig, LaundryStatus } from "./types";
import {
  getLaundryConfigByProject,
  setLaundryStatusMapByProject,
  subscribeLaundryStatusMapByProject,
} from "./laundryFirestore";

import {
  STATUS_HELP,
  STATUS_LABEL,
  buildRooms,
  calcIndent,
  calcMaxRooms,
  isDateKey,
  nextStatus,
} from "./utils";

export default function LaundryBoardClient({
  projectId,
  mode,
  dateKey,
  onDateKeyChange,
}: {
  projectId: string;
  mode: "admin" | "resident";
  dateKey: string;
  onDateKeyChange?: (next: string) => void;
}) {
  const [config, setConfig] = useState<LaundryBoardConfig | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const floors = config?.floors ?? [];
  const maxRooms = useMemo(() => calcMaxRooms(floors), [floors]);

  // Firestoreにその日付が「存在するか」
  const [isSaved, setIsSaved] = useState<boolean>(false);

  // Firestoreから来た「保存済み」
  const [savedMap, setSavedMap] = useState<Record<string, LaundryStatus>>({});

  // 画面で編集している（未保存含む）
  const [draftMap, setDraftMap] = useState<Record<string, LaundryStatus>>({});

  // 未保存変更フラグ
  const isDirty = useMemo(() => {
    return JSON.stringify(savedMap) !== JSON.stringify(draftMap);
  }, [savedMap, draftMap]);

  // config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getLaundryConfigByProject(projectId);
      if (!cancelled) setConfig(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // status subscribe（existsも見る）
  useEffect(() => {
    if (!isDateKey(dateKey)) return;

    const unsub = subscribeLaundryStatusMapByProject(projectId, dateKey, ({ map, exists }) => {
      setIsSaved(exists);
      setSavedMap(map);
      setDraftMap(map); // 日付切り替え時はその日の内容を編集開始
    });

    return () => unsub();
  }, [projectId, dateKey]);

  function toggleOne(roomId: string) {
    setDraftMap((prev) => {
      const cur = prev[roomId] ?? "ok";
      const next = nextStatus(cur);
      return { ...prev, [roomId]: next };
    });
  }

  async function save() {
    try {
      await setLaundryStatusMapByProject(projectId, dateKey, draftMap);
      setSavedMap(draftMap);
      setIsSaved(true);
      window.alert(isSaved ? "更新しました。" : "新規作成しました。");
    } catch (e) {
      window.alert(`保存失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!config) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
          まだ掲示板が作成されていません。
        </div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          先に「作成ページ」で階数・部屋数を設定してください。
        </div>

        <div className="mt-4">
          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/laundry/setup`}
            className="inline-flex rounded-xl bg-black px-4 py-2 text-sm font-extrabold text-white dark:bg-white dark:text-gray-900"
          >
            掲示板を作成する
          </Link>
        </div>
      </div>
    );
  }

  // ★ 未保存ならヘッダー背景を変える（管理者だけ）
  const headerTone =
    mode === "admin" && !isSaved
      ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950"
      : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900";

  const badge =
    mode === "admin" ? (
      <span
        className={[
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold",
          isSaved
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
            : "border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-100",
        ].join(" ")}
      >
        {isSaved ? "保存済み" : "未保存（まだ作成されていません）"}
      </span>
    ) : null;

  return (
    <div className="space-y-3">
      {/* 上部操作 */}
      <div
        className={[
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3",
          headerTone,
        ].join(" ")}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
            日付
          </div>

          <input
            type="date"
            value={dateKey}
            onChange={(e) => {
              const v = e.target.value;
              if (!isDateKey(v)) return;

              if (mode === "admin" && isDirty) {
                const ok = window.confirm("未保存の変更があります。日付を切り替えますか？");
                if (!ok) return;
              }

              onDateKeyChange?.(v);
            }}
            disabled={mode === "resident"}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100"
          />

          {badge}
        </div>

        <div className="flex items-center gap-2">
          {mode === "admin" && (
            <button
              type="button"
              onClick={save}
              disabled={!isDirty && isSaved} // 保存済み&変更なしなら押せない（未保存は押せる）
              className={[
                "rounded-xl px-4 py-2 text-sm font-extrabold",
                !isDirty && isSaved
                  ? "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                  : "bg-black text-white dark:bg-white dark:text-gray-900",
              ].join(" ")}
            >
              {isSaved ? (isDirty ? "保存（更新）" : "保存済み") : "保存（新規作成）"}
            </button>
          )}

          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/laundry/setup`}
            className="inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            掲示板の作成/編集
          </Link>
        </div>
      </div>

      {/* 凡例 */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4 text-sm font-extrabold text-gray-900 dark:text-gray-100">
          <span className="inline-flex items-center gap-1">
            <span className="text-lg">{STATUS_LABEL.ok}</span>
            <span className="text-gray-700 dark:text-gray-200">{STATUS_HELP.ok}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-lg">{STATUS_LABEL.limited}</span>
            <span className="text-gray-700 dark:text-gray-200">{STATUS_HELP.limited}</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="text-lg">{STATUS_LABEL.ng}</span>
            <span className="text-gray-700 dark:text-gray-200">{STATUS_HELP.ng}</span>
          </span>
        </div>
      </div>

      {/* 本体 */}
      <div className="space-y-2">
        {floors
          .slice()
          .sort((a, b) => a.floor - b.floor)
          .map((f) => {
            const rooms = buildRooms(f);
            const indent = calcIndent(maxRooms, f.roomsCount);

            return (
              <div key={f.floor} className="flex items-start gap-2">
                <div className="w-12 pt-2 text-right text-xs font-extrabold text-gray-700 dark:text-gray-200">
                  {f.floor}F
                </div>

                <div
                  className="grid gap-1"
                  style={{ gridTemplateColumns: `repeat(${maxRooms}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: indent }).map((_, i) => (
                    <div key={`pad-${f.floor}-${i}`} />
                  ))}

                  {rooms.map((r) => {
                    const status = draftMap[r.id] ?? "ok";

                    return (
                      <button
                        key={r.id}
                        type="button"
                        disabled={mode !== "admin"}
                        className={[
                          "min-w-[46px] rounded-xl border p-1 text-center transition active:scale-[0.99]",
                          "border-gray-200 bg-white hover:bg-gray-50",
                          "disabled:opacity-60 disabled:hover:bg-white",
                          "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 dark:disabled:hover:bg-gray-900",
                        ].join(" ")}
                        onClick={() => {
                          if (mode !== "admin") return;
                          toggleOne(r.id);
                        }}
                        title={`${r.label} / ${STATUS_HELP[status]}`}
                      >
                        <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                          {r.label}
                        </div>
                        <div className="text-lg font-extrabold leading-6 text-gray-900 dark:text-gray-100">
                          {STATUS_LABEL[status]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
