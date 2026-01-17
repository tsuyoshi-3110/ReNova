// src/app/proclink/projects/[projectId]/photos/utils.ts

import type { Role, PhotoDoc } from "./types";

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function getRole(v: unknown): Role {
  return v === "owner" || v === "member" ? v : "owner";
}

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e);
  } catch {
    return "不明なエラー";
  }
}

export function safeDecode(v: string | null): string {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function pickImageUrl(p: PhotoDoc): string | null {
  return (p.originalUrl ?? p.renderedUrl ?? null) as string | null;
}

export function canDeleteItem(params: {
  uid: string | null;
  myRole: Role | null;
  photo: PhotoDoc;
}): boolean {
  const { uid, myRole, photo } = params;
  if (!uid || !myRole) return false;
  if (myRole === "owner") return true;
  const shotUid = (photo.shotByUid ?? photo.userId ?? null) as string | null;
  return shotUid === uid;
}

/** Web: 画像をブラウザに保存（download） */
export async function downloadImageAsFile(params: {
  url: string;
  filename: string;
}) {
  const { url, filename } = params;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const blob = await res.blob();

  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}
