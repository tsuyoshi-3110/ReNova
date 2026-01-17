"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  useSchedule,
  type WorkItem,
  type CustomSection,
  type Scheduled,
  PHASES,
} from "../features/schedule/hooks/useSchedule";
import {
  GanttChartDraggable,
  type GanttCell,
} from "../features/schedule/components/GanttChartDraggable";
import { exportScheduleToExcel } from "@/lib/exportScheduleToExcel";

/** “月曜のみ選択”用 */
const MONDAY_ANCHOR = "1970-01-05";

/* ---------- 工種候補（通常） ---------- */
const NORMAL_CANDIDATES: WorkItem[] = [
  {
    name: "足場組立",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 5,
    defaultProductivity: 100,
    defaultQty: 2000,
    color: "#9E9E9E",
  },
  {
    name: "下地補修",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 30,
    defaultQty: 300,
    color: "#FB8C00",
  },
  {
    name: "シーリング",
    unit: "m",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 150,
    defaultQty: 1500,
    color: "#8E24AA",
  },
  {
    name: "塗装（外壁）",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 5,
    defaultProductivity: 120,
    defaultQty: 1500,
    color: "#1E88E5",
  },
  {
    name: "塗装（鉄部）",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 40,
    defaultQty: 200,
    color: "#1E88E5",
  },
  {
    name: "防水工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 50,
    defaultQty: 600,
    color: "#00ACC1",
  },
  {
    name: "長尺シート",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 200,
    defaultQty: 1500,
    color: "#6D4C41",
  },
  {
    name: "美装",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 3,
    defaultProductivity: 200,
    defaultQty: 2000,
    color: "#E91E63",
  },
  { name: "検査", unit: "days", mode: "days", defaultQty: 2, color: "#3949AB" },
  {
    name: "手直し",
    unit: "days",
    mode: "days",
    defaultQty: 3,
    color: "#F4511E",
  },
  {
    name: "足場解体",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 5,
    defaultProductivity: 200,
    defaultQty: 2000,
    color: "#9E9E9E",
  },
];

/* ---------- 屋上（本体） ---------- */
const ROOF_MAIN_CANDIDATES: WorkItem[] = [
  {
    name: "屋上塗装工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 3,
    defaultProductivity: 120,
    defaultQty: 600,
    color: "#1E88E5",
  },
  {
    name: "屋上防水工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 50,
    defaultQty: 600,
    color: "#00ACC1",
  },
  {
    name: "その他防水工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 50,
    defaultQty: 200,
    color: "#00838F",
  },
];

/* ---------- 屋上（塔屋） ---------- */
const ROOF_TOWER_CANDIDATES: WorkItem[] = [
  {
    name: "塔屋ー足場組立工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 3,
    defaultProductivity: 120,
    defaultQty: 350,
    color: "#757575",
  },
  {
    name: "塔屋ー下地補修工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 35,
    defaultQty: 90,
    color: "#BF360C",
  },
  {
    name: "塔屋ーシーリング工事",
    unit: "m",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 160,
    defaultQty: 220,
    color: "#8E24AA",
  },
  {
    name: "塔屋ー塗装工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 90,
    defaultQty: 260,
    color: "#3949AB",
  },
  {
    name: "塔屋ー防水工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 2,
    defaultProductivity: 55,
    defaultQty: 180,
    color: "#26C6DA",
  },
  {
    name: "塔屋ー足場解体工事",
    unit: "㎡",
    mode: "calc",
    defaultWorkers: 3,
    defaultProductivity: 170,
    defaultQty: 350,
    color: "#9E9E9E",
  },
];

