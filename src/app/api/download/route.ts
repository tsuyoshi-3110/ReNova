import { NextRequest, NextResponse } from "next/server";

function safeFileName(name: string): string {
  // ファイル名に使えない文字を除去（最低限）
  const s = name.trim().replace(/[\\/:*?"<>|]/g, "_");
  return s.length ? s : "download";
}

function isAllowedUrl(u: URL): boolean {
  if (u.protocol !== "https:") return false;

  // Firebase Storage の代表的ホスト
  const allowedHosts = new Set<string>([
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
  ]);

  return allowedHosts.has(u.hostname);
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    const nameParam = req.nextUrl.searchParams.get("name");

    if (!urlParam) {
      return NextResponse.json({ error: "missing url" }, { status: 400 });
    }

    let target: URL;
    try {
      target = new URL(urlParam);
    } catch {
      return NextResponse.json({ error: "invalid url" }, { status: 400 });
    }

    if (!isAllowedUrl(target)) {
      return NextResponse.json({ error: "blocked url host" }, { status: 400 });
    }

    const filename = safeFileName(nameParam ?? "photo.jpg");

    // ここでサーバー側 fetch することで CORS を回避し、ブラウザに「ファイル」として渡す
    const upstream = await fetch(target.toString(), { cache: "no-store" });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `upstream failed: ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType =
      upstream.headers.get("content-type") ?? "application/octet-stream";

    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    // そのままストリームで返す
    return new NextResponse(upstream.body, { status: 200, headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
