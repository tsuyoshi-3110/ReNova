// src/app/sum-quantity/materials/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";

import type { SpecDef } from "./engine";

import { getNipponPaintSpec } from "./specs/nippon";
import { getKansaiPaintSpec } from "./specs/kansaiPaintSpecs";

import { getWaterproofSpec, type WaterproofMaker } from "./specs/waterproof";

// ✅ 塗装（paint/[maker]/[specId] で保存した計算）
const PAINT_STORAGE_KEY = "renova:paintCalc:saved:v1";

// ✅ 防水（waterproof/[maker]/[specId] で保存した計算）
const WATERPROOF_STORAGE_KEY = "renova:waterproofCalc:saved:v1";

const WORKNAME_KEY = "renova:materials:workName:v1";

/* =========================
   Types (saved schemas)
========================= */

type PaintAggRow = {
  kind: "liquidKg";
  name: string;
  totalKg: number;
  qty: number | null;
  unitLabel: string | null;

  // ✅ 実際に使った内容量（PDF規格表示に使う）
  packKgUsed?: number | null;
};

type PaintSavedCalc = {
  id: string;
  savedAt: string; // ISO
  specId: string;
  displayName: string;
  areas: Record<string, number>;
  aggregated: PaintAggRow[];
};

type WaterproofAggRow =
  | {
      kind: "liquidKg";
      name: string;
      flatKg: number;
      upstandKg: number;
      totalKg: number;
      qty: number | null;
      unitLabel: string | null;

      // ✅ 実際に使った内容量（PDF規格表示に使う）
      packKgUsed?: number | null;
    }
  | {
      kind: "sheetRoll";
      name: string;
      flatRolls: number;
      upstandRolls: number;
      totalRolls: number;
      rollLabel: string;
    }
  | {
      kind: "jointTapeRoll";
      name: string;
      flatRolls: number;
      upstandRolls: number;
      totalRolls: number;
      rollLabel: string;
      jointLenM: number;
      tapeLengthM: number;
    }
  | {
      kind: "endTape";
      name: string;
      flatQty: number;
      upstandQty: number;
      totalQty: number;
      rollLabel: string;
      tapeLengthM: number;
      perimeterM: number;
    };

type WaterproofSavedCalc = {
  id: string;
  savedAt: string; // ISO
  specId: string;
  displayName: string;
  areas: { flat: number; upstand: number; perimeter?: number };
  aggregated: WaterproofAggRow[];
};

type CombinedRow =
  | { category: "paint"; rec: PaintSavedCalc }
  | { category: "waterproof"; rec: WaterproofSavedCalc };

/* =========================
   Utils
========================= */

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isIsoString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isNullableNum(v: unknown): v is number | null {
  return v === null || isNum(v);
}

