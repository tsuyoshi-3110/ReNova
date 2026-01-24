// app/api/pdf/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
  PDFDocument,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

export const runtime = "nodejs";

type Item = {
  imageUrl: string;
  projectName: string;
  subtitle: string; // 工種
  workTypeName: string; // 工区（workTypes/name）
  location: string; // 場所
  memo: string; // 作業内容
};

type PostBody = {
  items?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pickString(v: Record<string, unknown>, key: string): string {
  return asString(v[key]).trim();
}

function pickNestedString(
  v: Record<string, unknown>,
  key: string,
  nestedKey: string,
): string {
  const obj = v[key];
  if (!isRecord(obj)) return "";
  return asString(obj[nestedKey]).trim();
}

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "不明なエラー";
  }
}

function parseItem(v: unknown): Item | null {
  if (!isRecord(v)) return null;

  const imageUrl = pickString(v, "imageUrl");
  if (!imageUrl) return null;

  const subtitle = pickString(v, "subtitle");
  const memo = pickString(v, "memo");

  // 工区（workTypes/name）を色々なキーから拾う（クライアント側の揺れ対策）
  const workTypeName =
    pickString(v, "workTypeName") ||
    pickString(v, "workTypesName") ||
    pickNestedString(v, "workType", "name") ||
    pickNestedString(v, "workTypes", "name") ||
    pickString(v, "workType"); // 最終フォールバック（文字列だけの可能性）

  return {
    imageUrl,
    projectName: pickString(v, "projectName"),
    subtitle,
    workTypeName,
    location: pickString(v, "location"),
    memo,
  };
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function u8ToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const bufLike = u8.buffer; // ArrayBuffer | SharedArrayBuffer
  if (bufLike instanceof ArrayBuffer) {
    return bufLike.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  }
  const ab = new ArrayBuffer(u8.byteLength);
  new Uint8Array(ab).set(u8);
  return ab;
}

type Fontkit = Parameters<PDFDocument["registerFontkit"]>[0];

function hasCreateFn(
  v: unknown,
): v is { create: (...args: unknown[]) => unknown } {
  return isRecord(v) && typeof v["create"] === "function";
}

async function registerFontkit(pdf: PDFDocument): Promise<void> {
  const require0 = createRequire(import.meta.url);

  let mod: unknown;
  try {
    mod = require0("@pdf-lib/fontkit");
  } catch {
    mod = await import("@pdf-lib/fontkit");
  }

  const resolved =
    isRecord(mod) && "default" in mod
      ? ((mod as { default?: unknown }).default ?? mod)
      : mod;

  if (!hasCreateFn(resolved)) {
    throw new Error("fontkit import mismatch: create() not found");
  }

  pdf.registerFontkit(resolved as Fontkit);
}

async function readFontBytes(): Promise<Uint8Array> {
  const candidates = [
    path.join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansCJKjp-Regular.otf"),
    path.join(process.cwd(), "public", "fonts", "NotoSansJP-Regular.ttf"),
  ];

  let lastErr: unknown = null;

  for (const p of candidates) {
    try {
      const buf = await readFile(p);
      if (buf.byteLength <= 0) throw new Error(`font file is empty: ${p}`);

      const head4 = Buffer.from(buf.slice(0, 4));
      const headAsciiRaw = head4.toString("ascii");

      console.log("[pdf] font file:", p);
      console.log("[pdf] font head4(ascii raw):", headAsciiRaw);

      if (headAsciiRaw === "wOFF" || headAsciiRaw === "wOF2") {
        throw new Error(`font is WOFF/WOFF2. file: ${p}`);
      }
      if (headAsciiRaw === "ttcf") {
        throw new Error(`font is TTC. file: ${p}`);
      }

      return new Uint8Array(buf);
    } catch (e: unknown) {
      lastErr = e;
    }
  }

  throw new Error(
    `font not found. tried:\n- ${candidates.join("\n- ")}\nlast: ${toErrorMessage(lastErr)}`,
  );
}

