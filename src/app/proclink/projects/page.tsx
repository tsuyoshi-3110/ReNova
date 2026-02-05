"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { nanoid } from "nanoid/non-secure";
import { Plus, FolderKanban, Users, Trash2, Copy } from "lucide-react";

import { auth, db } from "@/lib/firebaseClient";

/** -----------------------------
 * Types
 * ----------------------------*/
type AddMode = "create" | "join";
type Role = "owner" | "member";

type Project = {
  id: string; // = projectId
  name: string;
  subtitle: string;
  shareCode: string | null;
  role: Role;
  ownerUid: string | null; // member の時は必須 / owner の時は自分
  sourceProjectId: string | null; // member の時は join 元 / owner は自分の projectId
  revoked: boolean;
  updatedAt?: unknown;
};

type JoinReason = "not_found" | "already" | "permission" | "unknown";
type JoinByShareCodeResult =
  | { ok: true; name: string }
  | { ok: false; reason: JoinReason };

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toBool(v: unknown): boolean {
  return v === true;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "不明なエラー";
}

function isPermissionDenied(e: unknown): boolean {
  return e instanceof FirebaseError && e.code === "permission-denied";
}

/** -----------------------------
 * Firestore paths (あなたの正解構成)
 * - /projects/{projectId}
 * - /users/{uid}/myProjects/{projectId}
 * - /projects/{projectId}/members/{uid}
 * - /shareCodes/{CODE}
 * ----------------------------*/
function rootProjectsCol(db0: Firestore) {
  return collection(db0, "projects");
}

function userMyProjectsCol(db0: Firestore, uid: string) {
  return collection(db0, "users", uid, "myProjects");
}

// shareCode を「確実に一意」で確保する
async function reserveShareCode(params: {
  db: Firestore;
  ownerUid: string;
  projectId: string;
}) {
  const { db: db0, ownerUid, projectId } = params;

  for (let i = 0; i < 10; i++) {
    const code = nanoid(6).toUpperCase();
    const ref = doc(db0, "shareCodes", code);

    try {
      await runTransaction(db0, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists()) throw new Error("code_exists");
        tx.set(ref, {
          code,
          ownerUid,
          projectId,
          createdAt: serverTimestamp(),
        });
      });

      return code;
    } catch (e) {
      if (e instanceof Error && e.message.includes("code_exists")) continue;
      continue;
    }
  }

  throw new Error("shareCode の確保に失敗しました。");
}

