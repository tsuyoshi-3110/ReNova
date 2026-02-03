import type { DetectColsResponse, ExcelSumPreviewRow } from "./types";

export function isOkResponse<T extends { ok: true }>(data: unknown): data is T {
  return (
    typeof data === "object" &&
    data !== null &&
    "ok" in data &&
    (data as { ok: unknown }).ok === true
  );
}

export function isDetectColsOk(data: unknown): data is DetectColsResponse {
  if (!isOkResponse<DetectColsResponse>(data)) return false;

  const d = data as DetectColsResponse;

  if (typeof d.sheetName !== "string") return false;

  const h = d.headerRowIndex;
  if (!(h === null || (Number.isInteger(h) && h >= 0))) return false;

  const cols = d.detectedCols;
  if (typeof cols !== "object" || cols === null) return false;

  const is1Based = (n: unknown): n is number =>
    Number.isInteger(n) && (n as number) >= 1;

  if (!is1Based(cols.item)) return false;
  if (!is1Based(cols.desc)) return false;
  if (!is1Based(cols.qty)) return false;
  if (!is1Based(cols.unit)) return false;
  if (!(cols.amount === null || is1Based(cols.amount))) return false;
  if (!is1Based(cols.size)) return false;

  return true;
}

export function formatNumber(n: number): string {
  const s = n.toFixed(6);
  return s.replace(/\.?0+$/, "");
}

export function formatDateTimeJa(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function normalizeUnit(u: string): string {
  // Excel側で改行/空白が混ざることがある（例: "ヶ\n所"）ので、空白類は全除去して判定する
  const s = u.replace(/\s+/g, "").trim();

  // メートル
  if (s === "ｍ" || s === "M" || s === "m" || s === "メートル") return "m";

  // ㎡
  if (s === "m2" || s === "m²" || s === "㎡" || s === "平米" || s === "m^2") {
    return "㎡";
  }

  // 箇所
  if (s === "ヶ所" || s === "ケ所" || s === "個所" || s === "箇所")
    return "箇所";

  // 階段など：段
  if (s === "段") return "段";

  return s;
}

export function recomputeSumsByUnit(
  preview: ExcelSumPreviewRow[],
): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const r of preview) {
    const u = typeof r.unit === "string" ? normalizeUnit(r.unit) : "";
    const q =
      typeof r.qty === "number" && Number.isFinite(r.qty) ? r.qty : null;
    if (!u || q == null) continue;
    sums[u] = (sums[u] ?? 0) + q;
  }
  return sums;
}

export function isValid1BasedInt(v: string): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1;
}

export function hasRequiredManualCols(
  itemCol1Based: string,
  descCol1Based: string,
  qtyCol1Based: string,
  unitCol1Based: string,
  sizeCol1Based: string,
): boolean {
  const required = [
    itemCol1Based,
    descCol1Based,
    qtyCol1Based,
    unitCol1Based,
    sizeCol1Based,
  ];
  return required.every((v) => isValid1BasedInt(v));
}

export function toPositiveNumberOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  // 0 は有効（=0として採用し、㎡換算も0にする）
  if (n < 0) return null;
  return n;
}
