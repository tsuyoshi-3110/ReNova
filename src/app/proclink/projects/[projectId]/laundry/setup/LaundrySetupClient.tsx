"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LaundryBoardConfig, LaundryFloorDef } from "../types";
import { getLaundryConfigByProject, setLaundryConfigByProject } from "../laundryFirestore";
import { buildRooms, calcIndent, calcMaxRooms } from "../utils";

type Row = {
  floor: number;
  roomsCount: number;
  startNo: number | "";
};

function toFloorDefs(rows: Row[]): LaundryFloorDef[] {
  return rows
    .filter((r) => Number.isFinite(r.floor) && r.floor >= 1 && r.roomsCount >= 1)
    .map((r) => ({
      floor: r.floor,
      roomsCount: r.roomsCount,
      startNo: r.startNo === "" ? undefined : r.startNo,
    }));
}

export default function LaundrySetupClient({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([
    { floor: 1, roomsCount: 5, startNo: 1 },
    { floor: 2, roomsCount: 5, startNo: 1 },
    { floor: 3, roomsCount: 5, startNo: 1 },
  ]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const c = await getLaundryConfigByProject(projectId);
      if (!c) return;

      const nextRows: Row[] = c.floors
        .slice()
        .sort((a, b) => a.floor - b.floor)
        .map((f) => ({
          floor: f.floor,
          roomsCount: f.roomsCount,
          startNo: f.startNo ?? "",
        }));

      if (!cancelled && nextRows.length) setRows(nextRows);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const floorDefs = useMemo(() => toFloorDefs(rows), [rows]);
  const maxRooms = useMemo(() => calcMaxRooms(floorDefs), [floorDefs]);

  function addRow() {
    const maxFloor = rows.length ? Math.max(...rows.map((r) => r.floor)) : 0;
    setRows((prev) => [...prev, { floor: maxFloor + 1, roomsCount: 5, startNo: 1 }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    const config: LaundryBoardConfig = {
      version: 1,
      floors: toFloorDefs(rows),
      updatedAt: Date.now(),
    };

    try {
      await setLaundryConfigByProject(projectId, config);
      window.alert("掲示板設定をFirestoreに保存しました。");
    } catch (e) {
      window.alert(`保存失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const inputBase =
    "rounded-xl border px-2 py-2 text-sm bg-white text-gray-900 border-gray-200 " +
    "dark:bg-gray-950 dark:text-gray-100 dark:border-gray-800";

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 text-sm font-extrabold text-gray-900 dark:text-gray-100">
          階ごとの設定
        </div>

        <div className="space-y-2">
          {rows.map((r, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">階</div>
              <input
                type="number"
                min={1}
                value={r.floor}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRows((prev) => prev.map((x, i) => (i === idx ? { ...x, floor: v } : x)));
                }}
                className={`${inputBase} w-20`}
              />

              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">部屋数</div>
              <input
                type="number"
                min={1}
                value={r.roomsCount}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setRows((prev) =>
                    prev.map((x, i) => (i === idx ? { ...x, roomsCount: v } : x)),
                  );
                }}
                className={`${inputBase} w-24`}
              />

              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                開始番号(任意)
              </div>
              <input
                type="number"
                value={r.startNo}
                onChange={(e) => {
                  const raw = e.target.value;
                  setRows((prev) =>
                    prev.map((x, i) =>
                      i === idx ? { ...x, startNo: raw === "" ? "" : Number(raw) } : x,
                    ),
                  );
                }}
                placeholder="例: 17"
                className={`${inputBase} w-28`}
              />

              <button
                type="button"
                className="ml-auto rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                onClick={() => removeRow(idx)}
              >
                削除
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            onClick={addRow}
          >
            行を追加
          </button>

          <button
            type="button"
            className="rounded-xl bg-black px-4 py-2 text-sm font-extrabold text-white dark:bg-white dark:text-gray-900"
            onClick={save}
          >
            保存
          </button>

          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/laundry`}
            className="ml-auto inline-flex rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            管理画面へ
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-2 text-sm font-extrabold text-gray-900 dark:text-gray-100">
          プレビュー
        </div>

        {floorDefs.length === 0 ? (
          <div className="text-sm text-gray-600 dark:text-gray-300">設定がありません。</div>
        ) : (
          <div className="space-y-2">
            {floorDefs
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

                      {rooms.map((room) => (
                        <div
                          key={room.id}
                          className="min-w-[46px] rounded-xl border border-gray-200 bg-white p-1 text-center dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div className="text-[10px] font-bold text-gray-600 dark:text-gray-300">
                            {room.label}
                          </div>
                          <div className="text-lg font-extrabold leading-6 text-gray-900 dark:text-gray-100">
                            □
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
