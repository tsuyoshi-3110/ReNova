// src/app/features/schedule/hooks/useSchedule.ts
import { addDays, addMonths, parseISO } from "date-fns";
import { useMemo } from "react";
import {
  ymd,
  makeHolidaySet,
  normalizeToWorking,
  nextWorkingAfter,
  addWorkingDays,
  collectWorkingDays,
} from "../utils/workingDays";
import { snapToHalfWeek } from "../utils/snap";

/* ================== 型 ================== */
export type Unit = "㎡" | "m" | "days";
export type InputMode = "calc" | "days";

export type WorkItem = {
  name: string;
  unit: Unit;
  mode: InputMode;
  defaultWorkers?: number;
  defaultProductivity?: number;
  defaultQty?: number; // mode==="days" のときは日数
  color: string;
};

export type Scheduled = {
  groupTitle: string; // 例: "1工区" / "屋上工区"
  label: string;      // 例: "1工区-下地補修" / "屋上工区-屋上塗装工事"
  startDate: Date;
  endDate: Date;
  startKey: string;
  endKey: string;
  offset: number;
  duration: number;
  color: string;
};

export type CustomSection = {
  id: string;
  title: string;             // 表示名（例：1工区 / 屋上工区）
  items: WorkItem[];         // 選択された工種のみ
  parallelSealAndRepair?: boolean; // 既定: true（通常工区の下地補修・シーリング並行）
  sectionKind?: "normal" | "roof"; // 屋上かどうか
  roofOptions?: { hasTower?: boolean }; // 塔屋の有無
};

export type SchedMemo = {
  schedule: Scheduled[];
  workingDays: Date[];
  minStartAll: Date | null;
  maxEndAll: Date | null;
  prepStart: Date | null; // 準備開始（工事開始の1か月前 - 1日）
  prepEndWorkNext: Date | null; // 準備終了＝工事開始
  cleanupStart: Date | null;
  cleanupEnd: Date | null;
};

export type UseScheduleParams = {
  /** ★ この日が“工事開始日（実作業の開始）” */
  startDate: string;
  saturdayOff: boolean;
  holidayText: string;
  customSections: CustomSection[];
};

/* ================== フェーズ定義（通常工区） ================== */
export const PHASES: string[][] = [
  ["足場組立"],
  ["下地補修", "シーリング"], // 並行
  ["塗装"], // 「塗装（外壁）＋塗装（鉄部）」合算
  ["防水工事"],
  ["長尺シート"],
  ["美装"],
  ["検査"],
  ["手直し"],
  ["足場解体"], // ← 後段で“屋上完了待ち”を掛けて個別に配置
];

/* 屋上（塔屋）フェーズ */
const TOWER_PHASES: string[][] = [
  ["塔屋ー足場組立工事"],
  ["塔屋ー下地補修工事", "塔屋ーシーリング工事"], // 並行
  ["塔屋ー塗装工事"],
  ["塔屋ー防水工事"],
  ["塔屋ー足場解体工事"],
];

const ROOF_MAIN = ["屋上塗装工事", "屋上防水工事", "その他防水工事"] as const;

/* ================== ユーティリティ ================== */
const PAINT_COLOR = "#1E88E5";

function calcRawDays(w?: WorkItem): number {
  if (!w) return 0;
  const qty = Number(w.defaultQty ?? 0);
  if (qty <= 0) return 0;
  if (w.mode === "days") return Math.ceil(qty);
  const workers = Number(w.defaultWorkers ?? 0);
  const prod = Number(w.defaultProductivity ?? 0);
  if (workers <= 0 || prod <= 0) return Math.ceil(qty);
  return Math.ceil(qty / (workers * prod));
}

function colorOf(
  phase: string,
  finder: (name: string) => WorkItem | undefined
): string {
  if (phase === "塗装" || phase === "屋上塗装工事") return PAINT_COLOR;
  return finder(phase)?.color ?? "#888888";
}

/** 将来方向のみで“次の月曜”に寄せる（当日が月曜なら当日） */
function alignToNextMondayOrSame(
  d: Date,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
): Date {
  let m = new Date(d);
  while (m.getDay() !== 1) m = addDays(m, 1);
  return normalizeToWorking(m, opts);
}

