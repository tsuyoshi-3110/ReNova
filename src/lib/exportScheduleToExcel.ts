// src/lib/exportScheduleToExcel.ts
import { addDays, format } from "date-fns";
import { saveAs } from "file-saver";
import type * as XLSXTypes from "xlsx";
import XLSXRuntime from "xlsx-js-style";
const XLSX = XLSXRuntime as unknown as typeof import("xlsx");

/* ========= A3印刷用の型拡張 ========= */
type PageSetup = {
  orientation?: "portrait" | "landscape";
  paperSize?: number;
  fitToWidth?: number;
  fitToHeight?: number;
};
type Margins = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  header: number;
  footer: number;
};
type PrintOptions = {
  horizontalCentered?: boolean;
  verticalCentered?: boolean;
};
type WorkSheetEx = XLSXTypes.WorkSheet & {
  ["!pageSetup"]?: PageSetup;
  ["!margins"]?: Margins;
  ["!printOptions"]?: PrintOptions;
};
type WorkBookEx = XLSXTypes.WorkBook & {
  Workbook?: { Names?: Array<{ Name: string; Ref: string }> };
};

/* ========= 入力データ型 ========= */
export type ExcelScheduleRow = {
  groupTitle: string; // "1工区" / "屋上" / ""（準備・片付けは空でもOK）
  label: string;      // 表示名（例: "1-足場組立"）
  startDate: Date;
  endDate: Date;
  color: string;      // バー色（#RRGGBB）
};

export type ExportExcelOptions = {
  /** 片付けの工程群（実際の作業）が始まる日（休工なら繰上げ） */
  cleanupStart: Date;
  /** 互換のため受けるが、cleanupWeeks があればそちらを採用 */
  cleanupEnd: Date;
  /** 土曜休工（常に日曜は休工） */
  saturdayOff: boolean;
  /** 祝日 "YYYY-MM-DD" セット */
  holidaySet: Set<string>;
  // 任意
  title?: string;
  sheetName?: string;
  filename?: string;
  scale?: number;
  /** 準備期間（週） */
  prepWeeks?: number;     // default 4
  /** 片付け期間（週） */
  cleanupWeeks?: number;  // default 1
};

/* ========= スタイル定数 ========= */
const ALIGN_C = { alignment: { horizontal: "center", vertical: "center" } } as const;
const BORDER_THIN = { style: "thin", color: { rgb: "CCCCCC" } } as const;
const BORDER_HAIR = { style: "hair", color: { rgb: "DDDDDD" } } as const;
const BORDER_MED = { style: "medium", color: { rgb: "111111" } } as const;

const ymdKey = (d: Date) => format(d, "yyyy-MM-dd");
const jpWd = ["日", "月", "火", "水", "木", "金", "土"];

const textColorOn = (hex: string) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "#fff";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 140 ? "#111" : "#fff";
};

/* ========= 作業日ユーティリティ ========= */
function isOffDay(d: Date, saturdayOff: boolean, holidaySet: Set<string>): boolean {
  const dow = d.getDay();
  if (dow === 0) return true; // 日曜
  if (saturdayOff && dow === 6) return true; // 土曜（オプション）
  if (holidaySet.has(ymdKey(d))) return true; // 祝日
  return false;
}
function isWorkingDay(d: Date, saturdayOff: boolean, holidaySet: Set<string>) {
  return !isOffDay(d, saturdayOff, holidaySet);
}
function nextWorkingDay(d: Date, saturdayOff: boolean, holidaySet: Set<string>) {
  let cur = new Date(d);
  while (!isWorkingDay(cur, saturdayOff, holidaySet)) cur = addDays(cur, 1);
  return cur;
}
function prevWorkingDay(d: Date, saturdayOff: boolean, holidaySet: Set<string>) {
  let cur = new Date(d);
  while (!isWorkingDay(cur, saturdayOff, holidaySet)) cur = addDays(cur, -1);
  return cur;
}
function addWorkingDaysForward(base: Date, n: number, saturdayOff: boolean, holidaySet: Set<string>) {
  let d = new Date(base);
  let remain = Math.max(1, n);
  while (true) {
    if (isWorkingDay(d, saturdayOff, holidaySet)) {
      remain--;
      if (remain === 0) return d;
    }
    d = addDays(d, 1);
  }
}
function addWorkingDaysBackward(base: Date, n: number, saturdayOff: boolean, holidaySet: Set<string>) {
  let d = new Date(base);
  let remain = Math.max(1, n);
  while (true) {
    if (isWorkingDay(d, saturdayOff, holidaySet)) {
      remain--;
      if (remain === 0) return d;
    }
    d = addDays(d, -1);
  }
}

