// src/components/renova/specCodeSummary.ts

import type { SpecItem } from "@/types/pdf";
import { estimateAreaFromSpecItem } from "./renova/specUtils";

export type SpecCodeSummaryRow = {
  code: string;
  mainText: string;
  lineCount: number;
};

/**
 * 工種行(items) から 仕様番号別サマリを作成するヘルパー
 */
export function buildSpecCodeSummary(
  items: SpecItem[] | null,
  guessSpecCode: (item: SpecItem) => string | null | undefined,
  noSpecLabel: string
): SpecCodeSummaryRow[] {
  if (!items || items.length === 0) return [];

  type UnitAgg = { qty: number; lines: number };
  type Acc = {
    areaM2: number;
    areaLines: number;
    units: Record<string, UnitAgg>;
  };

  const map = new Map<string, Acc>();

  for (const it of items) {
    const code = guessSpecCode(it) ?? noSpecLabel;
    const acc = map.get(code) ?? { areaM2: 0, areaLines: 0, units: {} };

    const area = estimateAreaFromSpecItem(it);

    if (area !== null && Number.isFinite(area) && area > 0) {
      acc.areaM2 += area;
      acc.areaLines += 1;
    } else {
      const rawUnit = (it.unit ?? "").toString().trim() || "式";
      const u = acc.units[rawUnit] ?? { qty: 0, lines: 0 };
      u.qty += it.quantity;
      u.lines += 1;
      acc.units[rawUnit] = u;
    }

    map.set(code, acc);
  }

  const rows: SpecCodeSummaryRow[] = [];

  for (const [code, acc] of map.entries()) {
    const unitEntries = Object.entries(acc.units);

    const totalLines =
      acc.areaLines + unitEntries.reduce((s, [, v]) => s + v.lines, 0);

    const parts: string[] = [];

    if (acc.areaM2 > 0) {
      const val = Math.round(acc.areaM2 * 100) / 100;
      parts.push(`${val.toFixed(2)} ㎡`);
    }

    if (unitEntries.length > 0) {
      const ordered = unitEntries.sort(([uA], [uB]) => {
        const order = ["m", "㎡", "ヶ所", "式"];
        const ia = order.indexOf(uA);
        const ib = order.indexOf(uB);
        if (ia === -1 && ib === -1) {
          return uA.localeCompare(uB, "ja");
        }
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      const unitTexts = ordered.map(([u, v]) => {
        const q = v.qty;
        if (u === "m") {
          const val = Math.round(q * 10) / 10;
          return `${val}m`;
        }
        if (u === "㎡") {
          const val = Math.round(q * 100) / 100;
          return `${val.toFixed(2)}㎡`;
        }
        return `${q}${u}`;
      });

      parts.push(unitTexts.join(" / "));
    }

    const mainText = parts.length > 0 ? parts.join(" / ") : "-";

    rows.push({
      code,
      mainText,
      lineCount: totalLines,
    });
  }

  // 並び順：仕様番号なし → それ以外を日本語ロケール順
  rows.sort((a, b) => {
    if (a.code === noSpecLabel && b.code !== noSpecLabel) return -1;
    if (b.code === noSpecLabel && a.code !== noSpecLabel) return 1;
    return a.code.localeCompare(b.code, "ja");
  });

  return rows;
}
