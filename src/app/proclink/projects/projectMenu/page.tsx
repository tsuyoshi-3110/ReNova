"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Camera, Images, ClipboardList, ArrowLeft } from "lucide-react";

import { auth, db } from "@/lib/firebaseClient";
import { doc, getDoc } from "firebase/firestore";

function safeDecode(v: string | null): string {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

type MyRole = "owner" | "member" | null;

export default function RenovaProjectMenuPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const projectId = safeDecode(sp.get("projectId"));
  const projectName = safeDecode(sp.get("projectName"));
  const workTypeId = safeDecode(sp.get("workTypeId"));
  const workTypeName = safeDecode(sp.get("workTypeName"));

  const [me, setMe] = useState<User | null>(null);
  const [myRole, setMyRole] = useState<MyRole>(null);
  const [roleLoading, setRoleLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  // ✅ owner/member 判定（users/{uid}/projects/{projectId} の role を見る）
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setRoleLoading(true);

        const uid = auth.currentUser?.uid ?? null;
        if (!uid || !projectId) {
          if (!cancelled) {
            setMyRole(null);
            setRoleLoading(false);
          }
          return;
        }

        const ref = doc(db, "users", uid, "projects", projectId);
        const snap = await getDoc(ref);

        // 念のため：project doc が無い場合は owner 扱い（既存方針）
        const role = snap.exists()
          ? ((snap.data()?.role ?? "owner") as MyRole)
          : ("owner" as MyRole);

        if (!cancelled) {
          setMyRole(role);
          setRoleLoading(false);
        }
      } catch (e) {
        console.log("project role getDoc error:", e);
        if (!cancelled) {
          setMyRole(null);
          setRoleLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const isOwner = myRole === "owner";

  const baseQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (projectId) q.set("projectId", projectId);
    if (projectName) q.set("projectName", projectName);
    if (workTypeId) q.set("workTypeId", workTypeId);
    if (workTypeName) q.set("workTypeName", workTypeName);
    return q.toString();
  }, [projectId, projectName, workTypeId, workTypeName]);

  if (!projectId || !workTypeId) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              工事/工種情報が取得できませんでした
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              もう一度、工事一覧 → 工種一覧から選択してください。
            </div>

            <Link
              href="/proclink/projects"
              className="mt-4 inline-flex items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              工事一覧へ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              工事メニュー
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              工事：{projectName || "（名称未設定）"}
            </div>
            <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-gray-100">
              工種：{workTypeName || "（工種未設定）"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              戻る
            </button>

            <Link
              href="/proclink/projects"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              工事一覧
            </Link>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-6 grid gap-3">
          {/* 工事写真一覧 */}
          <button
            type="button"
            onClick={() => {
              router.push(
                `/proclink/projects/${encodeURIComponent(projectId)}/photos` +
                  `?${baseQuery}`,
              );
            }}
            className="rounded-2xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70"
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <Images className="h-5 w-5 text-gray-800 dark:text-gray-100" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  工事写真一覧
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  この工種で撮影された写真を表示します
                </div>
              </div>
            </div>
          </button>

          {/* ✅ 工程設定：owner の時だけ表示 */}
          {!roleLoading && isOwner && (
            <button
              type="button"
              onClick={() => {
                router.push(
                  `/proclink/projects/${encodeURIComponent(projectId)}/steps` +
                    `?${baseQuery}`,
                );
              }}
              className="rounded-2xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                  <ClipboardList className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                    工程設定
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    工程を編集します
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* （任意）role 判定中だけ薄いプレースホルダを出したいなら */}
          {roleLoading && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-left opacity-60 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                  <ClipboardList className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                    工程設定
                  </div>
                  <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    判定中...
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Camera Button */}
        <button
          type="button"
          onClick={() => {
            router.push(
              `/proclink/projects/${encodeURIComponent(projectId)}/camera` +
                `?${baseQuery}`,
            );
          }}
          className="fixed bottom-6 right-6 z-40 grid h-16 w-16 place-items-center rounded-full bg-gray-900 shadow-lg hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white"
          aria-label="camera"
        >
          <Camera className="h-7 w-7 text-white dark:text-gray-900" />
        </button>

        {/* Auth note (任意) */}
        {!me && (
          <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            未ログインの可能性があります。必要に応じてログインしてください。
          </div>
        )}
      </div>
    </main>
  );
}
