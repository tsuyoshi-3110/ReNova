import type { SavedExcelSum } from "./types";

export function loadSavedExcelSums(key: string): SavedExcelSum[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(Boolean) as SavedExcelSum[];
  } catch {
    return [];
  }
}

export function saveSavedExcelSums(key: string, list: SavedExcelSum[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(list));
}

export function makeId(): string {
  // 例: "2026-02-01T05:12:33.123Z_8k3p9"
  return `${new Date().toISOString()}_${Math.random().toString(36).slice(2, 7)}`;
}