async function createOwnerProject(params: {
  db: Firestore;
  uid: string;
  me: User;
  name: string;
  subtitle: string;
}) {
  const { db: db0, uid, me, name, subtitle } = params;

  // 1) /projects に作成（ID確定）
  const rootRef = await addDoc(rootProjectsCol(db0), {
    name,
    subtitle,
    ownerUid: uid,
    shareCode: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2) shareCode を確実に一意で確保
  const shareCode = await reserveShareCode({
    db: db0,
    ownerUid: uid,
    projectId: rootRef.id,
  });

  // 3) /projects/{projectId} に shareCode 反映
  await setDoc(
    doc(db0, "projects", rootRef.id),
    { shareCode, updatedAt: serverTimestamp() },
    { merge: true },
  );

  // 4) /users/{uid}/myProjects/{projectId} に自分の一覧として作成
  await setDoc(doc(db0, "users", uid, "myProjects", rootRef.id), {
    projectId: rootRef.id,
    name,
    subtitle,
    role: "owner",
    ownerUid: uid,
    sourceProjectId: rootRef.id,
    shareCode,
    revoked: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 5) /projects/{projectId}/members/{uid} に owner を入れる（既存仕様維持）
  await setDoc(
    doc(db0, "projects", rootRef.id, "members", uid),
    {
      uid,
      displayName: me.displayName ?? "",
      email: me.email ?? "",
      joinedAt: serverTimestamp(),
      revoked: false,
    },
    { merge: true },
  );

  return { projectId: rootRef.id, shareCode };
}

async function joinByShareCode(params: {
  db: Firestore;
  uid: string;
  me: User;
  code: string;
}): Promise<JoinByShareCodeResult> {
  const { db: db0, uid, me } = params;
  const code = params.code.trim().toUpperCase();

  try {
    let ownerUid: string | null = null;
    let projectId: string | null = null;

    // 1) shareCodes/{CODE}
    const codeRef = doc(db0, "shareCodes", code);
    const codeSnap = await getDoc(codeRef);

    if (codeSnap.exists()) {
      const raw = codeSnap.data();
      const data: unknown = raw;

      if (isObj(data)) {
        ownerUid = toStr(data.ownerUid) || null;
        projectId = toStr(data.projectId) || null;
      }
    }

    // 2) フォールバック：/projects の shareCode で検索
    if (!ownerUid || !projectId) {
      const q = query(
        collection(db0, "projects"),
        where("shareCode", "==", code),
        limit(1),
      );
      const snaps = await getDocs(q);

      if (!snaps.empty) {
        const hit = snaps.docs[0];
        projectId = hit.id;

        const raw = hit.data();
        const data: unknown = raw;
        if (isObj(data)) ownerUid = toStr(data.ownerUid) || null;
      }
    }

    if (!projectId || !ownerUid) {
      return { ok: false, reason: "not_found" };
    }

    // 3) 既に自分の myProjects にあるか
    const myRef = doc(db0, "users", uid, "myProjects", projectId);
    const mySnap = await getDoc(myRef);
    if (mySnap.exists()) {
      return { ok: false, reason: "already" };
    }

    // 4) /projects/{projectId} から name/subtitle を取得
    const rootSnap = await getDoc(doc(db0, "projects", projectId));
    if (!rootSnap.exists()) {
      return { ok: false, reason: "not_found" };
    }

    const rootRaw = rootSnap.data();
    const rootData: unknown = rootRaw;

    const name =
      isObj(rootData) && toStr(rootData.name).trim()
        ? toStr(rootData.name).trim()
        : "工事";
    const subtitle =
      isObj(rootData) && toStr(rootData.subtitle).trim()
        ? toStr(rootData.subtitle).trim()
        : "";

    // 5) /users/{uid}/myProjects/{projectId} に追加
    await setDoc(myRef, {
      projectId,
      name,
      subtitle,
      shareCode: code,
      role: "member",
      ownerUid,
      sourceProjectId: projectId,
      revoked: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      joinedAt: serverTimestamp(),
    });

    // 6) /projects/{projectId}/members/{uid} に追加
    await setDoc(
      doc(db0, "projects", projectId, "members", uid),
      {
        uid,
        displayName: me.displayName ?? "",
        email: me.email ?? "",
        joinedAt: serverTimestamp(),
        revoked: false,
      },
      { merge: true },
    );

    return { ok: true, name };
  } catch (e) {
    if (isPermissionDenied(e)) return { ok: false, reason: "permission" };
    return { ok: false, reason: "unknown" };
  }
}

async function deleteMyProject(params: {
  db: Firestore;
  uid: string;
  projectId: string;
  role: Role;
  shareCode: string | null;
}) {
  const { db: db0, uid, projectId, role, shareCode } = params;

  // 自分の一覧から削除
  await deleteDoc(doc(db0, "users", uid, "myProjects", projectId));

  // owner の時は /projects と shareCodes も削除（既存の意図に合わせる）
  if (role === "owner") {
    if (shareCode) {
      await deleteDoc(doc(db0, "shareCodes", shareCode));
    }
    await deleteDoc(doc(db0, "projects", projectId));
    // ※ subcollection(members) は自動削除されません（ここでは余計な仕組みは入れません）
  }
}

/** -----------------------------
 * Hooks
 * ----------------------------*/
function useProjectsList(db0: Firestore, uid: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);

  const colRef = useMemo(() => {
    if (!uid) return null;
    return userMyProjectsCol(db0, uid);
  }, [db0, uid]);

  useEffect(() => {
    setProjects([]);
    setLoading(true);
    setSlow(false);

    if (!colRef) {
      setLoading(false);
      return;
    }

    const slowTimer = window.setTimeout(() => setSlow(true), 1200);

    const q = query(colRef, orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        window.clearTimeout(slowTimer);
        setSlow(false);

        const list: Project[] = snap.docs.map((d) => {
          const raw = d.data();
          const data: unknown = raw;

          const name = isObj(data) ? toStr(data.name) : "";
          const subtitle = isObj(data) ? toStr(data.subtitle) : "";
          const role = (isObj(data) ? toStr(data.role) : "") as Role;

          const shareCode =
            isObj(data) && typeof data.shareCode === "string"
              ? data.shareCode
              : null;

          const ownerUid =
            isObj(data) && typeof data.ownerUid === "string"
              ? data.ownerUid
              : null;

          const sourceProjectId =
            isObj(data) && typeof data.sourceProjectId === "string"
              ? data.sourceProjectId
              : null;

          const revoked = isObj(data) ? toBool(data.revoked) : false;

          return {
            id: d.id,
            name,
            subtitle,
            role: role === "owner" || role === "member" ? role : "member",
            shareCode,
            ownerUid,
            sourceProjectId,
            revoked,
            updatedAt: isObj(data) ? data.updatedAt : undefined,
          };
        });

        setProjects(list);
        setLoading(false);
      },
      () => {
        window.clearTimeout(slowTimer);
        setSlow(false);
        setProjects([]);
        setLoading(false);
      },
    );

    return () => {
      window.clearTimeout(slowTimer);
      unsub();
    };
  }, [colRef]);

  return { projects, loading, slow };
}