async function embedImage(
  pdf: PDFDocument,
  imageUrl: string,
): Promise<PDFImage> {
  const bytes = await fetchBytes(imageUrl);
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return await pdf.embedJpg(bytes);
  }
}

function wrapByWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  size: number,
): string[] {
  const src = (text ?? "").replace(/\r\n/g, "\n");
  const paragraphs = src.split("\n");
  const out: string[] = [];

  for (const p of paragraphs) {
    const s = p.trimEnd();
    if (!s) {
      out.push("");
      continue;
    }

    let line = "";
    for (const ch of s) {
      const next = line + ch;
      const w = font.widthOfTextAtSize(next, size);
      if (w <= maxWidth || line.length === 0) {
        line = next;
      } else {
        out.push(line);
        line = ch;
      }
    }
    if (line) out.push(line);
  }

  return out;
}

function drawLabelAndValueBox(params: {
  page: PDFPage;
  x: number;
  yTop: number;
  yBottom: number;
  w: number;
  label: string;
  value: string;
  font: PDFFont;
  labelSize: number;
  valueSize: number;
  padX: number;
  padY: number;
}): void {
  const {
    page,
    x,
    yTop,
    yBottom,
    w,
    label,
    value,
    font,
    labelSize,
    valueSize,
    padX,
    padY,
  } = params;

  const maxW = w - padX * 2;

  const labelY = yTop - padY - labelSize;
  page.drawText(label, {
    x: x + padX,
    y: labelY,
    size: labelSize,
    font,
    color: rgb(0, 0, 0),
  });

  // タイトルとコンテンツの間に薄いグレー線
  const dividerY = labelY - 4;
  page.drawLine({
    start: { x: x + padX, y: dividerY },
    end: { x: x + w - padX, y: dividerY },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.85),
  });

  const lines = wrapByWidth((value ?? "").trim(), maxW, font, valueSize);

  // 値は線の下から開始
  let vy = dividerY - 6 - valueSize;
  const minY = yBottom + padY;

  for (const ln of lines) {
    if (vy < minY) break;
    if (!ln) {
      vy -= valueSize + 2;
      continue;
    }
    page.drawText(ln, {
      x: x + padX,
      y: vy,
      size: valueSize,
      font,
      color: rgb(0, 0, 0),
    });
    vy -= valueSize + 2;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const raw = (await req.json()) as PostBody;

    const itemsRaw = raw.items;
    const items: Item[] = Array.isArray(itemsRaw)
      ? itemsRaw.map(parseItem).filter((v): v is Item => v !== null)
      : [];

    if (items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    console.log(
      "[pdf] items check sample:",
      items.slice(0, 2).map((x) => ({
        projectName: x.projectName,
        subtitle: x.subtitle,
        workTypeName: x.workTypeName,
        location: x.location,
        memo: x.memo,
      })),
    );

    // A4 縦（pt）
    const PAGE_W = 595;
    const PAGE_H = 842;

    const M = 24;
    const H_GAP = 14;
    const V_GAP = 14;

    const CONTENT_W = PAGE_W - M * 2;

    // 1ページに3枠
    const SLOT_H = Math.floor((PAGE_H - M * 2 - V_GAP * 2) / 3);

    // 写真は「高さ基準」で 4:3 の枠を作る
    const PHOTO_H = SLOT_H;
    const PHOTO_W = Math.floor(PHOTO_H * (4 / 3));

    // 右側は残り全部
    const RIGHT_W = CONTENT_W - PHOTO_W - H_GAP;

    const pdf = await PDFDocument.create();
    await registerFontkit(pdf);

    const fontBytes = await readFontBytes();
    const font = await pdf.embedFont(fontBytes, { subset: false });

    // 文字サイズ（少し小さく）
    const labelSize = 8;
    const valueSize = 10;

    const padX = 10;
    const padY = 8;

    const ROWS = [
      { label: "工事名", key: "projectName" as const },
      { label: "工種", key: "subtitle" as const },
      { label: "工区/場所", key: "location" as const }, // 特別扱い
      { label: "作業内容", key: "memo" as const },
    ];

    for (let base = 0; base < items.length; base += 3) {
      const page = pdf.addPage([PAGE_W, PAGE_H]);

      for (let s = 0; s < 3; s++) {
        const it = items[base + s];
        if (!it) break;

        const slotTop = PAGE_H - M - s * (SLOT_H + V_GAP);
        const slotBottom = slotTop - SLOT_H;

        const PHOTO_X = M;
        const PHOTO_Y = slotBottom;

        const TEXT_X = M + PHOTO_W + H_GAP;
        const TEXT_Y = slotBottom;
        const TEXT_H = SLOT_H;

        // 左：写真枠（白背景＋枠線）
        page.drawRectangle({
          x: PHOTO_X,
          y: PHOTO_Y,
          width: PHOTO_W,
          height: PHOTO_H,
          color: rgb(1, 1, 1),
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

        // 画像は contain
        const img = await embedImage(pdf, it.imageUrl);
        const scale = Math.min(PHOTO_W / img.width, PHOTO_H / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        const dx = PHOTO_X + (PHOTO_W - dw) / 2;
        const dy = PHOTO_Y + (PHOTO_H - dh) / 2;
        page.drawImage(img, { x: dx, y: dy, width: dw, height: dh });

        // 右：枠
        page.drawRectangle({
          x: TEXT_X,
          y: TEXT_Y,
          width: RIGHT_W,
          height: TEXT_H,
          color: rgb(1, 1, 1),
          borderColor: rgb(0, 0, 0),
          borderWidth: 1,
        });

        const rowH = TEXT_H / ROWS.length;

        // 横罫線（薄いグレー）
        for (let r = 1; r < ROWS.length; r++) {
          const y = TEXT_Y + TEXT_H - rowH * r;
          page.drawLine({
            start: { x: TEXT_X, y },
            end: { x: TEXT_X + RIGHT_W, y },
            thickness: 0.75,
            color: rgb(0.75, 0.75, 0.75),
          });
        }

        for (let r = 0; r < ROWS.length; r++) {
          const rowTop = TEXT_Y + TEXT_H - rowH * r;
          const rowBottom = rowTop - rowH;

          // ★ 工区/場所は「横2分割」＋「ラベル上 / value下」
          if (r === 2) {
            const halfW = RIGHT_W / 2;

            // 縦の仕切り線（薄いグレー）
            page.drawLine({
              start: { x: TEXT_X + halfW, y: rowBottom },
              end: { x: TEXT_X + halfW, y: rowTop },
              thickness: 0.75,
              color: rgb(0.75, 0.75, 0.75),
            });

            // 左：工区
            drawLabelAndValueBox({
              page,
              x: TEXT_X,
              yTop: rowTop,
              yBottom: rowBottom,
              w: halfW,
              label: "工区",
              value: (it.workTypeName ?? "").trim(),
              font,
              labelSize,
              valueSize,
              padX,
              padY,
            });

            // 右：場所
            drawLabelAndValueBox({
              page,
              x: TEXT_X + halfW,
              yTop: rowTop,
              yBottom: rowBottom,
              w: halfW,
              label: "場所",
              value: (it.location ?? "").trim(),
              font,
              labelSize,
              valueSize,
              padX,
              padY,
            });

            continue;
          }

          const key = ROWS[r].key;
          const label = ROWS[r].label;
          const value = (it[key] ?? "").trim();

          drawLabelAndValueBox({
            page,
            x: TEXT_X,
            yTop: rowTop,
            yBottom: rowBottom,
            w: RIGHT_W,
            label,
            value,
            font,
            labelSize,
            valueSize,
            padX,
            padY,
          });
        }
      }
    }

    const pdfBytes = await pdf.save();
    const body = u8ToArrayBuffer(pdfBytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="photos.pdf"',
      },
    });
  } catch (e: unknown) {
    const msg = `PDF生成失敗: ${toErrorMessage(e)}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