/* ========= メイン ========= */
export function exportScheduleToExcel(
  schedule: ExcelScheduleRow[],
  {
    cleanupStart,
    cleanupEnd,
    saturdayOff,
    holidaySet,
    title = "工事名称:",
    sheetName = "工程表",
    filename = "工程表_A3_横.xlsx",
    scale = 2.0,
    prepWeeks = 4,
    cleanupWeeks = 1,
  }: ExportExcelOptions
) {
  if (!schedule.length) return;

  /* --- スケール/フォント（曜日・日付を大きめ） --- */
  const SCALE = scale;
  const FONT_BASE = {
    title: 18,
    month: 16,
    day: 16,
    weekday: 16,
    taskName: 13,
    barLabel: 12,
    rightLabel: 12,
    groupTitle: 14,
  } as const;
  const FONT = {
    title: Math.round(FONT_BASE.title * SCALE),
    month: Math.round(FONT_BASE.month * SCALE),
    day: Math.round(FONT_BASE.day * SCALE),
    weekday: Math.round(FONT_BASE.weekday * SCALE),
    taskName: Math.round(FONT_BASE.taskName * SCALE),
    barLabel: Math.round(FONT_BASE.barLabel * SCALE),
    rightLabel: Math.round(FONT_BASE.rightLabel * SCALE),
    groupTitle: Math.round(FONT_BASE.groupTitle * SCALE),
  } as const;
  const TITLE_ROW_HPT = Math.round(64 * SCALE);
  const headerHeightsBase = [34, 26, 30, 38]; // タイトル, 月, 日, 曜
  const headerHeights = headerHeightsBase.map((h) => Math.round(h * SCALE));
  const dataHpt = Math.round(38 * SCALE);

  /* --- 準備/片付けの期間を実働日で決定（休工除外） --- */
  // 最初の足場組立の開始（なければ工程全体の最小開始）
  const scaffoldRows = schedule.filter((r) => /足場組立/.test(r.label));
  const firstScaffoldStart =
    scaffoldRows.length > 0
      ? new Date(
          scaffoldRows
            .map((r) => r.startDate)
            .reduce((min, d) => (d < min ? d : min), scaffoldRows[0].startDate)
        )
      : new Date(
          schedule
            .map((r) => r.startDate)
            .reduce((min, d) => (d < min ? d : min), schedule[0].startDate)
        );

  const workingPerWeek = saturdayOff ? 5 : 6;

  // 準備：足場開始直前の最終稼働日で終了、そこから週数*稼働日さかのぼる
  const prepEnd = prevWorkingDay(addDays(firstScaffoldStart, -1), saturdayOff, holidaySet);
  const prepStartFinal = addWorkingDaysBackward(prepEnd, Math.max(1, prepWeeks) * workingPerWeek, saturdayOff, holidaySet);

  // 片付け：開始を稼働日に繰上げ、週数*稼働日だけ進めた日が終了
  const cleanupStartFinal = nextWorkingDay(cleanupStart, saturdayOff, holidaySet);
  const cleanupEndByWeeks = addWorkingDaysForward(cleanupStartFinal, Math.max(1, cleanupWeeks) * workingPerWeek, saturdayOff, holidaySet);
  const cleanupEndFinal = cleanupEndByWeeks || cleanupEnd;

  // カレンダー範囲（準備開始〜片付け終了）
  const calStart = new Date(prepStartFinal);
  const calEnd = new Date(cleanupEndFinal);
  const calDays: Date[] = [];
  for (let d = new Date(calStart); d <= calEnd; d = addDays(d, 1)) calDays.push(new Date(d));

  /* --- 列構成 --- */
  const LABEL_SEC_COLS = 2; // A=グループ / B=工事名 / C..=日付

  /* --- AOA（見出し＋データ）--- */
  const aoa: (string | number)[][] = [];
  // r0: タイトル
  aoa.push([title, "", ...Array.from({ length: calDays.length }, () => "")]);
  // r1: 年月（後で結合）
  aoa.push(["", "", ...calDays.map(() => "")]);
  // r2: 日（文字列）
  aoa.push(["", "", ...calDays.map((d) => format(d, "d"))]);
  // r3: 曜日
  aoa.push(["", "", ...calDays.map((d) => jpWd[d.getDay()])]);

  // 表示行の構築
  type RowRec = { groupTitle: string; name: string; start: Date; end: Date; color: string; isGroupable: boolean };
  const rows: RowRec[] = [];

  rows.push({
    groupTitle: "",
    name: "準備期間",
    start: prepStartFinal,
    end: prepEnd,
    color: "#B0BEC5",
    isGroupable: false,
  });

  schedule.forEach((s) => {
    rows.push({
      groupTitle: s.groupTitle,
      name: s.label, // ★工事名（そのままB列へ）
      start: s.startDate,
      end: s.endDate,
      color: s.color,
      isGroupable: s.groupTitle !== "",
    });
  });

  rows.push({
    groupTitle: "",
    name: "片付け期間",
    start: cleanupStartFinal,
    end: cleanupEndFinal,
    color: "#B0BEC5",
    isGroupable: false,
  });

  // ★ AOAにデータ行を投入する時点で B 列に「工事名」を入れておく
  rows.forEach((row) => {
    aoa.push([row.groupTitle ?? "", row.name, ...Array(calDays.length).fill("")]);
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa) as WorkSheetEx;

  /* --- merges（重複宣言なし）--- */
  const merges: XLSXTypes.Range[] = [];

  // タイトル行 全幅
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: LABEL_SEC_COLS + calDays.length - 1 } });
  {
    const a1 = XLSX.utils.encode_cell({ r: 0, c: 0 });
    ws[a1] = ws[a1] || { v: title, t: "s" };
    ws[a1].s = { alignment: { horizontal: "left", vertical: "center", indent: 1 }, font: { bold: true, sz: FONT.title } };
  }

  // 月帯（r=1）
  const monthRuns: Array<{ start: number; end: number; label: string }> = [];
  let runStart = 0;
  for (let i = 1; i < calDays.length; i++) {
    if (calDays[i].getMonth() !== calDays[i - 1].getMonth()) {
      monthRuns.push({
        start: runStart,
        end: i - 1,
        label: `${calDays[i - 1].getFullYear()}年${calDays[i - 1].getMonth() + 1}月`,
      });
      runStart = i;
    }
  }
  monthRuns.push({
    start: runStart,
    end: calDays.length - 1,
    label: `${calDays[calDays.length - 1].getFullYear()}年${calDays[calDays.length - 1].getMonth() + 1}月`,
  });

  monthRuns.forEach((run) => {
    merges.push({ s: { r: 1, c: LABEL_SEC_COLS + run.start }, e: { r: 1, c: LABEL_SEC_COLS + run.end } });
    const head = XLSX.utils.encode_cell({ r: 1, c: LABEL_SEC_COLS + run.start });
    ws[head] = {
      v: run.label,
      t: "s",
      s: { ...ALIGN_C, fill: { patternType: "solid", fgColor: { rgb: "FFF8E1" } }, font: { bold: true, sz: FONT.month } },
    };
    for (let c = LABEL_SEC_COLS + run.start; c <= LABEL_SEC_COLS + run.end; c++) {
      const a = XLSX.utils.encode_cell({ r: 1, c });
      ws[a] = ws[a] || { v: "" };
      ws[a].s = { ...(ws[a].s || {}), border: { ...(ws[a].s?.border || {}), top: BORDER_THIN, bottom: BORDER_THIN } };
    }
  });

  // r2(日)/r3(曜)
  for (let c = 0; c < calDays.length; c++) {
    const dCell = XLSX.utils.encode_cell({ r: 2, c: LABEL_SEC_COLS + c });
    const wCell = XLSX.utils.encode_cell({ r: 3, c: LABEL_SEC_COLS + c });
    if (ws[dCell]) {
      ws[dCell].t = "s";
      ws[dCell].s = { font: { bold: true, sz: FONT.day }, ...ALIGN_C };
    }
    if (ws[wCell]) {
      ws[wCell].t = "s";
      ws[wCell].s = {
        font: { sz: FONT.weekday, color: { rgb: "555555" } },
        alignment: { horizontal: "center", vertical: "center", textRotation: 255, wrapText: true },
      };
    }
  }

  // 薄赤：休工帯
  const baseRow = 4;
  const lastRowIndex = baseRow + rows.length - 1;
  for (let c = 0; c < calDays.length; c++) {
    if (!isOffDay(calDays[c], saturdayOff, holidaySet)) continue;
    const col = LABEL_SEC_COLS + c;
    for (let r = 2; r <= lastRowIndex; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      ws[addr] = ws[addr] || { v: "" };
      ws[addr].s = { ...(ws[addr].s || {}), fill: { patternType: "solid", fgColor: { rgb: "FDE2E2" } } };
    }
  }

  // 列幅・行高
  const rowsCount = rows.length;
  const daysCount = calDays.length;
  const longestTask = Math.max(6, ...rows.map((r) => r.name.replace(/^(?:\d+工区-|屋上-)/, "").length));
  const totalWchTargetBase = 210;
  const secWchBase = 12;
  const taskWchBase = Math.min(48, Math.max(28, Math.ceil(longestTask * 1.25)));
  const dayWchBase = Math.max(4.2, +(((totalWchTargetBase - (secWchBase + taskWchBase)) / Math.max(1, daysCount))).toFixed(2));

  const COL_SCALE = 1.75;
  const secWch = +(secWchBase * COL_SCALE).toFixed(2);
  const taskWch = +(taskWchBase * COL_SCALE).toFixed(2);
  const dayWch = +(dayWchBase * COL_SCALE).toFixed(2);

  ws["!cols"] = [{ wch: secWch }, { wch: taskWch }, ...calDays.map(() => ({ wch: dayWch }))];
  ws["!rows"] = [
    { hpt: TITLE_ROW_HPT },
    { hpt: headerHeights[1] },
    { hpt: headerHeights[2] },
    { hpt: headerHeights[3] },
    ...Array.from({ length: rowsCount }, () => ({ hpt: dataHpt })),
  ];

  // 余白と印刷設定
  ws["!margins"] = { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2, header: 0.0, footer: 0.0 };
  ws["!pageSetup"] = { orientation: "landscape", paperSize: 8, fitToWidth: 1, fitToHeight: 1 };
  ws["!printOptions"] = { horizontalCentered: false, verticalCentered: false };

  /* --- 補助 --- */
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const toColIdx = (d: Date): number =>
    Math.floor((new Date(ymdKey(d)).getTime() - new Date(ymdKey(calStart)).getTime()) / 86400000);
  const neededColsFor = (text: string) => {
    const needWch = Math.max(10, Math.ceil(text.length * 2.0 + 2));
    return Math.max(1, Math.ceil(needWch / Math.max(1e-6, dayWch)));
  };
  const fontRgbForBg = (hex: string) => (textColorOn(hex) === "#fff" ? "FFFFFF" : "111111");

  /* --- B列スタイル（★値はAOAでもう入っている）--- */
  rows.forEach((_row, idx) => {
    const r = baseRow + idx;
    const bAddr = XLSX.utils.encode_cell({ r, c: 1 });
    ws[bAddr] = ws[bAddr] || { v: "", t: "s" };
    ws[bAddr].t = "s";
    ws[bAddr].s = { font: { sz: FONT.taskName, color: { rgb: "111111" } }, alignment: { vertical: "center", wrapText: true } };
  });

  /* --- バー描画 --- */
  const lastColIndex = LABEL_SEC_COLS + calDays.length - 1;

  const paintRun = (rowIdx: number, sIdx: number, eIdx: number, colorHex: string, labelInside?: string) => {
    const startCol = LABEL_SEC_COLS + sIdx;
    const endCol = LABEL_SEC_COLS + eIdx;
    const rgb6 = colorHex.replace("#", "").toUpperCase();
    for (let c = startCol; c <= endCol; c++) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c });
      ws[addr] = ws[addr] || { v: "" };
      ws[addr].s = {
        ...(ws[addr].s || {}),
        fill: { patternType: "solid", fgColor: { rgb: rgb6 } },
        border: { top: BORDER_HAIR, bottom: BORDER_HAIR, left: BORDER_HAIR, right: BORDER_HAIR },
      };
    }
    merges.push({ s: { r: rowIdx, c: startCol }, e: { r: rowIdx, c: endCol } });
    if (labelInside) {
      const head = XLSX.utils.encode_cell({ r: rowIdx, c: startCol });
      ws[head] = ws[head] || { v: "" };
      ws[head].v = labelInside;
      ws[head].t = "s";
      ws[head].s = {
        ...(ws[head].s || {}),
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
        font: { bold: true, color: { rgb: fontRgbForBg(colorHex) }, sz: FONT.barLabel },
      };
    }
  };

  rows.forEach((row, idx) => {
    const r = baseRow + idx;

    const sIdx = clamp(toColIdx(row.start), 0, calDays.length - 1);
    const eIdx = clamp(toColIdx(row.end), 0, calDays.length - 1);
    if (eIdx < sIdx) return;

    // 休工日を除外して連続ランに分割
    const runs: Array<{ s: number; e: number }> = [];
    let curS: number | null = null;
    for (let c = sIdx; c <= eIdx; c++) {
      const day = calDays[c];
      const off = isOffDay(day, saturdayOff, holidaySet);
      if (off) {
        if (curS !== null) {
          runs.push({ s: curS, e: c - 1 });
          curS = null;
        }
      } else {
        if (curS === null) curS = c;
        if (c === eIdx && curS !== null) runs.push({ s: curS, e: c });
      }
    }

    const needCols = neededColsFor(row.name);
    let bestRunIdx = -1;
    let bestLen = -1;
    runs.forEach((run, i) => {
      const len = run.e - run.s + 1;
      if (len >= needCols && len > bestLen) {
        bestLen = len;
        bestRunIdx = i;
      }
    });

    let lastEndCol = -1;
    runs.forEach((run, i) => {
      const inside = i === bestRunIdx ? row.name : undefined;
      paintRun(r, run.s, run.e, row.color, inside);
      lastEndCol = LABEL_SEC_COLS + run.e;
    });

    // 全部短いときは右にラベル領域
    if (bestRunIdx === -1 && lastEndCol >= 0) {
      const startC = Math.min(lastEndCol + 1, lastColIndex);
      const endC = Math.min(startC + needCols - 1, lastColIndex);
      merges.push({ s: { r, c: startC }, e: { r, c: endC } });
      const lab = XLSX.utils.encode_cell({ r, c: startC });
      ws[lab] = { v: row.name, t: "s", s: { alignment: { vertical: "center", horizontal: "left", wrapText: true }, font: { bold: true, sz: FONT.rightLabel } } };
    }
  });

  /* --- グリッド・外枠 --- */
  // 薄い格子
  for (let r = 2; r <= lastRowIndex; r++) {
    for (let c = 0; c <= lastColIndex; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = ws[addr] || { v: "" };
      const cur = ws[addr].s?.border || {};
      ws[addr].s = {
        ...(ws[addr].s || {}),
        border: {
          top: cur.top ?? BORDER_HAIR,
          bottom: cur.bottom ?? BORDER_HAIR,
          left: cur.left ?? BORDER_HAIR,
          right: cur.right ?? BORDER_HAIR,
        },
      };
    }
  }
  // 行ベースラインやや強調
  for (let r = 4; r <= lastRowIndex; r++) {
    for (let c = 0; c <= lastColIndex; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      ws[addr] = ws[addr] || { v: "" };
      ws[addr].s = { ...(ws[addr].s || {}), border: { ...(ws[addr].s?.border || {}), top: BORDER_THIN, bottom: BORDER_THIN } };
    }
  }
  // 月初縦太罫
  monthRuns.forEach((run) => {
    const col = LABEL_SEC_COLS + run.start;
    for (let r = 1; r <= lastRowIndex; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: col });
      ws[addr] = ws[addr] || { v: "" };
      ws[addr].s = { ...(ws[addr].s || {}), border: { ...(ws[addr].s?.border || {}), left: BORDER_MED } };
    }
  });
  // A/Bの間を太罫
  for (let r = 0; r <= lastRowIndex; r++) {
    const aRight = XLSX.utils.encode_cell({ r, c: 0 });
    ws[aRight] = ws[aRight] || { v: ws[aRight]?.v ?? "" };
    ws[aRight].s = { ...(ws[aRight].s || {}), border: { ...(ws[aRight].s?.border || {}), right: BORDER_MED } };
    const bLeft = XLSX.utils.encode_cell({ r, c: 1 });
    ws[bLeft] = ws[bLeft] || { v: ws[bLeft]?.v ?? "" };
    ws[bLeft].s = { ...(ws[bLeft].s || {}), border: { ...(ws[bLeft].s?.border || {}), left: BORDER_MED } };
  }
  // グループ見出し（A列縦書き）
  const groupRanges: Array<{ title: string; startR: number; endR: number }> = [];
  let curTitle: string | null = null;
  let curStartIdx = -1;
  rows.forEach((rr, i) => {
    if (!rr.isGroupable) return;
    if (curTitle === null) {
      curTitle = rr.groupTitle;
      curStartIdx = i;
    } else if (curTitle !== rr.groupTitle) {
      groupRanges.push({ title: curTitle, startR: baseRow + curStartIdx, endR: baseRow + i - 1 });
      curTitle = rr.groupTitle;
      curStartIdx = i;
    }
  });
  const lastTaskIdx = rows.length - 2;
  if (curTitle && curStartIdx >= 0 && lastTaskIdx >= curStartIdx) {
    groupRanges.push({ title: curTitle, startR: baseRow + curStartIdx, endR: baseRow + lastTaskIdx });
  }
  groupRanges.forEach(({ title, startR, endR }) => {
    merges.push({ s: { r: startR, c: 0 }, e: { r: endR, c: 0 } });
    const addr = XLSX.utils.encode_cell({ r: startR, c: 0 });
    ws[addr] = {
      v: title,
      t: "s",
      s: { alignment: { horizontal: "center", vertical: "center", wrapText: true, textRotation: 255 }, font: { bold: true, sz: FONT.groupTitle } },
    };
    for (let c = 0; c <= lastColIndex; c++) {
      const cut = XLSX.utils.encode_cell({ r: endR, c });
      ws[cut] = ws[cut] || { v: "" };
      ws[cut].s = { ...(ws[cut].s || {}), border: { ...(ws[cut].s?.border || {}), bottom: BORDER_MED } };
    }
  });

  // ★外枠 太枠
  for (let c = 0; c <= lastColIndex; c++) {
    const top = XLSX.utils.encode_cell({ r: 0, c });
    ws[top] = ws[top] || { v: ws[top]?.v ?? "" };
    ws[top].s = { ...(ws[top].s || {}), border: { ...(ws[top].s?.border || {}), top: BORDER_MED } };
    const bottom = XLSX.utils.encode_cell({ r: lastRowIndex, c });
    ws[bottom] = ws[bottom] || { v: ws[bottom]?.v ?? "" };
    ws[bottom].s = { ...(ws[bottom].s || {}), border: { ...(ws[bottom].s?.border || {}), bottom: BORDER_MED } };
  }
  for (let r = 0; r <= lastRowIndex; r++) {
    const left = XLSX.utils.encode_cell({ r, c: 0 });
    ws[left] = ws[left] || { v: ws[left]?.v ?? "" };
    ws[left].s = { ...(ws[left].s || {}), border: { ...(ws[left].s?.border || {}), left: BORDER_MED } };
    const right = XLSX.utils.encode_cell({ r, c: lastColIndex });
    ws[right] = ws[right] || { v: ws[right]?.v ?? "" };
    ws[right].s = { ...(ws[right].s || {}), border: { ...(ws[right].s?.border || {}), right: BORDER_MED } };
  }

  /* --- マージと保存 --- */
  ws["!merges"] = (ws["!merges"] || []).concat(merges);
  const lastAddrA1 = XLSX.utils.encode_cell({ r: lastRowIndex, c: lastColIndex });

  const wb = XLSX.utils.book_new() as WorkBookEx;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  wb.Workbook = wb.Workbook || { Names: [] };
  wb.Workbook.Names = wb.Workbook.Names || [];
  wb.Workbook.Names.push({ Name: "_xlnm.Print_Area", Ref: `'${sheetName}'!$A$1:${lastAddrA1}` });

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  saveAs(new Blob([out], { type: "application/octet-stream" }), filename);
}
