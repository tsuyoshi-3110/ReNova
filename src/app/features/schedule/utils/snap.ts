// src/features/schedule/utils/snap.ts
export function snapToHalfWeek(rawDays: number, saturdayOff: boolean): number {
  if (rawDays <= 0) return 0;
  const WEEK = saturdayOff ? 5 : 6;
  const half = WEEK / 2; // 2.5 or 3
  const units = Math.ceil(rawDays / half);
  if (WEEK === 6) return units * 3; // 1半週=3日
  const evenPairs = Math.floor(units / 2); // 2半週=1週=5日
  const hasHalf = units % 2 === 1;
  return evenPairs * 5 + (hasHalf ? 3 : 0);
}
