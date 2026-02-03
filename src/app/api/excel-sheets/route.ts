// app/api/excel-sheets/route.ts
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

type ExcelSheetsOk = { ok: true; sheetNames: string[] };
type ExcelSheetsError = { ok: false; error: string };

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const file = fd.get("file");
    if (!(file instanceof File)) {
      const res: ExcelSheetsError = { ok: false, error: "file がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });

    const sheetNames = (wb.SheetNames ?? []).filter(
      (s) => typeof s === "string" && s.trim() !== "",
    );

    const res: ExcelSheetsOk = { ok: true, sheetNames };
    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : toStr(e);
    const res: ExcelSheetsError = { ok: false, error: `sheet取得失敗: ${msg}` };
    return NextResponse.json(res, { status: 500 });
  }
}
