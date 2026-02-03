import { NextResponse } from "next/server";

// ✅ Node.js runtimeで動かす（EdgeだとPDF処理が不安定になりやすい）
export const runtime = "nodejs";

type PdfTextOk = {
  ok: true;
  pageCount: number;
  text: string;
  pages: Array<{ page: number; text: string }>;
};

type PdfTextErr = { ok: false; error: string };

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v);
}

function normalizeText(s: string): string {
  return s.replace(/[－―ー−]/g, "-").replace(/\s+/g, " ").trim();
}

export async function POST(req: Request) {
  try {
    const fd = await req.formData();

    const file = fd.get("file");
    if (!(file instanceof File)) {
      const res: PdfTextErr = { ok: false, error: "file がありません" };
      return NextResponse.json(res, { status: 400 });
    }

    // ✅ PDFをBufferへ
    const ab = await file.arrayBuffer();
    const data = new Uint8Array(ab);

    // ✅ pdfjs-dist（AIなし・テキストPDF前提）
    // ここで依存が必要：npm i pdfjs-dist
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    const loadingTask = pdfjs.getDocument({ data });
    const pdf = await loadingTask.promise;

    const pageCount = pdf.numPages;

    const pages: Array<{ page: number; text: string }> = [];
    const all: string[] = [];

    for (let p = 1; p <= pageCount; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      const parts: string[] = [];
      // content.items は文字アイテム配列（strを持つ）
      for (const it of content.items as Array<{ str?: unknown }>) {
        const s = normalizeText(toStr(it.str));
        if (s) parts.push(s);
      }

      // 1ページ分のテキスト
      const pageText = parts.join(" ").trim();
      pages.push({ page: p, text: pageText });
      if (pageText) all.push(pageText);
    }

    const res: PdfTextOk = {
      ok: true,
      pageCount,
      text: all.join("\n"),
      pages,
    };

    return NextResponse.json(res);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    const res: PdfTextErr = { ok: false, error: `PDF抽出失敗: ${msg}` };
    return NextResponse.json(res, { status: 500 });
  }
}