function isNullableStr(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

function isOptionalNullableNum(v: unknown): v is number | null | undefined {
  return v === undefined || v === null || isNum(v);
}

function isPaintAggRow(v: unknown): v is PaintAggRow {
  if (!isObject(v)) return false;
  return (
    v.kind === "liquidKg" &&
    typeof v.name === "string" &&
    isNum(v.totalKg) &&
    isNullableNum(v.qty) &&
    isNullableStr(v.unitLabel) &&
    isOptionalNullableNum((v as Record<string, unknown>).packKgUsed)
  );
}

function isPaintSavedCalc(v: unknown): v is PaintSavedCalc {
  if (!isObject(v)) return false;
  if (typeof v.id !== "string") return false;
  if (!isIsoString(v.savedAt)) return false;
  if (typeof v.specId !== "string") return false;
  if (typeof v.displayName !== "string") return false;
  if (!isObject(v.areas)) return false;
  if (!Array.isArray(v.aggregated)) return false;
  for (const r of v.aggregated) if (!isPaintAggRow(r)) return false;
  return true;
}

function isWaterproofAggRow(v: unknown): v is WaterproofAggRow {
  if (!isObject(v)) return false;

  const k = v.kind;
  if (k === "liquidKg") {
    return (
      typeof v.name === "string" &&
      isNum(v.flatKg) &&
      isNum(v.upstandKg) &&
      isNum(v.totalKg) &&
      isNullableNum(v.qty) &&
      isNullableStr(v.unitLabel) &&
      isOptionalNullableNum((v as Record<string, unknown>).packKgUsed)
    );
  }
  if (k === "sheetRoll") {
    return (
      typeof v.name === "string" &&
      isNum(v.flatRolls) &&
      isNum(v.upstandRolls) &&
      isNum(v.totalRolls) &&
      typeof v.rollLabel === "string"
    );
  }
  if (k === "jointTapeRoll") {
    return (
      typeof v.name === "string" &&
      isNum(v.flatRolls) &&
      isNum(v.upstandRolls) &&
      isNum(v.totalRolls) &&
      typeof v.rollLabel === "string" &&
      isNum(v.jointLenM) &&
      isNum(v.tapeLengthM)
    );
  }
  if (k === "endTape") {
    return (
      typeof v.name === "string" &&
      isNum(v.flatQty) &&
      isNum(v.upstandQty) &&
      isNum(v.totalQty) &&
      typeof v.rollLabel === "string" &&
      isNum(v.tapeLengthM) &&
      isNum(v.perimeterM)
    );
  }
  return false;
}

function isWaterproofSavedCalc(v: unknown): v is WaterproofSavedCalc {
  if (!isObject(v)) return false;
  if (typeof v.id !== "string") return false;
  if (!isIsoString(v.savedAt)) return false;
  if (typeof v.specId !== "string") return false;
  if (typeof v.displayName !== "string") return false;
  if (!isObject(v.areas)) return false;

  const flat = (v.areas as Record<string, unknown>).flat;
  const upstand = (v.areas as Record<string, unknown>).upstand;
  const perimeter = (v.areas as Record<string, unknown>).perimeter;

  if (!isNum(flat)) return false;
  if (!isNum(upstand)) return false;
  if (!(perimeter === undefined || isNum(perimeter))) return false;

  if (!Array.isArray(v.aggregated)) return false;
  for (const r of v.aggregated) if (!isWaterproofAggRow(r)) return false;

  return true;
}

function fmtDateTimeJp(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(n);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* =========================
   Spec helpers
========================= */

function getPaintSpec(specId: string): SpecDef | null {
  const a = getNipponPaintSpec(specId);
  if (a) return a;
  const b = getKansaiPaintSpec(specId);
  if (b) return b;
  return null;
}

const WATERPROOF_MAKERS = [
  "tajima",
  "agc",
] as const satisfies readonly WaterproofMaker[];

function getWaterproofSpecGuess(specId: string): SpecDef | null {
  for (const mk of WATERPROOF_MAKERS) {
    const s = getWaterproofSpec(mk, specId);
    if (s) return s;
  }
  return null;
}

/** spec の liquidKg 同名が複数（平場/立上り）なら平均、1つならそのまま */
function usagePerM2FromSpec(
  spec: SpecDef,
  materialName: string,
): number | null {
  const ks: number[] = [];
  for (const m of spec.materials) {
    if (m.kind !== "liquidKg") continue;
    if (m.name !== materialName) continue;

    const v = m.kgPerM2;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) ks.push(v);
  }
  if (ks.length === 0) return null;
  if (ks.length === 1) return round2(ks[0]);
  const avg = ks.reduce((a, b) => a + b, 0) / ks.length;
  return round2(avg);
}

function findMaterial(
  spec: SpecDef | null,
  kind: string,
  name: string,
): SpecDef["materials"][number] | undefined {
  if (!spec) return undefined;
  return spec.materials.find((x) => x.kind === kind && x.name === name);
}

function getRowPackKgUsed(r: PaintAggRow | WaterproofAggRow): number | null {
  if (r.kind !== "liquidKg") return null;
  const v = (r as { packKgUsed?: unknown }).packKgUsed;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  return null;
}

/** ✅ 摘要：specText（無希釈/希釈など）だけ */
function getNoteTextByRow(
  spec: SpecDef | null,
  r: PaintAggRow | WaterproofAggRow,
) {
  const m = findMaterial(spec, r.kind, r.name);
  const t = m ? (m as { specText?: unknown }).specText : undefined;
  if (typeof t === "string" && t.trim() !== "") return t.trim();
  return "";
}

/**
 * ✅ 規格：入目/寸法だけ（specTextは絶対に返さない）
 * 優先順： row.packKgUsed（ユーザー選択） > spec.packKg（仕様） > ""
 */
function getSpecLabelByRow(
  spec: SpecDef | null,
  r: PaintAggRow | WaterproofAggRow,
) {
  const m = findMaterial(spec, r.kind, r.name);

  if (r.kind === "liquidKg") {
    const used = getRowPackKgUsed(r);
    if (used != null) return `${used}kg`;

    if (m && m.kind === "liquidKg") {
      const packKg = m.packKg ?? null;
      if (packKg) return `${packKg}kg`;
    }
    return "";
  }

  if (r.kind === "sheetRoll") {
    if (m && m.kind === "sheetRoll") {
      const w = m.sheetWidthM;
      const l = m.sheetLengthM;
      if (w > 0 && l > 0) return `${fmtNum(l)}m×${fmtNum(w)}m`;
    }
    return "";
  }

  if (r.kind === "jointTapeRoll") {
    if (m && m.kind === "jointTapeRoll") {
      const l = m.tapeLengthM;
      const wmm = m.tapeWidthMm ?? null;
      if (l > 0 && wmm != null) return `${fmtNum(l)}m×${fmtNum(wmm)}mm`;
      if (l > 0) return `${fmtNum(l)}m`;
    }
    return "";
  }

  if (r.kind === "endTape") {
    if (m && m.kind === "endTape") {
      const l = m.tapeLengthM;
      if (l > 0) return `${fmtNum(l)}m`;
    }
    return "";
  }

  return "";
}

function aggTotalLabel(
  category: CombinedRow["category"],
  r: PaintAggRow | WaterproofAggRow,
) {
  if (r.kind === "liquidKg") {
    if (r.qty != null) return `${r.qty}`;
    return `${r.totalKg}`;
  }

  if (r.kind === "sheetRoll" || r.kind === "jointTapeRoll") {
    return `${Math.ceil(r.totalRolls)}`;
  }

  if (r.kind === "endTape") {
    return `${Math.ceil(r.totalQty)}`;
  }

  return "";
}

function aggUnitLabel(r: PaintAggRow | WaterproofAggRow) {
  if (r.kind === "liquidKg") {
    if (r.qty != null) return r.unitLabel ?? "缶";
    return "kg";
  }
  if (r.kind === "sheetRoll" || r.kind === "jointTapeRoll") {
    return r.rollLabel ?? "巻";
  }
  if (r.kind === "endTape") {
    return r.rollLabel ?? "巻";
  }
  return "";
}

/** ✅ 使用量は spec の kgPerM2 をそのまま（平場/立上りで違えば平均） */
function usageTextForRow(
  spec: SpecDef | null,
  r: PaintAggRow | WaterproofAggRow | undefined,
) {
  if (!r) return "";
  if (!spec) return "";
  if (r.kind !== "liquidKg") return "";

  const u = usagePerM2FromSpec(spec, r.name);
  if (u == null) return "";
  return `${u} kg/㎡`;
}

/* =========================
   PDF / Excel (Many)
========================= */

function openPrintPdfMany(recs: CombinedRow[], workName: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;

  const safeWorkName = workName.trim();

  const blocksHtml = recs
    .map((x, i) => {
      const isPaint = x.category === "paint";
      const spec = isPaint
        ? getPaintSpec(x.rec.specId)
        : getWaterproofSpecGuess(x.rec.specId);

      const headerAreas = (() => {
        if (x.category === "paint") {
          const area = (x.rec.areas as Record<string, number>).area ?? 0;
          return `面積 ${area}㎡`;
        }
        const flat = x.rec.areas.flat ?? 0;
        const up = x.rec.areas.upstand ?? 0;
        return `平場 ${flat}㎡　立上り ${up}㎡`;
      })();

      const headerLine = `${i + 1}・${spec?.displayName ?? x.rec.displayName}　${headerAreas}`;

      const rowsHtml = x.rec.aggregated
        .filter(
          (r): r is PaintAggRow | WaterproofAggRow =>
            !!r && typeof r === "object",
        )
        .map((r) => {
          const noteText = getNoteTextByRow(spec, r);
          const specLabel = getSpecLabelByRow(spec, r);
          const usage = usageTextForRow(spec, r);
          const req = aggTotalLabel(x.category, r);
          const unit = aggUnitLabel(r);

          return `
            <tr>
              <td class="c-name">${r.name}</td>
              <td class="c-note">${noteText}</td>
              <td class="c-spec">${specLabel}</td>
              <td class="c-use">${usage}</td>
              <td class="c-req">${req}</td>
              <td class="c-unit">${unit}</td>
            </tr>
          `;
        })
        .join("");

      return `
        <div class="block">
          <div class="line">${headerLine}</div>
          <table>
            <thead>
              <tr>
                <th>品名</th>
                <th>摘要</th>
                <th>規格</th>
                <th>使用量</th>
                <th>最低必要数量</th>
                <th>単位</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="savedAt">保存日時：${fmtDateTimeJp(x.rec.savedAt)}</div>
        </div>
      `;
    })
    .join("");

  const html = `
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title></title>
<style>
  @page { size: A4; margin: 12mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
      "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
    color: #111;
  }
  .btns { display:none; }
  @media screen { .btns { display:flex; gap:8px; margin: 10px 0; } }

  .title { font-size: 18px; font-weight: 800; text-align: center; margin: 0 0 10px; }
  .meta { font-size: 14px; margin: 0 0 14px; }
  .meta .label { font-weight: 700; }

  .block {
    margin: 0 0 20px;
    break-inside: avoid;
    page-break-inside: avoid;
    display: block;
  }

  .block table {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .line { font-size: 12px; margin: 0 0 6px; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }

  th, td { border: 1px solid #111; padding: 6px 8px; }
  th { text-align: center; background: #f3f3f3; }

  .c-name { width: 36%; }
  .c-note { width: 14%; }
  .c-spec { width: 18%; text-align:center; white-space:nowrap; }
  .c-use  { width: 14%; text-align: right; white-space: nowrap; }
  .c-req  { width: 10%; text-align: right; white-space: nowrap; }
  .c-unit { width: 8%;  text-align: center; white-space: nowrap; }

  .savedAt { margin-top: 6px; font-size: 11px; color:#444; }
</style>
</head>
<body>
  <div class="btns">
    <button onclick="window.print()">印刷（PDF保存）</button>
    <button onclick="window.close()">閉じる</button>
  </div>

  <h1 class="title">要缶数計算書</h1>
  <div class="meta"><span class="label">工事名称：</span>${safeWorkName}</div>

  ${blocksHtml}
</body>
</html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();
}

function exportExcelMany(recs: CombinedRow[], workName: string) {
  if (typeof window === "undefined") return;

  type AOA = Array<Array<string | number | null>>;

  const aoa: AOA = [];

  const pushRow = (r: Array<string | number | null>) => {
    const row = r.slice(0, 6);
    while (row.length < 6) row.push(null);
    aoa.push(row);
  };

  let rowNo = 0;

  pushRow(["要缶数計算書", null, null, null, null, null]);
  rowNo++;
  const titleRow = rowNo;

  pushRow([null, null, null, null, null, null]);
  rowNo++;

  pushRow(["工事名称：", workName.trim(), null, null, null, null]);
  rowNo++;
  const workNameRow = rowNo;

  pushRow([null, null, null, null, null, null]);
  rowNo++;

  const tableRanges: Array<{ r1: number; r2: number }> = [];

  recs.forEach((x, idx) => {
    const isPaint = x.category === "paint";
    const spec = isPaint
      ? getPaintSpec(x.rec.specId)
      : getWaterproofSpecGuess(x.rec.specId);

    const headerAreas = (() => {
      if (x.category === "paint") {
        const area = (x.rec.areas as Record<string, number>).area ?? 0;
        return `面積 ${area}㎡`;
      }
      const flat = x.rec.areas.flat ?? 0;
      const up = x.rec.areas.upstand ?? 0;
      return `平場 ${flat}㎡　立上り ${up}㎡`;
    })();

    const line = `${idx + 1}・${spec?.displayName ?? x.rec.displayName}　${headerAreas}`;

    pushRow([line, null, null, null, null, null]);
    rowNo++;

    pushRow(["品名", "摘要", "規格", "使用量", "最低必要数量", "単位"]);
    rowNo++;
    const headRow = rowNo;

    x.rec.aggregated
      .filter(
        (r): r is PaintAggRow | WaterproofAggRow =>
          !!r && typeof r === "object",
      )
      .forEach((r) => {
        const specText = getSpecTextByRow(spec, r); // ✅ ここがポイント
        const usage = usageTextForRow(spec, r);
        const req = aggTotalLabel(x.category, r);
        const unit = aggUnitLabel(r);

        pushRow([r.name, "", specText, usage, req, unit]);
        rowNo++;
      });

    const lastDetailRow = rowNo;

    pushRow([
      `保存日時：${fmtDateTimeJp(x.rec.savedAt)}`,
      null,
      null,
      null,
      null,
      null,
    ]);
    rowNo++;

    pushRow([null, null, null, null, null, null]);
    rowNo++;

    tableRanges.push({ r1: headRow, r2: lastDetailRow });
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  ws["!cols"] = [
    { wch: 30 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
  ];

  const thin = { style: "thin" as const, color: { rgb: "000000" } };
  const borderAll = { top: thin, left: thin, right: thin, bottom: thin };

  type StyledCell = XLSX.CellObject & { s?: Record<string, unknown> };

  const setStyle = (r: number, c: number, s: Record<string, unknown>) => {
    const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
    const cell = ws[addr] as StyledCell | undefined;
    if (!cell) return;
    cell.s = s;
  };

  const addMerge = (r1: number, c1: number, r2: number, c2: number) => {
    const m = { s: { r: r1 - 1, c: c1 - 1 }, e: { r: r2 - 1, c: c2 - 1 } };
    ws["!merges"] = (ws["!merges"] ?? []).concat(m);
  };

  addMerge(titleRow, 1, titleRow, 6);
  addMerge(workNameRow, 2, workNameRow, 6);

  const styleTitle: Record<string, unknown> = {
    font: { bold: true, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
  };

  const styleLabel: Record<string, unknown> = {
    font: { bold: true, sz: 14 },
    alignment: { horizontal: "left", vertical: "center" },
  };

  const styleValue: Record<string, unknown> = {
    font: { sz: 14 },
    alignment: { horizontal: "left", vertical: "center" },
  };

  const styleHead: Record<string, unknown> = {
    font: { bold: true, sz: 11 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: borderAll,
    fill: { patternType: "solid", fgColor: { rgb: "F3F3F3" } },
  };

  const styleCellLeft: Record<string, unknown> = {
    font: { sz: 11 },
    alignment: { horizontal: "left", vertical: "center", wrapText: true },
    border: borderAll,
  };

  const styleCellCenter: Record<string, unknown> = {
    font: { sz: 11 },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: borderAll,
  };

  const styleCellRight: Record<string, unknown> = {
    font: { sz: 11 },
    alignment: { horizontal: "right", vertical: "center", wrapText: true },
    border: borderAll,
  };

  const styleBlockLine: Record<string, unknown> = {
    font: { sz: 11 },
    alignment: { horizontal: "left", vertical: "center" },
  };

  const styleSavedAt: Record<string, unknown> = {
    font: { sz: 10 },
    alignment: { horizontal: "left", vertical: "center" },
  };

  setStyle(titleRow, 1, styleTitle);
  setStyle(workNameRow, 1, styleLabel);
  setStyle(workNameRow, 2, styleValue);

  for (let r = 1; r <= aoa.length; r++) {
    const a = aoa[r - 1] ?? [];
    const col1 = a[0];
    const col2 = a[1];

    const isHeader =
      col1 === "品名" &&
      col2 === "摘要" &&
      a[2] === "規格" &&
      a[3] === "使用量";

    if (typeof col1 === "string" && col1.startsWith("保存日時：")) {
      setStyle(r, 1, styleSavedAt);
      addMerge(r, 1, r, 6);
      continue;
    }

    if (typeof col1 === "string" && /^\d+・/.test(col1)) {
      setStyle(r, 1, styleBlockLine);
      addMerge(r, 1, r, 6);
      continue;
    }

    if (isHeader) {
      for (let c = 1; c <= 6; c++) setStyle(r, c, styleHead);
      continue;
    }
  }

  tableRanges.forEach(({ r1, r2 }) => {
    for (let r = r1 + 1; r <= r2; r++) {
      setStyle(r, 1, styleCellLeft);
      setStyle(r, 2, styleCellLeft);
      setStyle(r, 3, styleCellCenter);
      setStyle(r, 4, styleCellRight);
      setStyle(r, 5, styleCellRight);
      setStyle(r, 6, styleCellCenter);
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "要缶数計算書");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });

  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = `要缶数計算書_${new Date().toISOString().slice(0, 10)}.xlsx`;
  downloadBlob(blob, filename);
}

/* =========================
   Page
========================= */

export default function MaterialsMenuPage() {
  const [paintSaved, setPaintSaved] = useState<PaintSavedCalc[]>([]);
  const [waterproofSaved, setWaterproofSaved] = useState<WaterproofSavedCalc[]>(
    [],
  );
  const [workName, setWorkName] = useState<string>("");

  useEffect(() => {
    const paintRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(PAINT_STORAGE_KEY)
        : null;
    const wpRaw =
      typeof window !== "undefined"
        ? window.localStorage.getItem(WATERPROOF_STORAGE_KEY)
        : null;

    const paintParsed = safeJsonParse<unknown>(paintRaw, []);
    const wpParsed = safeJsonParse<unknown>(wpRaw, []);

    const nextPaint: PaintSavedCalc[] = [];
    if (Array.isArray(paintParsed)) {
      for (const it of paintParsed)
        if (isPaintSavedCalc(it)) nextPaint.push(it);
    }
    setPaintSaved(nextPaint);

    const nextWp: WaterproofSavedCalc[] = [];
    if (Array.isArray(wpParsed)) {
      for (const it of wpParsed) if (isWaterproofSavedCalc(it)) nextWp.push(it);
    }
    setWaterproofSaved(nextWp);

    const wn =
      typeof window !== "undefined"
        ? window.localStorage.getItem(WORKNAME_KEY)
        : null;
    setWorkName(wn ?? "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WORKNAME_KEY, workName);
  }, [workName]);

  const combinedTop = useMemo<CombinedRow[]>(() => {
    const list: CombinedRow[] = [];

    for (const r of paintSaved) list.push({ category: "paint", rec: r });
    for (const r of waterproofSaved)
      list.push({ category: "waterproof", rec: r });

    list.sort((a, b) => {
      const ta = new Date(a.rec.savedAt).getTime();
      const tb = new Date(b.rec.savedAt).getTime();
      return tb - ta;
    });

    return list.slice(0, 50);
  }, [paintSaved, waterproofSaved]);

  const persistPaint = (next: PaintSavedCalc[]) => {
    setPaintSaved(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PAINT_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const persistWaterproof = (next: WaterproofSavedCalc[]) => {
    setWaterproofSaved(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(WATERPROOF_STORAGE_KEY, JSON.stringify(next));
    }
  };

  const onDeleteSaved = (category: CombinedRow["category"], id: string) => {
    if (category === "paint") {
      persistPaint(paintSaved.filter((x) => x.id !== id));
      return;
    }
    persistWaterproof(waterproofSaved.filter((x) => x.id !== id));
  };

  const onDeleteAllSaved = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("保存一覧をすべて削除します。よろしいですか？");
      if (!ok) return;
    }
    persistPaint([]);
    persistWaterproof([]);
  };

  const onPdfAll = () => {
    if (combinedTop.length === 0) return;
    openPrintPdfMany(combinedTop, workName);
  };

  const onExcelAll = () => {
    if (combinedTop.length === 0) return;
    exportExcelMany(combinedTop, workName);
  };

  const categoryLabel = (c: CombinedRow["category"]) =>
    c === "paint" ? "塗装" : "防水";

  const areaLabel = (x: CombinedRow) => {
    if (x.category === "paint") {
      const area = (x.rec.areas as Record<string, number>).area ?? 0;
      return `面積 ${area}㎡`;
    }
    return `平場 ${x.rec.areas.flat}㎡ ／ 立上り ${x.rec.areas.upstand}㎡`;
  };

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">材料計算</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            工種を選択してください
          </p>
        </header>

        <div className="grid gap-4">
          <Link
            href="/sum-quantity/materials/paint"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">塗装工事</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              平米・使用量・規格から必要数量を算出
            </div>
          </Link>

          <Link
            href="/sum-quantity/materials/waterproof"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">防水工事</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              平面/立上り等の面積別に必要数量を算出
            </div>
          </Link>
        </div>

        <section className="rounded-xl border bg-white p-4 space-y-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-extrabold">工事名称</div>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
            value={workName}
            onChange={(e) => setWorkName(e.target.value)}
            placeholder="例：G池田住吉 ウレタン防水"
          />
          <div className="text-xs text-gray-600 dark:text-gray-300">
            ※この名称は、PDF/Excelの「工事名称」に反映されます（自動保存）
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold">保存一覧</div>
              <div className="text-xs text-gray-600 dark:text-gray-300">
                保存した計算結果をまとめてPDF/Excelにできます
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPdfAll}
                disabled={combinedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめてPDF
              </button>

              <button
                type="button"
                onClick={onExcelAll}
                disabled={combinedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめてExcel
              </button>

              <button
                type="button"
                onClick={onDeleteAllSaved}
                disabled={combinedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold text-red-600 hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめて削除
              </button>
            </div>
          </div>

          {combinedTop.length > 0 ? (
            <div className="grid gap-2">
              {combinedTop.slice(0, 20).map((x) => (
                <div
                  key={`${x.category}:${x.rec.id}`}
                  className="rounded-lg border p-3 flex items-start justify-between gap-3 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-extrabold text-gray-600 dark:text-gray-300">
                      {categoryLabel(x.category)}
                    </div>

                    <div className="mt-1 text-sm font-extrabold truncate">
                      {x.rec.displayName}
                    </div>

                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      保存：{fmtDateTimeJp(x.rec.savedAt)} ／ {areaLabel(x)}
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPrintPdfMany([x], workName)}
                      className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 dark:border-gray-800"
                    >
                      PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => exportExcelMany([x], workName)}
                      className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 dark:border-gray-800"
                    >
                      Excel
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSaved(x.category, x.rec.id)}
                      className="rounded-lg border px-3 py-2 text-xs font-extrabold text-red-600 hover:opacity-80 dark:border-gray-800"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              まだ保存がありません
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
