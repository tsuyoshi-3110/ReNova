import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

type ExcelCodesResponse = {
  ok: true;
  sheetName: string;
  codes: string[];
};

type ExcelCodesError = { ok: false; error: string };

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

function normalizeHyphen(s: string): string {
  return s.replace(/[－―ー−]/g, "-");
}

// ✅ 日本語の表記ゆれ対策：全角英数/全角数字/半角カナなどを統一
function normalizeJaText(s: string): string {
  // NFKC: 全角数字「２」→「2」、半角カナ→全角カナ、濁点結合など
  return s.normalize("NFKC");
}

// ✅ シート名の揺れ（末尾スペース/ハイフン違い）対策
function normalizeSheetName(s: string): string {
  return normalizeHyphen(s).replace(/\s+/g, "").trim();
}

// ✅ 指定シート名を「そのまま or 正規化一致」で解決
function resolveSheetName(
  wb: XLSX.WorkBook,
  requested: string,
): { ok: true; name: string } | { ok: false; error: string } {
  const direct = requested;
  if (wb.Sheets[direct]) return { ok: true, name: direct };

  const want = normalizeSheetName(requested);
  const found = wb.SheetNames.find((n) => normalizeSheetName(n) === want);
  if (found) return { ok: true, name: found };

  return {
    ok: false,
    error: `指定シートが見つかりません: ${requested}（候補: ${wb.SheetNames.join(
      " / ",
    )}）`,
  };
}

/**
 * 要件：
 * - どこのセルにあっても拾う
 * - 「防-1」系も拾う
 * - 「OAVP-2S」系も拾う
 */
function extractCandidatesFromCellText(inputRaw: string): string[] {
  const s0 = normalizeHyphen(normalizeJaText(inputRaw))
    .replace(/\s+/g, " ")
    .trim();
  if (!s0) return [];

  const s = s0;
  const out: string[] = [];

  // (A) 区分-数字：防-1 / 防-12 / W-3 / A-10 など
  {
    const re =
      /(?:^|[^A-Z0-9\u4E00-\u9FFF々])([A-Z]{1,4}-\d{1,4}|[\u4E00-\u9FFF々]{1,4}-\d{1,4})(?=$|[^A-Z0-9\u4E00-\u9FFF々])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) out.push(m[1]);
  }

  // (B) 英数ハイフン：OAVP-2S / XYZ-100A / AB-12C など
  {
    const re = /(?:^|[^A-Z0-9])([A-Z]{2,10}-[A-Z0-9]{1,10})(?=$|[^A-Z0-9])/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(s)) !== null) out.push(m[1]);
  }

  const cleaned = out
    .map((x) => normalizeHyphen(x).trim())
    .map((x) => x.replace(/[、,。．.・:：;；()（）［\[\]【】]/g, ""))
    .map((x) => x.trim())
    .filter((x) => x.length >= 3);

  const filtered = cleaned.filter((x) => {
    if (!x.includes("-")) return false;
    if (/^\d+$/.test(x)) return false;
    if (/^\d/.test(x)) return false;
    return true;
  });

  return filtered;
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const file = fd.get("file");
    if (!(file instanceof File)) {
      const res: ExcelCodesError = { ok: false, error: "file がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    // ✅ ここが重要：UIから渡された sheetName を使う
    const reqSheet = fd.get("sheetName");
    const requestedSheetName =
      typeof reqSheet === "string" && reqSheet.trim() ? reqSheet.trim() : "";

    if (!requestedSheetName) {
      const res: ExcelCodesError = { ok: false, error: "sheetName がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    const ab = await file.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });

    const resolved = resolveSheetName(wb, requestedSheetName);
    if (resolved.ok === false) {
      const res: ExcelCodesError = { ok: false, error: resolved.error };
      return NextResponse.json(res, { status: 400 });
    }

    const sheetName = resolved.name;
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      const res: ExcelCodesError = { ok: false, error: "ワークシートが見つかりません" };
      return NextResponse.json(res, { status: 400 });
    }

    // ✅ 確実性重視：sheet_to_json(header:1) だと
    // 結合セル/表示値/一部形式で取りこぼすケースがあるため、
    // ワークシートの全セルアドレスを直接走査する。
    const set = new Set<string>();

    // 例: "A1" "BC20" のようなセルアドレスだけを走査（"!ref" 等は除外）
    for (const addr of Object.keys(ws)) {
      if (addr.startsWith("!")) continue;

      const cell = ws[addr] as XLSX.CellObject | undefined;
      if (!cell) continue;

      // 表示文字列があるなら優先（w）。なければ生値（v）。
      // 数式セルは v に計算結果が入る想定。
      const value = (cell.w ?? cell.v) as unknown;
      const text = normalizeJaText(toStr(value)).trim();
      if (!text) continue;

      const candidates = extractCandidatesFromCellText(text);
      for (const x of candidates) set.add(x);
    }

    const codes = Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));

    const res: ExcelCodesResponse = { ok: true, sheetName, codes };
    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const res: ExcelCodesError = { ok: false, error: `Excel候補抽出失敗: ${msg}` };
    return NextResponse.json(res, { status: 500 });
  }
}
