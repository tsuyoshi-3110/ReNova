"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { format, isValid } from "date-fns";

export type GanttCell = {
  key: string | number;
  label: string;
  offset: number;   // 0-based index on workingDays
  duration: number; // number of working cells
  color: string;
  startDate: Date;
  endDate: Date;
};

type DragKind = "move" | "resize-left" | "resize-right";

type Props = {
  data: GanttCell[];
  workingDays: Date[];
  onChange: (key: string | number, next: { offset?: number; duration?: number }) => void;
  /** 左のラベル幅(px) */
  labelWidth?: number;
  /** 行の高さ(px) */
  rowHeight?: number;
  /** 初期セル幅（ズーム初期値） */
  cellWidth?: number;
  /** 工区の区切り線を引く行インデックス（先頭からの累積行数）。例: [5, 11] */
  sectionBoundaries?: number[];
};

export function GanttChartDraggable({
  data,
  workingDays,
  onChange,
  labelWidth = 260,
  rowHeight = 40,
  cellWidth: cellWidthInitial = 28,
  sectionBoundaries = [],
}: Props) {
  // --- Hooks の順序は固定（ここより上に条件 return は置かない） ---

  // 安全な入力
  const rows = Array.isArray(data) ? data : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const days = Array.isArray(workingDays) ? workingDays : [];
  const cols = Math.max(days.length, 1);

  // ===== ズーム =====
  const MIN_CELL = 28;
  const MAX_CELL = 60;
  const [cellWidth, setCellWidth] = useState<number>(
    clamp(cellWidthInitial, MIN_CELL, MAX_CELL)
  );
  const gridWidth = cols * cellWidth;

  // ===== スクロール参照 =====
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // ===== ドラッグ状態 =====
  const [dragState, setDragState] = useState<{
    kind: DragKind;
    key: string | number;
    startX: number;
    baseOffset: number;
    baseDuration: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState) return;

    const prev = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const deltaCells = Math.round(dx / cellWidth);

      if (dragState.kind === "move") {
        const nextOffset = clamp(dragState.baseOffset + deltaCells, 0, cols - 1);
        onChange(dragState.key, { offset: nextOffset });
      } else if (dragState.kind === "resize-left") {
        let nextOffset = clamp(dragState.baseOffset + deltaCells, 0, cols - 1);
        let nextDuration = dragState.baseDuration + (dragState.baseOffset - nextOffset);
        if (nextDuration < 1) {
          nextDuration = 1;
          nextOffset = dragState.baseOffset + dragState.baseDuration - 1;
        }
        onChange(dragState.key, { offset: nextOffset, duration: nextDuration });
      } else if (dragState.kind === "resize-right") {
        let nextDuration = Math.max(1, dragState.baseDuration + deltaCells);
        nextDuration = Math.min(nextDuration, cols - dragState.baseOffset);
        onChange(dragState.key, { duration: nextDuration });
      }
    };

    const onUp = () => {
      setDragState(null);
      document.body.style.userSelect = prev;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = prev;
    };
  }, [dragState, cellWidth, cols, onChange]);

  const startDrag =
    (kind: DragKind, key: string | number, baseOffset: number, baseDuration: number) =>
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragState({
        kind,
        key,
        startX: e.clientX,
        baseOffset,
        baseDuration,
      });
    };

  // ===== ヘッダ：月帯 & 日ラベル =====
  const monthBands = useMemo(() => {
    const bands: { startIndex: number; monthLabel: string }[] = [];
    let cur = -1;
    for (let i = 0; i < days.length; i++) {
      const m = days[i].getMonth();
      if (m !== cur) {
        cur = m;
        bands.push({
          startIndex: i,
          monthLabel: format(days[i], "yyyy/MM"),
        });
      }
    }
    return bands;
  }, [days]);

  const dayTicks = useMemo(() => {
    return days.map((d, i) => ({
      x: i * cellWidth,
      dd: format(d, "dd"),
      w: ["日", "月", "火", "水", "木", "金", "土"][d.getDay()],
      monday: d.getDay() === 1,
    }));
  }, [days, cellWidth]);

  // ===== 工区境界線の座標（ラベル側・グリッド側で共通利用） =====
  const boundaryTops = useMemo(() => {
    // 範囲外を弾き、重複を排除して昇順へ
    const uniq = Array.from(new Set(sectionBoundaries))
      .filter((n) => Number.isFinite(n) && n > 0 && n < rows.length)
      .sort((a, b) => a - b);
    return uniq.map((rowIndex) => rowIndex * rowHeight); // 次の行の先頭位置
  }, [sectionBoundaries, rowHeight, rows.length]);

  // 行の総高さ
  const rowsTotalHeight = rows.length * rowHeight;

  // --- 描画 ---
  return (
    <div className="w-full">
      {/* ツールバー（ズーム） */}
      <div className="mb-2 flex items-center gap-2">
        <div className="text-sm text-gray-600">ズーム</div>
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => setCellWidth((w) => clamp(w - 4, MIN_CELL, MAX_CELL))}
          title="縮小"
        >
          −
        </button>
        <div className="min-w-[3rem] text-center text-sm tabular-nums">
          {cellWidth}px / 日
        </div>
        <button
          type="button"
          className="rounded border px-2 py-1 text-sm hover:bg-gray-50"
          onClick={() => setCellWidth((w) => clamp(w + 4, MIN_CELL, MAX_CELL))}
          title="拡大"
        >
          ＋
        </button>
      </div>

      {/* データが無い場合も空のグリッド枠を返す（早期 return は避ける） */}
      <div className="relative">
        <div className="flex">
          {/* 左ラベル（固定） */}
          <div
            className="shrink-0 sticky left-0 top-0 z-20 border-r bg-white"
            style={{ width: labelWidth }}
          >
            <div className="h-14 border-b bg-white" />
            <div style={{ position: "relative", height: rowsTotalHeight || 40 }}>
              {/* 行ごとの背景＆下罫線 */}
              {rows.length === 0 ? (
                <div
                  className="flex items-center text-sm text-gray-500"
                  style={{ height: rowHeight }}
                >
                  <div className="px-3">データがありません</div>
                </div>
              ) : (
                rows.map((row, i) => {
                  const title =
                    isValid(row.startDate) && isValid(row.endDate)
                      ? `${row.label}（${format(row.startDate, "MM/dd")}–${format(
                          row.endDate,
                          "MM/dd"
                        )}）`
                      : row.label;
                  return (
                    <div
                      key={row.key ?? i}
                      className={i % 2 === 0 ? "bg-white" : "bg-gray-50/70"}
                      style={{
                        height: rowHeight,
                        borderBottom: "1px solid #f1f5f9",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={title}
                    >
                      <div className="px-3 text-sm text-gray-800 truncate">
                        {row.label}
                      </div>
                    </div>
                  );
                })
              )}

              {/* 工区境界（ラベル側） */}
              {boundaryTops.map((top, idx) => (
                <div
                  key={`lbl-bound-${idx}`}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: top - 1, // 罫線と重ねる
                    width: labelWidth,
                    height: 0,
                    borderTop: "2px solid #94a3b8", // 太め＆やや濃い
                  }}
                />
              ))}
            </div>
          </div>

          {/* 右：ヘッダ＋グリッド */}
          <div className="grow overflow-x-auto" ref={scrollRef}>
            {/* ヘッダ（2段） */}
            <div className="relative h-14 border-b bg-white">
              {/* 上段：月帯 */}
              {monthBands.map((b, i) => {
                const x = b.startIndex * cellWidth;
                const xNext = (monthBands[i + 1]?.startIndex ?? cols) * cellWidth;
                const w = xNext - x;
                return (
                  <div
                    key={`m-${b.startIndex}`}
                    className="absolute text-xs text-gray-700 font-medium"
                    style={{
                      left: x,
                      top: 2,
                      width: Math.max(80, w),
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.monthLabel}
                  </div>
                );
              })}

              {/* 下段：日／曜日 */}
              {dayTicks.map((t, i) => (
                <div
                  key={`tick-${i}`}
                  className="absolute -translate-x-1/2 text-center"
                  style={{ left: t.x, top: 18, width: Math.max(30, cellWidth) }}
                >
                  <div
                    className={`text-xs tabular-nums ${
                      t.monday ? "font-semibold text-gray-800" : "text-gray-700"
                    }`}
                  >
                    {t.dd}
                  </div>
                  <div className="text-[10px] text-gray-500">{t.w}</div>
                </div>
              ))}
            </div>

            {/* グリッド＆バー */}
            <div
              className="relative"
              style={{ width: gridWidth, height: rowsTotalHeight || rowHeight }}
            >
              {/* 月の背景帯（交互） */}
              {monthBands.map((b, i) => {
                const x = b.startIndex * cellWidth;
                const xNext = (monthBands[i + 1]?.startIndex ?? cols) * cellWidth;
                const w = xNext - x;
                return (
                  <div
                    key={`mb-${b.startIndex}`}
                    className="absolute top-0"
                    style={{
                      left: x,
                      width: w,
                      height: rowsTotalHeight || rowHeight,
                      background:
                        i % 2 === 0 ? "rgba(2,6,23,0.02)" : "rgba(2,6,23,0.04)",
                    }}
                  />
                );
              })}

              {/* 縦グリッド：毎日＝薄線、毎週（月曜）＝太線 */}
              <svg
                width={gridWidth}
                height={rowsTotalHeight || rowHeight}
                className="absolute inset-0"
              >
                {Array.from({ length: cols + 1 }).map((_, ci) => {
                  const day = days[Math.min(ci, cols - 1)]?.getDay?.() ?? 0;
                  const isMon = day === 1;
                  return (
                    <line
                      key={`v-${ci}`}
                      x1={ci * cellWidth + 0.5}
                      y1={0}
                      x2={ci * cellWidth + 0.5}
                      y2={rowsTotalHeight || rowHeight}
                      stroke={isMon ? "#cbd5e1" : "#eef2f7"}
                      strokeWidth={isMon ? 2 : 1}
                    />
                  );
                })}

                {/* 行の区切り線（薄め） */}
                {rows.map((_, i) => (
                  <line
                    key={`rowline-${i}`}
                    x1={0}
                    x2={gridWidth}
                    y1={i * rowHeight + 0.5}
                    y2={i * rowHeight + 0.5}
                    stroke="#f1f5f9"
                    strokeWidth={1}
                  />
                ))}

                {/* 工区境界（太線） */}
                {boundaryTops.map((top, idx) => (
                  <line
                    key={`grid-bound-${idx}`}
                    x1={0}
                    x2={gridWidth}
                    y1={top + 0.5}
                    y2={top + 0.5}
                    stroke="#94a3b8"
                    strokeWidth={2}
                  />
                ))}
              </svg>

              {/* バー（データがある時のみ描画） */}
              {rows.map((row, i) => {
                const top = i * rowHeight;
                const left = row.offset * cellWidth;
                const width = Math.max(1, row.duration) * cellWidth;
                const title =
                  isValid(row.startDate) && isValid(row.endDate)
                    ? `${row.label}（${format(row.startDate, "MM/dd")}–${format(
                        row.endDate,
                        "MM/dd"
                      )}）`
                    : row.label;

                return (
                  <div
                    key={row.key ?? i}
                    style={{
                      position: "absolute",
                      left: 0,
                      top,
                      height: rowHeight,
                      width: gridWidth,
                    }}
                  >
                    <div
                      className="absolute rounded-md shadow-sm cursor-grab active:cursor-grabbing"
                      style={{
                        left,
                        top: 4,
                        width: Math.max(6, width - 4),
                        height: rowHeight - 8,
                        background: row.color,
                      }}
                      title={title}
                      onMouseDown={startDrag(
                        "move",
                        row.key ?? i,
                        row.offset,
                        Math.max(1, row.duration)
                      )}
                    >
                      {/* 左リサイズ */}
                      <div
                        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize"
                        style={{
                          background: "rgba(0,0,0,0.15)",
                          borderTopLeftRadius: 6,
                          borderBottomLeftRadius: 6,
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startDrag(
                            "resize-left",
                            row.key ?? i,
                            row.offset,
                            Math.max(1, row.duration)
                          )(e);
                        }}
                      />
                      {/* 右リサイズ */}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
                        style={{
                          background: "rgba(0,0,0,0.15)",
                          borderTopRightRadius: 6,
                          borderBottomRightRadius: 6,
                          zIndex: 2,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          startDrag(
                            "resize-right",
                            row.key ?? i,
                            row.offset,
                            Math.max(1, row.duration)
                          )(e);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
