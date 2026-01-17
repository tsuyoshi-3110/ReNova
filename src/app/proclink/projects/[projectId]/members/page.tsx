// app/proclink/projects/[projectId]/members/page.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  doc,
  documentId,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseClient";
import { Users, RotateCcw, UserX } from "lucide-react";

type MemberRaw = {
  uid: string;
  displayName?: string;
  email?: string;
  revoked?: boolean;
};

type UserProfile = {
  displayName?: string;
  email?: string;
};

type MemberRow = {
  uid: string;
  name: string;
  email?: string;
  revoked: boolean;
};

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function toBool(v: unknown): boolean {
  return v === true;
}

export default function ProjectMembersPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const sp = useSearchParams();

  const projectId = String(params?.projectId ?? "");
  const projectName = sp.get("projectName") ?? "";

  const [me, setMe] = useState<User | null>(null);
  const currentUid = me?.uid ?? null;

  const [ownerUid, setOwnerUid] = useState<string | null>(null);
  const [loadingOwner, setLoadingOwner] = useState(true);

  const [membersRaw, setMembersRaw] = useState<MemberRaw[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const [showRevoked, setShowRevoked] = useState(false);

  // 0) auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  // 1) 自分側の projectDoc から ownerUid を取る（member の場合に必要）
  useEffect(() => {
    if (!currentUid || !projectId) return;

    setLoadingOwner(true);

    const ref = doc(db, "users", currentUid, "projects", projectId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as DocumentData | undefined;
        const oid = (data?.ownerUid ?? data?.ownerId ?? null) as string | null;

        // owner の project でも ownerUid が無いことがあるので、自分を fallback
        setOwnerUid(oid ?? currentUid);
        setLoadingOwner(false);
      },
      () => {
        setOwnerUid(currentUid);
        setLoadingOwner(false);
      }
    );

    return () => unsub();
  }, [currentUid, projectId]);

  const isOwner = useMemo(() => {
    if (!currentUid) return false;
    if (!ownerUid) return true; // 最小保険（既存崩れ対策）
    return currentUid === ownerUid;
  }, [currentUid, ownerUid]);

  // 2) owner 側の members を購読
  useEffect(() => {
    const oid = ownerUid ?? null;
    if (!oid || !projectId) return;

    setLoadingMembers(true);

    const colRef = collection(db, "users", oid, "projects", projectId, "members");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const list: MemberRaw[] = snap.docs.map((d) => {
          const data = d.data() as DocumentData;
          return {
            uid: d.id,
            displayName: typeof data?.displayName === "string" ? data.displayName : undefined,
            email: typeof data?.email === "string" ? data.email : undefined,
            revoked: !!data?.revoked,
          };
        });

        setMembersRaw(list);
        setLoadingMembers(false);
      },
      () => {
        setMembersRaw([]);
        setLoadingMembers(false);
      }
    );

    return () => unsub();
  }, [ownerUid, projectId]);

  // ✅ users/{uid} の displayName/email をまとめて取得（最大10件ずつ）
  const fetchProfiles = useCallback(async (uids: string[]) => {
    const unique = Array.from(new Set(uids)).filter(Boolean);
    if (unique.length === 0) return;

    const chunks: string[][] = [];
    for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));

    try {
      const next: Record<string, UserProfile> = {};
      for (const chunk of chunks) {
        const q = query(collection(db, "users"), where(documentId(), "in", chunk));
        const snap = await getDocs(q);

        snap.docs.forEach((d) => {
          const data = d.data() as DocumentData;
          next[d.id] = {
            displayName: typeof data?.displayName === "string" ? data.displayName : undefined,
            email: typeof data?.email === "string" ? data.email : undefined,
          };
        });
      }

      setProfiles((prev) => ({ ...prev, ...next }));
    } catch {
      // 権限などで読めない場合は members 側の displayName/email で表示継続
    }
  }, []);

  // ✅ membersRaw が変わったら必要な uid の profiles を取りに行く（購読とは分離）
  useEffect(() => {
    if (!currentUid) return;

    const uids = membersRaw
      .map((m) => m.uid)
      .filter((uid) => uid && uid !== currentUid);

    void fetchProfiles(uids);
  }, [membersRaw, currentUid, fetchProfiles]);

  // ✅ 表示用に合成（自分除外 / revoked 反映 / name・email確定 / ソート）
  const members: MemberRow[] = useMemo(() => {
    if (!currentUid) return [];

    const base = membersRaw.filter((m) => m.uid !== currentUid);

    const visible = isOwner
      ? base.filter((m) => (showRevoked ? !!m.revoked : !m.revoked))
      : base.filter((m) => !m.revoked);

    const rows: MemberRow[] = visible.map((m) => {
      const p = profiles[m.uid] ?? {};

      const name = String(p.displayName ?? m.displayName ?? "").trim() || "未設定";
      const email = String(p.email ?? m.email ?? "").trim() || undefined;

      return {
        uid: m.uid,
        name,
        email,
        revoked: !!m.revoked,
      };
    });

    rows.sort((a, b) => {
      const c = (a.name || "").localeCompare(b.name || "");
      if (c !== 0) return c;
      return (a.uid || "").localeCompare(b.uid || "");
    });

    return rows;
  }, [membersRaw, profiles, currentUid, isOwner, showRevoked]);

  const onRevoke = useCallback(
    async (memberUid: string, memberName: string) => {
      if (!currentUid) {
        window.alert("ログイン情報が取得できませんでした。");
        return;
      }
      if (!isOwner) {
        window.alert("非共有（削除）はオーナーのみ可能です。");
        return;
      }

      const oid = ownerUid ?? currentUid;

      const ok = window.confirm(`非共有にしますか？\n${memberName} を非共有にします。`);
      if (!ok) return;

      try {
        const ref = doc(db, "users", oid, "projects", projectId, "members", memberUid);
        await setDoc(
          ref,
          {
            revoked: true,
            revokedAt: serverTimestamp(),
            revokedBy: currentUid,
          },
          { merge: true }
        );
      } catch (e) {
        console.log("revoke member error:", e);
        window.alert("非共有に失敗しました。通信状況をご確認ください。");
      }
    },
    [currentUid, isOwner, ownerUid, projectId]
  );

  const onRestore = useCallback(
    async (memberUid: string, memberName: string) => {
      if (!currentUid) {
        window.alert("ログイン情報が取得できませんでした。");
        return;
      }
      if (!isOwner) {
        window.alert("再共有（復元）はオーナーのみ可能です。");
        return;
      }

      const oid = ownerUid ?? currentUid;

      const ok = window.confirm(`再共有しますか？\n${memberName} を再共有（復元）します。`);
      if (!ok) return;

      try {
        const ref = doc(db, "users", oid, "projects", projectId, "members", memberUid);
        await setDoc(
          ref,
          {
            revoked: false,
            restoredAt: serverTimestamp(),
            restoredBy: currentUid,
          },
          { merge: true }
        );
      } catch (e) {
        console.log("restore member error:", e);
        window.alert("再共有に失敗しました。通信状況をご確認ください。");
      }
    },
    [currentUid, isOwner, ownerUid, projectId]
  );

  if (!currentUid) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              ログイン情報が取得できませんでした
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              ログイン後にアクセスしてください。
            </div>

            <div className="mt-4 flex gap-2">
              <Link
                href="/login"
                className="inline-flex flex-1 items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                ログインへ
              </Link>
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-gray-800"
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              共有メンバー
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {projectName ? `工事：${projectName}` : "工事の共有メンバー管理"}
            </div>
          </div>

          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/work-types?projectName=${encodeURIComponent(projectName)}`}
            className="inline-flex items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            戻る
          </Link>
        </div>

        <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {isOwner ? (
              showRevoked ? (
                "非共有中メンバー（再共有が可能）"
              ) : (
                "共有中メンバー（非共有が可能）"
              )
            ) : (
              "共有中メンバーを確認できます"
            )}
          </div>

          {isOwner && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowRevoked(false)}
                className={
                  "rounded-xl border px-3 py-2 text-sm font-extrabold " +
                  (showRevoked
                    ? "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    : "border-gray-900 bg-gray-900 text-white hover:bg-gray-800")
                }
              >
                共有中
              </button>
              <button
                type="button"
                onClick={() => setShowRevoked(true)}
                className={
                  "rounded-xl border px-3 py-2 text-sm font-extrabold " +
                  (showRevoked
                    ? "border-gray-900 bg-gray-900 text-white hover:bg-gray-800"
                    : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800")
                }
              >
                非共有中
              </button>
            </div>
          )}
        </div>

        {(loadingOwner || loadingMembers) && (
          <div className="mt-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100" />
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                読み込み中...
              </div>
            </div>
          </div>
        )}

        {!loadingOwner && !loadingMembers && members.length === 0 && (
          <div className="mt-4 rounded-2xl border bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              {isOwner && showRevoked ? "非共有中メンバーがいません" : "共有メンバーがいません"}
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              共有コード参加でメンバーが追加されると、ここに表示されます。
            </div>
          </div>
        )}

        {!loadingOwner && !loadingMembers && members.length > 0 && (
          <div className="mt-4 grid gap-3">
            {members.map((m) => (
              <div
                key={m.uid}
                className="rounded-2xl border bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                        <Users className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold text-gray-900 dark:text-gray-100">
                          {m.name}
                        </div>
                        {m.email ? (
                          <div className="mt-1 truncate text-xs font-bold text-gray-600 dark:text-gray-300">
                            {m.email}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 text-xs font-bold text-gray-500 dark:text-gray-400">
                      UID: {m.uid}
                    </div>
                  </div>

                  {isOwner ? (
                    showRevoked ? (
                      <button
                        type="button"
                        onClick={() => onRestore(m.uid, m.name)}
                        className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                      >
                        <RotateCcw className="h-4 w-4" />
                        再共有
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRevoke(m.uid, m.name)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-extrabold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:bg-gray-900 dark:text-red-300 dark:hover:bg-red-950/30"
                      >
                        <UserX className="h-4 w-4" />
                        非共有
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
