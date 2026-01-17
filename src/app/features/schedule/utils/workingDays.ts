// src/features/schedule/utils/workingDays.ts
import { addDays, format, isSunday } from "date-fns";

export const ymd = (d: Date) => format(d, "yyyy-MM-dd");
export const isSaturday = (d: Date) => d.getDay() === 6;
export const nextDate = (d: Date) => addDays(d, 1);

export const makeHolidaySet = (text: string) => {
  const s = new Set<string>();
  text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean)
    .forEach((v) => s.add(v));
  return s;
};

export const isWorkingDay = (
  d: Date,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
) => !isSunday(d) && !(opts.saturdayOff && isSaturday(d)) && !opts.holidaySet.has(ymd(d));

export const normalizeToWorking = (
  d: Date,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
) => {
  let cur = new Date(d);
  while (!isWorkingDay(cur, opts)) cur = nextDate(cur);
  return cur;
};

export const nextWorkingAfter = (
  d: Date,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
) => normalizeToWorking(nextDate(d), opts);

// start を含めて N 営業日目の実日付
export const addWorkingDays = (
  start: Date,
  days: number,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
) => {
  if (days <= 0) return new Date(start);
  let cur = new Date(start), counted = 0;
  while (counted < days) {
    if (isWorkingDay(cur, opts)) counted++;
    if (counted < days) cur = nextDate(cur);
  }
  return cur;
};

export const collectWorkingDays = (
  start: Date,
  end: Date,
  opts: { saturdayOff: boolean; holidaySet: Set<string> }
) => {
  const out: Date[] = [];
  let cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur, opts)) out.push(new Date(cur));
    cur = nextDate(cur);
  }
  return out;
};