/* ================== 本体 Hook ================== */
export function useSchedule(
  params: UseScheduleParams
): SchedMemo & { holidaySet: Set<string> } {
  const { startDate, saturdayOff, holidayText, customSections } = params;

  const holidaySet = useMemo(() => makeHolidaySet(holidayText), [holidayText]);

  return useMemo(() => {
    const schedule: Scheduled[] = [];

    if (!startDate || customSections.length === 0) {
      return {
        schedule,
        workingDays: [],
        minStartAll: null,
        maxEndAll: null,
        prepStart: null,
        prepEndWorkNext: null,
        cleanupStart: null,
        cleanupEnd: null,
        holidaySet,
      };
    }

    const opts = { saturdayOff, holidaySet };

    // ★ 仕様：startDate が「工事開始日」
    const workStart = normalizeToWorking(parseISO(startDate), opts);
    // ★ 準備期間は工事開始の“1か月前の翌日”（= 1日短縮）
    const _prepStart = addDays(addMonths(workStart, -1), -1);
    const _prepEndWorkNext = workStart;

    // セクション分類
    const normalSections = customSections.filter((s) => s.sectionKind !== "roof");
    const roofSections   = customSections.filter((s) => s.sectionKind === "roof");

    /* ---------- 通常工区：所要日数（半週丸め） ---------- */
    type SpanMap = Record<string, number>;
    const spansByNormal: SpanMap[] = normalSections.map((cs) => {
      const find = (n: string) => cs.items.find((x) => x.name === n);
      const paintDays =
        calcRawDays(find("塗装（外壁）")) + calcRawDays(find("塗装（鉄部）"));
      const span: SpanMap = {};
      const uniq = Array.from(new Set(PHASES.flat()));
      uniq.forEach((ph) => {
        span[ph] =
          ph === "塗装"
            ? snapToHalfWeek(paintDays, saturdayOff)
            : snapToHalfWeek(calcRawDays(find(ph)), saturdayOff);
      });
      return span;
    });

    /* ---------- 通常工区：まず“足場解体以外”をパイプラインで確定 ---------- */
    const nN = normalSections.length;
    const startN: Date[][] = Array.from({ length: nN }, () => []);
    const endN: Date[][]   = Array.from({ length: nN }, () => []);

    const dismantlePhaseIndex = PHASES.findIndex((g) => g.includes("足場解体"));
    const phasesExceptDismantle = PHASES.filter((g) => !g.includes("足場解体"));

    for (let pi = 0; pi < phasesExceptDismantle.length; pi++) {
      const phases = phasesExceptDismantle[pi];

      for (let si = 0; si < nN; si++) {
        const sec = normalSections[si];
        const spanMap = spansByNormal[si];
        const endsLocal: Date[] = [];

        for (const phase of phases) {
          const span = spanMap[phase] ?? 0;
          if (span <= 0) continue;

          // A: 同工区の前フェーズ
          //    （phasesExceptDismantleに合わせたインデックスで参照）
          const prevPhaseEnd =
            pi > 0 ? endN[si][pi - 1] : null;

          // B: 同フェーズの前工区（パイプライン）
          const prevSamePhaseEnd = si > 0 ? endN[si - 1][pi] : null;

          let gate = workStart;
          if (prevPhaseEnd) gate = nextWorkingAfter(prevPhaseEnd, opts);
          if (prevSamePhaseEnd) {
            const alt = nextWorkingAfter(prevSamePhaseEnd, opts);
            if (alt.getTime() > gate.getTime()) gate = alt;
          }

          const s = normalizeToWorking(gate, opts);
          const e = addWorkingDays(s, span, opts);

          startN[si][pi] = s;
          endN[si][pi] = e;

          schedule.push({
            groupTitle: sec.title,
            label: `${sec.title}-${phase}`,
            startDate: s,
            endDate: e,
            startKey: ymd(s),
            endKey: ymd(e),
            offset: 0,
            duration: 0,
            color: colorOf(phase, (n) => sec.items.find((x) => x.name === n)),
          });

          endsLocal.push(e);
        }

        // 同工区のフェーズ代表終了（最大）
        if (endsLocal.length > 0) {
          endN[si][pi] = new Date(Math.max(...endsLocal.map((d) => d.getTime())));
        } else {
          endN[si][pi] = pi > 0 ? endN[si][pi - 1] : workStart;
          startN[si][pi] = endN[si][pi];
        }
      }
    }

    // 外周足場（通常工区「足場組立」）の全体完了
    const globalScaffoldEnd =
      nN > 0
        ? new Date(
            Math.max(
              ...normalSections.map((_, idx) => endN[idx][0]).filter(Boolean)
                .map((d) => (d as Date).getTime())
            )
          )
        : workStart;

    /* ---------- 屋上：塔屋（hasTower のとき） ---------- */
    const towerDismantleEndByRoofTitle = new Map<string, Date>();

    for (const sec of roofSections) {
      if (!sec.roofOptions?.hasTower) continue;

      const find = (n: string) => sec.items.find((x) => x.name === n);
      const spanOf = (ph: string) => snapToHalfWeek(calcRawDays(find(ph)), saturdayOff);

      let prevEnd: Date | null = null;
      for (let pi = 0; pi < TOWER_PHASES.length; pi++) {
        const phases = TOWER_PHASES[pi];
        const endsLocal: Date[] = [];

        for (const phase of phases) {
          const span = spanOf(phase);
          if (span <= 0) continue;

          // 塔屋は最短直結（週頭寄せなし）で進める
          const base =
            prevEnd ? nextWorkingAfter(prevEnd, opts) : nextWorkingAfter(globalScaffoldEnd, opts);

          const s = normalizeToWorking(base, opts);
          const e = addWorkingDays(s, span, opts);

          schedule.push({
            groupTitle: sec.title,
            label: `${sec.title}-${phase}`,
            startDate: s,
            endDate: e,
            startKey: ymd(s),
            endKey: ymd(e),
            offset: 0,
            duration: 0,
            color: colorOf(phase, find),
          });
          endsLocal.push(e);
        }

        if (endsLocal.length > 0) {
          prevEnd = new Date(Math.max(...endsLocal.map((d) => d.getTime())));
        }
      }

      if (prevEnd) towerDismantleEndByRoofTitle.set(sec.title, prevEnd);
    }

    /* ---------- 屋上：本体（塗装＝塔屋ありは直結／塔屋なしは週頭寄せ、以降直結） ---------- */
    for (const sec of roofSections) {
      const find = (n: string) => sec.items.find((x) => x.name === n);
      const spanOf = (ph: string) => snapToHalfWeek(calcRawDays(find(ph)), saturdayOff);

      const afterScaffold = nextWorkingAfter(globalScaffoldEnd, opts);
      const towerEnd = towerDismantleEndByRoofTitle.get(sec.title);
      const gateByTower = towerEnd ? nextWorkingAfter(towerEnd, opts) : null;

      // 塔屋あり：空白を作らず直結
      // 塔屋なし：外周足場の翌営業日 → 次の月曜へ寄せ
      let paintStart: Date;
      if (gateByTower) {
        const gate = gateByTower.getTime() > afterScaffold.getTime() ? gateByTower : afterScaffold;
        paintStart = normalizeToWorking(gate, opts);
      } else {
        paintStart = alignToNextMondayOrSame(afterScaffold, opts);
      }

      const paintSpan = spanOf(ROOF_MAIN[0]);
      const paintEnd = addWorkingDays(paintStart, paintSpan, opts);

      schedule.push({
        groupTitle: sec.title,
        label: `${sec.title}-${ROOF_MAIN[0]}`,
        startDate: paintStart,
        endDate: paintEnd,
        startKey: ymd(paintStart),
        endKey: ymd(paintEnd),
        offset: 0,
        duration: 0,
        color: colorOf(ROOF_MAIN[0], find),
      });

      // 屋上防水 → その他防水 は直結
      const wpSpan = spanOf(ROOF_MAIN[1]);
      const wpStart = normalizeToWorking(nextWorkingAfter(paintEnd, opts), opts);
      const wpEnd = addWorkingDays(wpStart, wpSpan, opts);

      schedule.push({
        groupTitle: sec.title,
        label: `${sec.title}-${ROOF_MAIN[1]}`,
        startDate: wpStart,
        endDate: wpEnd,
        startKey: ymd(wpStart),
        endKey: ymd(wpEnd),
        offset: 0,
        duration: 0,
        color: colorOf(ROOF_MAIN[1], find),
      });

      const etcSpan = spanOf(ROOF_MAIN[2]);
      const etcStart = normalizeToWorking(nextWorkingAfter(wpEnd, opts), opts);
      const etcEnd = addWorkingDays(etcStart, etcSpan, opts);

      schedule.push({
        groupTitle: sec.title,
        label: `${sec.title}-${ROOF_MAIN[2]}`,
        startDate: etcStart,
        endDate: etcEnd,
        startKey: ymd(etcStart),
        endKey: ymd(etcEnd),
        offset: 0,
        duration: 0,
        color: colorOf(ROOF_MAIN[2], find),
      });
    }

    /* ---------- 屋上＋塔屋の全完了（通常の足場解体の待ちゲート） ---------- */
    const roofAndTowerAllEnd =
      roofSections.length > 0
        ? new Date(
            Math.max(
              ...schedule
                .filter((r) => roofSections.some((s) => s.title === r.groupTitle))
                .map((r) => r.endDate.getTime())
            )
          )
        : null;

    /* ---------- 通常工区：足場解体だけ後から配置（屋上完了待ち＋パイプライン） ---------- */
    if (dismantlePhaseIndex >= 0 && nN > 0) {
      // “足場解体”の所要
      const dismantleSpanOf = (si: number) => spansByNormal[si]["足場解体"] ?? 0;

      let prevDismantleEnd: Date | null = null; // パイプライン（前工区の解体終了）
      for (let si = 0; si < nN; si++) {
        const sec = normalSections[si];

        // 直前フェーズ（手直し）終了＝endN の最後の値
        const lastPhaseEndBeforeDismantle =
          endN[si][phasesExceptDismantle.length - 1] ?? workStart;

        // 基本ゲート：前フェーズ終了
        let gate = nextWorkingAfter(lastPhaseEndBeforeDismantle, opts);

        // パイプライン：前工区の足場解体終了も待つ
        if (prevDismantleEnd) {
          const alt = nextWorkingAfter(prevDismantleEnd, opts);
          if (alt.getTime() > gate.getTime()) gate = alt;
        }

        // ★ 屋上＋塔屋の全完了も必ず待つ
        if (roofAndTowerAllEnd) {
          const afterRoofAll = nextWorkingAfter(roofAndTowerAllEnd, opts);
          if (afterRoofAll.getTime() > gate.getTime()) gate = afterRoofAll;
        }

        const span = dismantleSpanOf(si);
        if (span > 0) {
          const s = normalizeToWorking(gate, opts);
          const e = addWorkingDays(s, span, opts);

          schedule.push({
            groupTitle: sec.title,
            label: `${sec.title}-足場解体`,
            startDate: s,
            endDate: e,
            startKey: ymd(s),
            endKey: ymd(e),
            offset: 0,
            duration: 0,
            color: colorOf("足場解体", (n) => sec.items.find((x) => x.name === n)),
          });

          prevDismantleEnd = e;
        } else {
          // 所要0ならスキップ
          prevDismantleEnd = prevDismantleEnd ?? lastPhaseEndBeforeDismantle;
        }
      }
    }

    /* ---------- 以降：共通（営業日配列・セル算出など） ---------- */
    if (schedule.length === 0) {
      return {
        schedule,
        workingDays: [],
        minStartAll: null,
        maxEndAll: null,
        prepStart: _prepStart,
        prepEndWorkNext: _prepEndWorkNext,
        cleanupStart: null,
        cleanupEnd: null,
        holidaySet,
      };
    }

    const minStart = new Date(Math.min(...schedule.map((r) => r.startDate.getTime())));
    const maxEnd = new Date(Math.max(...schedule.map((r) => r.endDate.getTime())));

    const _cleanupStart = addDays(maxEnd, 1);
    const _cleanupEnd = addDays(_cleanupStart, 15);

    const days = collectWorkingDays(minStart, maxEnd, { saturdayOff, holidaySet });
    const index = new Map<string, number>();
    days.forEach((d, i) => index.set(ymd(d), i));

    schedule.forEach((r) => {
      const si = index.get(r.startKey) ?? 0;
      const ei = index.get(r.endKey) ?? si;
      r.offset = si;
      r.duration = Math.max(1, ei - si + 1);
    });

    return {
      schedule,
      workingDays: days,
      minStartAll: minStart,
      maxEndAll: maxEnd,
      prepStart: _prepStart,
      prepEndWorkNext: _prepEndWorkNext,
      cleanupStart: _cleanupStart,
      cleanupEnd: _cleanupEnd,
      holidaySet,
    };
  }, [startDate, saturdayOff, holidayText, holidaySet, customSections]);
}
