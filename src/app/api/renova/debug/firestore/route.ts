import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown";
  }
}

export async function GET() {
  try {
    const db = getAdminDb();
    const snap = await db.collection("__debug").doc("ping").get();

    return NextResponse.json({
      ok: true,
      exists: snap.exists,
      projectId: process.env.FIREBASE_PROJECT_ID ?? null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(err) },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const db = getAdminDb();
    await db.collection("__debug").doc("ping").set(
      {
        updatedAt: new Date().toISOString(),
        note: "ping",
      },
      { merge: true }
    );

    const snap = await db.collection("__debug").doc("ping").get();

    return NextResponse.json({
      ok: true,
      wrote: true,
      exists: snap.exists,
      projectId: process.env.FIREBASE_PROJECT_ID ?? null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { ok: false, error: toErrorMessage(err) },
      { status: 500 }
    );
  }
}
