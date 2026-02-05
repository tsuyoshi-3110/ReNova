import type { LaundryFloorDef, LaundryStatus } from "./types";

export const STATUS_LABEL: Record<LaundryStatus, string> = {
  ok: "○",
  limited: "△",
  ng: "×",
};

export const STATUS_HELP: Record<LaundryStatus, string> = {
  ok: "干せる",
  limited: "条件つき",
  ng: "干せない",
};

export function nextStatus(s: LaundryStatus): LaundryStatus {
  if (s === "ok") return "limited";
  if (s === "limited") return "ng";
  return "ok";
}

export function yyyyMmDd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** ルーム定義 */
export type Room = { id: string; label: string };

export function buildRooms(f: LaundryFloorDef): Room[] {
  const start = typeof f.startNo === "number" ? f.startNo : 1;

  return Array.from({ length: f.roomsCount }).map((_, i) => {
    const no = start + i;
    const label = `${no}`;
    const id = `${f.floor}-${no}`; // 一意ID
    return { id, label };
  });
}

export function calcMaxRooms(floors: LaundryFloorDef[]): number {
  if (!floors.length) return 0;
  return floors.reduce((mx, f) => Math.max(mx, f.roomsCount), 0);
}

/** 中央寄せ用の左パディング */
export function calcIndent(maxRooms: number, roomsCount: number): number {
  const diff = maxRooms - roomsCount;
  if (diff <= 0) return 0;
  return Math.floor(diff / 2);
}
