"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";

import type { SpecDef } from "./engine";
import { getTajimaSpec } from "./specs/tajimaSpecs";

type AggRow =
  | {
      kind: "liquidKg";
      name: string;
      flatKg: number;
      upstandKg: number;
      totalKg: number;
      qty: number | null;
      unitLabel: string | null;
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
    };

const STORAGE_KEY = "renova:tajimaCalc:saved:v1";
const WORKNAME_KEY = "renova:tajimaCalc:workName:v1";

type SavedCalc = {
  id: string;
  savedAt: string; // ISO
  specId: string;
  displayName: string;
  areas: { flat: number; upstand: number };
  aggregated: AggRow[];
};

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
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
function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function aggTotalLabel(r: AggRow) {
  if (r.kind === "liquidKg") {
    if (r.qty != null && r.unitLabel) return `${r.qty}`;
    return `${r.totalKg}`;
  }
  return `${Math.ceil(r.totalRolls)}`;
}

function aggUnitLabel(r: AggRow) {
  if (r.kind === "liquidKg") {
    if (r.qty != null && r.unitLabel) return r.unitLabel;
    return "kg";
  }
  return r.rollLabel ?? "巻";
}

function findMaterial(
  spec: SpecDef | null,
  r: AggRow,
): SpecDef["materials"][number] | undefined {
  if (!spec) return undefined;
  return spec.materials.find((x) => x.kind === r.kind && x.name === r.name);
}

function fmtNum(n: number) {
  return Number.isInteger(n) ? String(n) : String(n);
}

function getSpecText(spec: SpecDef | null, r: AggRow) {
  const m = findMaterial(spec, r);

  // ✅ 表示用 specText が入っていれば最優先（既存仕様を壊さない）
  if (m && typeof m.specText === "string" && m.specText.trim() !== "") {
    return m.specText.trim();
  }

  if (r.kind === "liquidKg") {
    if (m && m.kind === "liquidKg") {
      const packKg = m.packKg ?? null;
      if (packKg) return `${packKg}kg`;
    }
    return "";
  }

  // ✅ シート：規格に「長さ×幅」（m）
  if (r.kind === "sheetRoll") {
    if (m && m.kind === "sheetRoll") {
      const w = m.sheetWidthM;
      const l = m.sheetLengthM;
      if (w > 0 && l > 0) return `${fmtNum(l)}m×${fmtNum(w)}m`;
    }
    return "";
  }

  // ✅ テープ：規格に「長さ×幅」（m × mm）
  if (r.kind === "jointTapeRoll") {
    if (m && m.kind === "jointTapeRoll") {
      const l = m.tapeLengthM;
      const wmm = m.tapeWidthMm ?? null;
      if (l > 0 && wmm != null) return `${fmtNum(l)}m×${fmtNum(wmm)}mm`;
      if (l > 0) return `${fmtNum(l)}m`;
    }
    return "";
  }

  return "";
}