/* ---------- 共通：入力カード（詳細は折りたたみ） ---------- */
function WorkItemCard({
  item,
  onChange,
  id,
}: {
  item: WorkItem;
  onChange: (next: WorkItem) => void;
  id: string;
}) {
  const [openAdv, setOpenAdv] = useState(false);

  const onNum = (field: keyof WorkItem, v: string) => {
    const n = v === "" ? undefined : Number(v);
    onChange({
      ...item,
      [field]: Number.isFinite(n) ? (n as number) : undefined,
    });
  };

  return (
    <div className="border rounded-lg p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          {item.name}
        </h3>
        <div
          className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
          style={{ background: item.color }}
        />
      </div>

      <label className="flex items-center gap-2 text-sm mb-2 text-gray-800 dark:text-gray-100">
        <input
          id={`${id}-days`}
          type="checkbox"
          checked={item.mode === "days"}
          onChange={(e) =>
            onChange({
              ...item,
              mode: e.currentTarget.checked ? "days" : "calc",
            })
          }
        />
        <span>日数で入力する</span>
      </label>

      {item.mode === "days" ? (
        <label className="block text-sm text-gray-800 dark:text-gray-100">
          日数
          <input
            type="number"
            value={item.defaultQty ?? ""}
            onChange={(e) => onNum("defaultQty", e.target.value)}
            className="border rounded p-1 w-full text-center mt-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
        </label>
      ) : (
        <>
          <label className="block text-sm text-gray-800 dark:text-gray-100">
            数量（{item.unit}）
            <input
              type="number"
              value={item.defaultQty ?? ""}
              onChange={(e) => onNum("defaultQty", e.target.value)}
              className="border rounded p-1 w-full text-center mt-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </label>

          <button
            type="button"
            className="mt-2 text-xs text-indigo-700 dark:text-indigo-300 underline"
            onClick={() => setOpenAdv((v) => !v)}
          >
            {openAdv
              ? "▲ 詳細を閉じる（人員・歩掛り）"
              : "▼ 詳細を開く（人員・歩掛り）"}
          </button>

          {openAdv && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="block text-sm text-gray-800 dark:text-gray-100">
                平均人員/日
                <input
                  type="number"
                  value={item.defaultWorkers ?? ""}
                  onChange={(e) => onNum("defaultWorkers", e.target.value)}
                  className="border rounded p-1 w-full text-center mt-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </label>
              <label className="block text-sm text-gray-800 dark:text-gray-100">
                歩掛り（1人1日）
                <input
                  type="number"
                  value={item.defaultProductivity ?? ""}
                  onChange={(e) =>
                    onNum("defaultProductivity", e.target.value)
                  }
                  className="border rounded p-1 w-full text-center mt-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                />
              </label>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- 通常工区フォーム ---------- */
function NormalSectionForm({ onAdd }: { onAdd: (sec: CustomSection) => void }) {
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NORMAL_CANDIDATES.map((w) => [w.name, true]))
  );
  const [editing, setEditing] = useState<WorkItem[]>(() =>
    NORMAL_CANDIDATES.map((w) => ({ ...w }))
  );

  const toggleAll = (v: boolean) =>
    setChecked(Object.fromEntries(NORMAL_CANDIDATES.map((w) => [w.name, v])));
  const toggleOne = (name: string) =>
    setChecked((prev) => ({ ...prev, [name]: !prev[name] }));
  const setEditingAt = (idx: number, next: WorkItem) =>
    setEditing((prev) => prev.map((w, i) => (i === idx ? next : w)));

  const add = () => {
    const picked = editing.filter((w) => checked[w.name]);
    if (picked.length === 0) {
      // eslint-disable-next-line no-alert
      alert("工種を1つ以上選択してください。");
      return;
    }
    onAdd({
      id: `${Date.now()}`,
      title: (title || "").trim() || "1工区",
      items: picked.map((w) => ({ ...w })),
      parallelSealAndRepair: true,
      sectionKind: "normal",
    });
    setTitle("");
  };

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        通常工区を追加
      </h2>
      <div className="rounded border p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2">
            <span className="text-sm text-gray-800 dark:text-gray-100">
              工区名
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例）1工区"
              className="border rounded px-2 py-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </label>
          <button
            onClick={add}
            className="rounded bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
          >
            工程に追加
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-700 dark:text-gray-200">
              追加する工種：
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={Object.values(checked).every(Boolean)}
                onChange={(e) => toggleAll(e.currentTarget.checked)}
              />
              <span>全選択 / 解除</span>
            </label>
          </div>
          <div className="grid gap-1 md:grid-cols-3">
            {NORMAL_CANDIDATES.map((w) => (
              <label
                key={`pick-${w.name}`}
                className="flex items-center gap-2 text-gray-800 dark:text-gray-100"
              >
                <input
                  type="checkbox"
                  checked={checked[w.name] ?? false}
                  onChange={() => toggleOne(w.name)}
                />
                <span>{w.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {editing
            .filter((w) => checked[w.name])
            .map((w, i) => (
              <WorkItemCard
                key={`edit-${w.name}`}
                item={w}
                id={`edit-${i}`}
                onChange={(next) =>
                  setEditingAt(
                    editing.findIndex((x) => x.name === w.name),
                    next
                  )
                }
              />
            ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 屋上工区フォーム（塔屋ONで全選択に） ---------- */
function RoofSectionForm({ onAdd }: { onAdd: (sec: CustomSection) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("屋上工区");
  const [hasTower, setHasTower] = useState(false);

  const [checkedRoof, setCheckedRoof] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ROOF_MAIN_CANDIDATES.map((w) => [w.name, true]))
  );
  const [editingRoof, setEditingRoof] = useState<WorkItem[]>(() =>
    ROOF_MAIN_CANDIDATES.map((w) => ({ ...w }))
  );

  const [checkedTower, setCheckedTower] = useState<Record<string, boolean>>(
    () => Object.fromEntries(ROOF_TOWER_CANDIDATES.map((w) => [w.name, true]))
  );
  const [editingTower, setEditingTower] = useState<WorkItem[]>(() =>
    ROOF_TOWER_CANDIDATES.map((w) => ({ ...w }))
  );

  useEffect(() => {
    const map = (v: boolean) =>
      Object.fromEntries(ROOF_TOWER_CANDIDATES.map((w) => [w.name, v]));
    setCheckedTower(map(hasTower));
  }, [hasTower]);

  const setEditingRoofAt = (idx: number, next: WorkItem) =>
    setEditingRoof((prev) => prev.map((w, i) => (i === idx ? next : w)));
  const setEditingTowerAt = (idx: number, next: WorkItem) =>
    setEditingTower((prev) => prev.map((w, i) => (i === idx ? next : w)));

  const add = () => {
    const pickedRoof = editingRoof.filter((w) => checkedRoof[w.name]);
    const pickedTower = hasTower
      ? editingTower.filter((w) => checkedTower[w.name])
      : [];
    if (pickedRoof.length === 0 && pickedTower.length === 0) {
      // eslint-disable-next-line no-alert
      alert("工種を1つ以上選択してください。");
      return;
    }
    onAdd({
      id: `${Date.now()}`,
      title: (title || "").trim() || "屋上工区",
      items: [
        ...pickedRoof.map((w) => ({ ...w })),
        ...pickedTower.map((w) => ({ ...w })),
      ],
      parallelSealAndRepair: false,
      sectionKind: "roof",
      roofOptions: { hasTower },
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          屋上工区を追加
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
          <input
            type="checkbox"
            checked={showForm}
            onChange={(e) => setShowForm(e.currentTarget.checked)}
          />
          <span>屋上フォームを表示</span>
        </label>
      </div>

      {showForm && (
        <div className="rounded border p-3 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2">
              <span className="text-sm text-gray-800 dark:text-gray-100">
                工区名
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例）屋上工区"
                className="border rounded px-2 py-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
              />
            </label>

            <label className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
              <input
                type="checkbox"
                checked={hasTower}
                onChange={(e) => setHasTower(e.currentTarget.checked)}
              />
              <span className="text-sm">
                塔屋あり（チェックで塔屋フォームを表示）
              </span>
            </label>

            <button
              onClick={add}
              className="rounded bg-emerald-600 text-white px-3 py-1.5 hover:bg-emerald-700"
            >
              工程に追加
            </button>
          </div>

          {/* 屋上（本体） */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-700 dark:text-gray-200">
                屋上（本体） 工種：
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                <input
                  type="checkbox"
                  checked={Object.values(checkedRoof).every(Boolean)}
                  onChange={(e) =>
                    setCheckedRoof(
                      Object.fromEntries(
                        ROOF_MAIN_CANDIDATES.map((w) => [
                          w.name,
                          e.currentTarget.checked,
                        ])
                      )
                    )
                  }
                />
                <span>全選択 / 解除</span>
              </label>
            </div>
            <div className="grid gap-1 md:grid-cols-3">
              {ROOF_MAIN_CANDIDATES.map((w) => (
                <label
                  key={`roof-main-pick-${w.name}`}
                  className="flex items-center gap-2 text-gray-800 dark:text-gray-100"
                >
                  <input
                    type="checkbox"
                    checked={checkedRoof[w.name] ?? false}
                    onChange={() =>
                      setCheckedRoof((p) => ({ ...p, [w.name]: !p[w.name] }))
                    }
                  />
                  <span>{w.name}</span>
                </label>
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {editingRoof
                .filter((w) => checkedRoof[w.name])
                .map((w, i) => (
                  <WorkItemCard
                    key={`roof-main-edit-${w.name}`}
                    item={w}
                    id={`roof-main-${i}`}
                    onChange={(next) =>
                      setEditingRoofAt(
                        editingRoof.findIndex((x) => x.name === w.name),
                        next
                      )
                    }
                  />
                ))}
            </div>
          </div>

          {/* 塔屋（ON時のみ） */}
          {hasTower && (
            <div className="space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-700 dark:text-gray-200">
                  塔屋 工種：
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={Object.values(checkedTower).every(Boolean)}
                    onChange={(e) =>
                      setCheckedTower(
                        Object.fromEntries(
                          ROOF_TOWER_CANDIDATES.map((w) => [
                            w.name,
                            e.currentTarget.checked,
                          ])
                        )
                      )
                    }
                  />
                  <span>全選択 / 解除</span>
                </label>
              </div>
              <div className="grid gap-1 md:grid-cols-3">
                {ROOF_TOWER_CANDIDATES.map((w) => (
                  <label
                    key={`roof-tower-pick-${w.name}`}
                    className="flex items-center gap-2 text-gray-800 dark:text-gray-100"
                  >
                    <input
                      type="checkbox"
                      checked={checkedTower[w.name] ?? false}
                      onChange={() =>
                        setCheckedTower((p) => ({ ...p, [w.name]: !p[w.name] }))
                      }
                    />
                    <span>{w.name}</span>
                  </label>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {editingTower
                  .filter((w) => checkedTower[w.name])
                  .map((w, i) => (
                    <WorkItemCard
                      key={`roof-tower-edit-${w.name}`}
                      item={w}
                      id={`roof-tower-${i}`}
                      onChange={(next) =>
                        setEditingTowerAt(
                          editingTower.findIndex((x) => x.name === w.name),
                          next
                        )
                      }
                    />
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- 表示順（屋上＋塔屋の固定順） ---------- */
const ROOF_TOWER_DISPLAY_ORDER = [
  "塔屋ー足場組立工事",
  "塔屋ー下地補修工事",
  "塔屋ーシーリング工事",
  "塔屋ー塗装工事",
  "塔屋ー防水工事",
  "塔屋ー足場解体工事",
  "屋上塗装工事",
  "屋上防水工事",
  "その他防水工事",
];

/* ================== ページ ================== */
export default function SchedulePage() {
  const [startDate, setStartDate] = useState<string>("2025-10-06"); // 月曜
  const [saturdayOff, setSaturdayOff] = useState<boolean>(false);
  const [holidayText, setHolidayText] = useState<string>("");

  // ★ 週単位設定（既定：準備=4週、片付け=1週）
  const [prepWeeks, setPrepWeeks] = useState<number>(4);
  const [cleanupWeeks, setCleanupWeeks] = useState<number>(1);

  const [sections, setSections] = useState<CustomSection[]>([]);

  // ★ ローカルダークモード
  const [isDark, setIsDark] = useState<boolean>(false);

  const {
    schedule,
    workingDays,
    prepStart,
    cleanupStart,
    cleanupEnd,
    holidaySet,
  } = useSchedule({
    startDate,
    saturdayOff,
    holidayText,
    customSections: sections,
  });

  const PHASE_ORDER: string[] = PHASES.flat();
  const ordered: Scheduled[] = useMemo(() => {
    const bySection = new Map<string, Scheduled[]>();
    schedule.forEach((row) => {
      const arr = bySection.get(row.groupTitle) ?? [];
      arr.push(row);
      bySection.set(row.groupTitle, arr);
    });

    const out: Scheduled[] = [];
    for (const sec of sections) {
      const rows = (bySection.get(sec.title) ?? []).slice();
      if (sec.sectionKind === "roof") {
        const idxOf = (label: string) =>
          ROOF_TOWER_DISPLAY_ORDER.findIndex((k) => label.endsWith(k));
        rows.sort((a, b) => idxOf(a.label) - idxOf(b.label));
      } else {
        const idxOf = (label: string) =>
          PHASE_ORDER.findIndex((p) => label.endsWith(p));
        rows.sort((a, b) => idxOf(a.label) - idxOf(b.label));
      }
      out.push(...rows);
    }
    const leftovers = schedule.filter(
      (r) => !sections.some((s) => s.title === r.groupTitle)
    );
    if (leftovers.length) out.push(...leftovers);
    return out;
  }, [schedule, sections, PHASE_ORDER]);

  // ドラッグ反映
  const [overrides, setOverrides] = useState<
    Record<string | number, { offset?: number; duration?: number }>
  >({});
  const cells: GanttCell[] = useMemo(() => {
    const last = Math.max(0, workingDays.length - 1);
    return ordered.map((row, idx) => {
      const key = `${row.groupTitle}|${row.label}|${idx}`;
      const ov = overrides[key] ?? {};
      const offset = Math.max(0, Math.min(last, ov.offset ?? row.offset));
      const duration = Math.max(1, ov.duration ?? row.duration);
      const endIndex = Math.max(0, Math.min(last, offset + duration - 1));
      const startDate2 = workingDays[offset] ?? row.startDate;
      const endDate2 = workingDays[endIndex] ?? row.endDate;
      return {
        key,
        groupTitle: row.groupTitle,
        label: row.label,
        offset,
        duration,
        color: row.color,
        startDate: startDate2,
        endDate: endDate2,
      };
    });
  }, [ordered, overrides, workingDays]);

  const handleChange = (
    key: string | number,
    next: { offset?: number; duration?: number }
  ) =>
    setOverrides((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...next },
    }));

  // Excel 出力用
  type ExcelRow = Pick<Scheduled, "groupTitle" | "label" | "color"> & {
    startDate: Date;
    endDate: Date;
  };
  const adjustedForExport: ExcelRow[] = useMemo(() => {
    const last = Math.max(0, workingDays.length - 1);
    return ordered.map((row, idx) => {
      const key = `${row.groupTitle}|${row.label}|${idx}`;
      const ov = overrides[key] ?? {};
      const offset = Math.max(0, Math.min(last, ov.offset ?? row.offset));
      const duration = Math.max(1, ov.duration ?? row.duration);
      const endIndex = Math.max(0, Math.min(last, offset + duration - 1));
      const startDate2 = workingDays[offset] ?? row.startDate;
      const endDate2 = workingDays[endIndex] ?? row.endDate;
      return {
        groupTitle: row.groupTitle,
        label: row.label,
        startDate: startDate2,
        endDate: endDate2,
        color: row.color,
      };
    });
  }, [ordered, overrides, workingDays]);

  const canExport = useMemo(
    () =>
      Boolean(
        prepStart && cleanupStart && cleanupEnd && adjustedForExport.length > 0
      ),
    [prepStart, cleanupStart, cleanupEnd, adjustedForExport.length]
  );

  // 工区境界線行（ガントに渡す）
  const sectionBoundaries = useMemo(() => {
    const titles = sections.map((s) => s.title);
    let acc = 0;
    const bounds: number[] = [];
    for (let i = 0; i < titles.length; i += 1) {
      const cnt = ordered.filter((r) => r.groupTitle === titles[i]).length;
      acc += cnt;
      if (cnt > 0 && i < titles.length - 1) bounds.push(acc);
    }
    return bounds;
  }, [ordered, sections]);

  // 月曜のみ
  const enforceMonday = (value: string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    return d.getDay() === 1;
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <main className="p-4 max-w-[1600px] mx-auto space-y-6 bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-50 min-h-screen">
        {/* ヘッダ */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
              工程表
            </h1>
            <button
              type="button"
              onClick={() => setIsDark((v) => !v)}
              className="rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-100 shadow-sm"
            >
              {isDark ? "🌞 ライトモード" : "🌙 ダークモード"}
            </button>
          </div>
          <button
            disabled={!canExport}
            className={`rounded px-4 py-2 text-white ${
              canExport
                ? "bg-indigo-600 hover:bg-indigo-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={() =>
              exportScheduleToExcel(adjustedForExport, {
                cleanupStart: cleanupStart!, // useSchedule が返す値
                cleanupEnd: cleanupEnd!, // 互換で渡すだけ（cleanupWeeksが優先）
                saturdayOff,
                holidaySet,
                title: "工事名称:",
                sheetName: "工程表",
                filename: "工程表_A3_横.xlsx",
                scale: 2.0,
                prepWeeks: Math.max(1, prepWeeks),
                cleanupWeeks: Math.max(1, cleanupWeeks),
              })
            }
          >
            Excel出力（A3横）
          </button>
        </div>

        {/* 基本設定 */}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
            <span>工事開始日（※月曜のみ）</span>
            <input
              type="date"
              value={startDate}
              min={MONDAY_ANCHOR}
              step={7}
              onChange={(e) => {
                const v = e.target.value;
                if (!enforceMonday(v)) {
                  // eslint-disable-next-line no-alert
                  alert("月曜日のみ選択できます。");
                  e.currentTarget.value = startDate;
                  return;
                }
                setStartDate(v);
                setOverrides({});
              }}
              className="border rounded px-2 py-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </label>

          <label className="flex items-center gap-2 text-gray-800 dark:text-gray-100">
            <input
              type="checkbox"
              checked={saturdayOff}
              onChange={(e) => {
                setSaturdayOff(e.currentTarget.checked);
                setOverrides({});
              }}
            />
            <span>土曜も休工にする</span>
          </label>

          <div />
        </div>

        {/* 祝日 */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            祝日：YYYY-MM-DD を改行区切りで入力。
          </div>
          <textarea
            value={holidayText}
            onChange={(e) => {
              setHolidayText(e.target.value);
              setOverrides({});
            }}
            placeholder={"2025-01-01\n2025-01-13"}
            className="border rounded p-2 w-full h-24 font-mono text-sm bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>

        {/* ★ 準備/片付け（週単位） */}
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
            <span>準備期間（週）</span>
            <input
              type="number"
              min={1}
              step={1}
              value={prepWeeks}
              onChange={(e) =>
                setPrepWeeks(Math.max(1, Number(e.target.value || 1)))
              }
              className="border rounded px-2 py-1 w-28 text-right bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="flex items-center gap-3 text-gray-800 dark:text-gray-100">
            <span>後片付け期間（週）</span>
            <input
              type="number"
              min={1}
              step={1}
              value={cleanupWeeks}
              onChange={(e) =>
                setCleanupWeeks(Math.max(1, Number(e.target.value || 1)))
              }
              className="border rounded px-2 py-1 w-28 text-right bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100"
            />
          </label>
        </div>

        {/* フォーム */}
        <NormalSectionForm
          onAdd={(sec) => setSections((prev) => [...prev, sec])}
        />
        <RoofSectionForm
          onAdd={(sec) => setSections((prev) => [...prev, sec])}
        />

        {/* 追加済み */}
        {sections.length > 0 && (
          <section className="space-y-2">
            <h3 className="font-semibold mt-4 text-gray-900 dark:text-gray-100">
              追加済みカスタム工区
            </h3>
            <ul className="space-y-1">
              {sections.map((cs) => (
                <li
                  key={cs.id}
                  className="flex items-center justify-between rounded border px-3 py-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {cs.title}
                    {cs.sectionKind === "roof" && (
                      <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300 border border-emerald-700/50 dark:border-emerald-300/60 rounded px-1">
                        屋上{cs.roofOptions?.hasTower ? "（塔屋あり）" : ""}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSections((prev) =>
                        prev.filter((s) => s.id !== cs.id)
                      )
                    }
                    className="text-sm text-red-600 dark:text-red-400 hover:underline"
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
            <div className="text-xs text-gray-600 dark:text-gray-300">
              表示は<strong>1工区の全バー→2工区の全バー…</strong>
              （計算は工種ごとのパイプライン）。
            </div>
          </section>
        )}

        {/* ガント */}
        {sections.length > 0 && (
          <GanttChartDraggable
            data={cells}
            workingDays={workingDays}
            onChange={handleChange}
            sectionBoundaries={sectionBoundaries}
          />
        )}
      </main>
    </div>
  );
}