function useMemberRevokedSync(
  db0: Firestore,
  uid: string | null,
  projects: Project[],
) {
  const targets = useMemo(() => {
    return projects.filter((p) => p.role === "member" && !!p.sourceProjectId);
  }, [projects]);

  useEffect(() => {
    if (!uid) return;
    if (targets.length === 0) return;

    const unsubs = targets.map((p) => {
      const projectId = p.sourceProjectId as string;
      const memberRef = doc(db0, "projects", projectId, "members", uid);

      return onSnapshot(
        memberRef,
        async (snap) => {
          const revokedRemote = !snap.exists()
            ? true
            : toBool(
                (snap.data() as unknown as Record<string, unknown>)?.revoked,
              );

          const revokedLocal = !!p.revoked;
          if (revokedRemote === revokedLocal) return;

          await setDoc(
            doc(db0, "users", uid, "myProjects", projectId),
            { revoked: revokedRemote, updatedAt: serverTimestamp() },
            { merge: true },
          );
        },
        () => {},
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [db0, uid, targets]);
}

/** -----------------------------
 * Page
 * ----------------------------*/
export default function RenovaProjectsPage() {
  const router = useRouter();

  const [me, setMe] = useState<User | null>(null);
  const uid = me?.uid ?? null;

  const { projects, loading, slow } = useProjectsList(db, uid);
  useMemberRevokedSync(db, uid, projects);

  const visibleProjects = useMemo(() => {
    return projects
      .filter((p) => !(p.role === "member" && p.revoked))
      .slice()
      .sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "ja", {
          sensitivity: "base",
          numeric: true,
        }),
      );
  }, [projects]);

  // UI state
  const [modalOpen, setModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("create");

  const [newName, setNewName] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  const openActions = useCallback((p: Project) => {
    setSelected(p);
    setActionOpen(true);
  }, []);

  const closeActions = useCallback(() => {
    setActionOpen(false);
    setSelected(null);
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      window.alert("コピーしました");
    } catch {
      window.alert("コピーに失敗しました（ブラウザ権限をご確認ください）");
    }
  }, []);

  const onCreate = useCallback(async () => {
    const name = newName.trim();
    const subtitle = subTitle.trim();

    if (!me) {
      window.alert("未ログインです。ログイン後に作成できます。");
      return;
    }
    if (!name) {
      window.alert("工事名（タイトル）を入力してください。");
      return;
    }
    if (!subtitle) {
      window.alert("工種を入力してください。");
      return;
    }

    try {
      setCreating(true);
      const res = await createOwnerProject({
        db,
        uid: me.uid,
        me,
        name,
        subtitle,
      });
      setNewName("");
      setSubTitle("");
      setModalOpen(false);
      window.alert(`作成しました。\n共有コード：${res.shareCode}`);
    } catch (e) {
      window.alert(`作成失敗：${safeMsg(e)}`);
    } finally {
      setCreating(false);
    }
  }, [me, newName, subTitle]);

  const onJoin = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();

    if (!me) {
      window.alert("未ログインです。ログイン後に参加できます。");
      return;
    }
    if (!code) {
      window.alert("共有コードを入力してください。");
      return;
    }

    try {
      setJoining(true);

      const res: JoinByShareCodeResult = await joinByShareCode({
        db,
        uid: me.uid,
        me,
        code,
      });

      // ✅ ここが「reason エラーを確実に止める」分岐
      if (res.ok === false) {
        if (res.reason === "not_found") {
          window.alert(
            "共有コードが見つかりません。正しいか確認してください。",
          );
          return;
        }
        if (res.reason === "already") {
          window.alert("この工事はすでに一覧に追加されています。");
          return;
        }
        if (res.reason === "permission") {
          window.alert("権限がありません。オーナーに確認してください。");
          return;
        }
        window.alert("参加失敗：不明なエラー");
        return;
      }

      setJoinCode("");
      setModalOpen(false);
      window.alert(`追加しました：${res.name}`);
    } catch (e) {
      window.alert(`参加失敗：${safeMsg(e)}`);
    } finally {
      setJoining(false);
    }
  }, [me, joinCode]);

  const onDeleteSelected = useCallback(async () => {
    if (!me || !selected) return;

    const ok =
      selected.role === "owner"
        ? window.confirm("削除しますか？OKを押すとこの工事を削除します。")
        : window.confirm(
            "一覧から削除しますか？（オーナーや他メンバーの工事は削除されません）",
          );

    if (!ok) return;

    try {
      await deleteMyProject({
        db,
        uid: me.uid,
        projectId: selected.id,
        role: selected.role,
        shareCode: selected.shareCode,
      });
      closeActions();
    } catch (e) {
      window.alert(`削除失敗：${safeMsg(e)}`);
    }
  }, [me, selected, closeActions]);

  const onCopyShare = useCallback(async () => {
    if (!selected) return;
    if (selected.role !== "owner") {
      window.alert("共有できるのはオーナーのみです。");
      return;
    }
    if (!selected.shareCode) {
      window.alert(
        "共有コードがありません（shareCode が保存されていません）。",
      );
      return;
    }

    const message =
      `【Proclink】工事「${selected.name}」の共有コード：${selected.shareCode}\n` +
      `参加する側は「共有コードで参加」から入力してください。`;

    await copyToClipboard(message);
  }, [selected, copyToClipboard]);

  const onGoSharedMembers = useCallback(() => {
    if (!selected) return;
    if (selected.role !== "owner") {
      window.alert("共有メンバーを操作できるのはオーナーのみです。");
      return;
    }

    const href = `/proclink/projects/${encodeURIComponent(selected.id)}/members`;
    router.push(href);
    closeActions();
  }, [router, selected, closeActions]);

  const goProject = useCallback(
    (p: Project) => {
      const href =
        `/proclink/projects/${encodeURIComponent(p.id)}/menu` +
        `?projectName=${encodeURIComponent(p.name)}`;
      router.push(href);
    },
    [router],
  );

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              工事一覧
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Proclink（工事プロジェクト）
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setAddMode("create");
                setModalOpen(true);
              }}
              className={[
                "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-extrabold",
                "bg-gray-900 text-white hover:bg-gray-800",
                "dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white",
              ].join(" ")}
            >
              <Plus className="h-4 w-4" />
              追加
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-6 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800 dark:border-gray-700 dark:border-t-gray-200" />
              <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                読み込み中...
              </div>
            </div>
            {slow && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                通信中です（続く場合は電波状況をご確認ください）
              </div>
            )}
          </div>
        )}

        {!loading && visibleProjects.length === 0 && (
          <div className="mt-6 rounded-2xl border bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              工事がまだありません
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              右上の「追加」から作成 / 共有コードで参加できます
            </div>
          </div>
        )}

        {!loading && visibleProjects.length > 0 && (
          <div className="mt-6 grid gap-3">
            {visibleProjects.map((p) => (
              <div
                key={p.id}
                role="button"
                tabIndex={0}
                onClick={() => goProject(p)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    goProject(p);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  openActions(p);
                }}
                className={[
                  "cursor-pointer rounded-2xl border p-4 text-left transition",
                  "border-gray-200 bg-white hover:bg-gray-50",
                  "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                        <FolderKanban className="h-5 w-5 text-gray-800 dark:text-gray-100" />
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-base font-extrabold text-gray-900 dark:text-gray-100">
                          {p.name}
                        </div>

                        {p.subtitle ? (
                          <div className="mt-1 truncate text-sm text-gray-600 dark:text-gray-300">
                            {p.subtitle}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                        {p.role === "owner" ? "オーナー" : "メンバー"}
                      </span>

                      {p.role === "owner" && p.shareCode ? (
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                          CODE: {p.shareCode}
                        </span>
                      ) : null}

                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        右クリックで 操作 / 削除
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openActions(p);
                    }}
                    className={[
                      "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition",
                      "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    <Users className="h-4 w-4" />
                    操作
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!me && (
          <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            未ログインの可能性があります。必要に応じてログインしてください。
          </div>
        )}
      </div>

      {/* Add Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-950 dark:shadow-none dark:ring-1 dark:ring-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                {addMode === "create" ? "新規作成" : "共有コードで参加"}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-900"
              >
                閉じる
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setAddMode("create")}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                  addMode === "create"
                    ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                    : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                ].join(" ")}
              >
                新規作成
              </button>
              <button
                type="button"
                onClick={() => setAddMode("join")}
                className={[
                  "flex-1 rounded-xl border px-3 py-2 text-sm font-extrabold transition",
                  addMode === "join"
                    ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                    : "border-gray-200 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                ].join(" ")}
              >
                共有コードで参加
              </button>
            </div>

            {addMode === "create" ? (
              <div className="mt-4 grid gap-3">
                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    工事名（タイトル）
                  </div>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="例：○○マンション 大規模修繕工事"
                    className={[
                      "mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none transition",
                      "border-gray-200 bg-white text-gray-900 focus:border-gray-900",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400",
                    ].join(" ")}
                  />
                </div>

                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    工種
                  </div>
                  <input
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    placeholder="例：塗装工事"
                    className={[
                      "mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none transition",
                      "border-gray-200 bg-white text-gray-900 focus:border-gray-900",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400",
                    ].join(" ")}
                  />
                </div>

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={creating || joining}
                    className={[
                      "flex-1 rounded-xl border px-4 py-3 text-sm font-extrabold transition disabled:opacity-50",
                      "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={onCreate}
                    disabled={creating || joining}
                    className={[
                      "flex-1 rounded-xl px-4 py-3 text-sm font-extrabold transition disabled:opacity-50",
                      "bg-gray-900 text-white hover:bg-gray-800",
                      "dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white",
                    ].join(" ")}
                  >
                    {creating ? "作成中..." : "作成"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  受け取った CODE
                  を入力すると、この工事があなたの一覧に追加されます。
                </div>

                <div>
                  <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    共有コード
                  </div>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value)}
                    placeholder="例：A9F3KD"
                    className={[
                      "mt-2 w-full rounded-xl border px-3 py-3 text-sm outline-none transition",
                      "border-gray-200 bg-white text-gray-900 focus:border-gray-900",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-gray-400",
                    ].join(" ")}
                  />
                </div>

                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    disabled={creating || joining}
                    className={[
                      "flex-1 rounded-xl border px-4 py-3 text-sm font-extrabold transition disabled:opacity-50",
                      "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={onJoin}
                    disabled={creating || joining}
                    className={[
                      "flex-1 rounded-xl px-4 py-3 text-sm font-extrabold transition disabled:opacity-50",
                      "bg-gray-900 text-white hover:bg-gray-800",
                      "dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white",
                    ].join(" ")}
                  >
                    {joining ? "追加中..." : "追加"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Modal */}
      {actionOpen && selected && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-3">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-950 dark:shadow-none dark:ring-1 dark:ring-gray-800">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              {selected.name}
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {selected.role === "owner"
                ? "オーナー：共有 / 削除が可能"
                : "メンバー：削除しても自分の一覧から消えるだけです"}
            </div>

            <div className="mt-4 grid gap-2">
              {selected.role === "owner" && (
                <>
                  <button
                    type="button"
                    onClick={onGoSharedMembers}
                    className={[
                      "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold transition",
                      "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    <Users className="h-4 w-4" />
                    共有メンバー
                  </button>

                  <button
                    type="button"
                    onClick={onCopyShare}
                    className={[
                      "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold transition",
                      "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                      "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                    ].join(" ")}
                  >
                    <Copy className="h-4 w-4" />
                    共有（コードをコピー）
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={onDeleteSelected}
                className={[
                  "inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-extrabold transition",
                  "border-red-200 bg-white text-red-700 hover:bg-red-50",
                  "dark:border-red-900/50 dark:bg-gray-950 dark:text-red-400 dark:hover:bg-red-950/30",
                ].join(" ")}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </button>

              <button
                type="button"
                onClick={closeActions}
                className={[
                  "mt-1 inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 text-sm font-extrabold transition",
                  "border-gray-200 bg-white text-gray-900 hover:bg-gray-50",
                  "dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900",
                ].join(" ")}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
