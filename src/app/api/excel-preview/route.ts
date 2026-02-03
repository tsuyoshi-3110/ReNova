import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

// 既存excel-sum内の util をできるだけ流用したいので、可能なら共通ファイルに移すのが理想。
// ここでは「最低限」動く形で同様の処理を書く。

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}
function normalizeText(s: string): string {
  return s
    .replace(/[－―ー−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

// excel-sum にある detectColumns(rows2d) を “そのまま” 使えるなら import して使ってください。
// ここでは「検出は返したい」ので、同じ関数を共通化するのがベストです。
// ↓あなたの detectColumns を共通に移せるなら、それを import してください。
import { detectColumns } from "@/lib/excel/detectColumns";

type ExcelPreviewOk = {
  ok: true;
  sheetName: string;
  previewRows: string[][];
  maxCols: number;
  detectedCols: {
    item: number;
    desc: number;
    qty: number;
    unit: number;
    amount: number | null;
    headerRowIndex: number | null;
  };
};

type ExcelPreviewError = { ok: false; error: string };

export async function POST(req: Request) {
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      const res: ExcelPreviewError = { ok: false, error: "file がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });

    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      const res: ExcelPreviewError = {
        ok: false,
        error: "シートが見つかりません",
      };
      return NextResponse.json(res, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      raw: true,
      defval: "",
    }) as unknown[];

    const rows2d = rows.filter((r) => Array.isArray(r)) as unknown[][];
    let maxCols = 0;
    for (const r of rows2d.slice(0, 200)) maxCols = Math.max(maxCols, r.length);

    const detected = detectColumns(rows2d);

    // UI表示用に「文字列化」して返す（クリックしやすい）
    const previewLimit = 40;
    const previewRows: string[][] = rows2d
      .slice(0, previewLimit)
      .map((r) =>
        Array.from({ length: maxCols }, (_, c) => normalizeText(toStr(r[c]))),
      );

    const res: ExcelPreviewOk = {
      ok: true,
      sheetName,
      previewRows,
      maxCols,
      detectedCols: {
        item: detected.item,
        desc: detected.desc,
        qty: detected.qty,
        unit: detected.unit,
        amount: detected.amount,
        headerRowIndex: detected.headerRowIndex,
      },
    };
    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const res: ExcelPreviewError = {
      ok: false,
      error: `Excel preview失敗: ${msg}`,
    };
    return NextResponse.json(res, { status: 500 });
  }
}