function usageText(rec: SavedCalc, r: AggRow) {
  const totalArea = (rec.areas.flat ?? 0) + (rec.areas.upstand ?? 0);
  if (!(totalArea > 0)) return "";

  if (r.kind === "liquidKg") {
    const u = round2((r.totalKg ?? 0) / totalArea);
    return `${u} kg/㎡`;
  }

  // ✅ シート＆テープは使用量を出さない（空）
  return "";
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

/** まとめてPDF（印刷→PDF保存） */
function openPrintPdfMany(recs: SavedCalc[], workName: string) {
  if (typeof window === "undefined") return;
  const w = window.open("", "_blank");
  if (!w) return;

  const safeWorkName = workName.trim();

  const blocksHtml = recs
    .map((rec, i) => {
      const spec = getTajimaSpec(rec.specId);

      const headerLine = `${i + 1}・${spec?.displayName ?? rec.displayName}　平場 ${
        rec.areas.flat
      }㎡　立上り ${rec.areas.upstand}㎡`;

      const rowsHtml = rec.aggregated
        .map((r) => {
          const specText = getSpecText(spec, r);
          const usage = usageText(rec, r);
          const req = aggTotalLabel(r);
          const unit = aggUnitLabel(r);

          return `
            <tr>
              <td class="c-name">${r.name}</td>
              <td class="c-note"></td>
              <td class="c-spec">${specText}</td>
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

function exportExcelMany(recs: SavedCalc[], workName: string) {
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

  recs.forEach((rec, idx) => {
    const spec = getTajimaSpec(rec.specId);
    const line = `${idx + 1}・${spec?.displayName ?? rec.displayName}　平場 ${
      rec.areas.flat
    }㎡　立上り ${rec.areas.upstand}㎡`;

    pushRow([line, null, null, null, null, null]);
    rowNo++;

    pushRow(["品名", "摘要", "規格", "使用量", "最低必要数量", "単位"]);
    rowNo++;
    const headRow = rowNo;

    rec.aggregated.forEach((r) => {
      const specText = getSpecText(spec, r);
      const usage = usageText(rec, r);
      const req = aggTotalLabel(r);
      const unit = aggUnitLabel(r);

      pushRow([r.name, "", specText, usage, req, unit]);
      rowNo++;
    });

    const lastDetailRow = rowNo;

    pushRow([`保存日時：${fmtDateTimeJp(rec.savedAt)}`, null, null, null, null, null]);
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
      col1 === "品名" && col2 === "摘要" && a[2] === "規格" && a[3] === "使用量";

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

  const filename = `ウレタン要缶数計算書_${new Date().toISOString().slice(0, 10)}.xlsx`;

  downloadBlob(blob, filename);
}

export default function MaterialsMenuPage() {
  const [saved, setSaved] = useState<SavedCalc[]>([]);
  const [workName, setWorkName] = useState<string>("");

  useEffect(() => {
    const list = safeJsonParse<SavedCalc[]>(
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
      [],
    );
    setSaved(Array.isArray(list) ? list : []);

    const wn =
      typeof window !== "undefined" ? window.localStorage.getItem(WORKNAME_KEY) : null;
    setWorkName(wn ?? "");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(WORKNAME_KEY, workName);
  }, [workName]);

  const persistSaved = (next: SavedCalc[]) => {
    setSaved(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  };

  const onDeleteSaved = (id: string) => {
    const next = saved.filter((x) => x.id !== id);
    persistSaved(next);
  };

  const savedTop = useMemo(() => saved.slice(0, 50), [saved]);

  const onPdfAll = () => {
    if (savedTop.length === 0) return;
    openPrintPdfMany(savedTop, workName);
  };

  const onExcelAll = () => {
    if (savedTop.length === 0) return;
    exportExcelMany(savedTop, workName);
  };

  const onDeleteAllSaved = () => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("保存一覧をすべて削除します。よろしいですか？");
      if (!ok) return;
    }
    persistSaved([]);
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
                disabled={savedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめてPDF
              </button>

              <button
                type="button"
                onClick={onExcelAll}
                disabled={savedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめてExcel
              </button>

              <button
                type="button"
                onClick={onDeleteAllSaved}
                disabled={savedTop.length === 0}
                className="rounded-lg border px-3 py-2 text-xs font-extrabold text-red-600 hover:opacity-80 disabled:opacity-40 dark:border-gray-800"
              >
                まとめて削除
              </button>
            </div>
          </div>

          {savedTop.length > 0 ? (
            <div className="grid gap-2">
              {savedTop.slice(0, 20).map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border p-3 flex items-start justify-between gap-3 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold truncate">
                      {rec.displayName}
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                      保存：{fmtDateTimeJp(rec.savedAt)} ／ 平場 {rec.areas.flat}㎡ ／
                      立上り {rec.areas.upstand}㎡
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openPrintPdfMany([rec], workName)}
                      className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 dark:border-gray-800"
                    >
                      PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => exportExcelMany([rec], workName)}
                      className="rounded-lg border px-3 py-2 text-xs font-extrabold hover:opacity-80 dark:border-gray-800"
                    >
                      Excel
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSaved(rec.id)}
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
