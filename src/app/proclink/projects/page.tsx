"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type DocumentData,
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
  id: string;
  name: string;
  subtitle: string;
  shareCode: string | null;
  role: Role;
  ownerUid?: string | null;
  sourceProjectId?: string | null;
  revoked?: boolean;
  updatedAt?: unknown;
};

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toBool(v: unknown): boolean {
  return v === true;
}

function safeMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "不明なエラー";
}

/** -----------------------------
 * Firestore helpers
 * ----------------------------*/
function projectsCol(db: Firestore, uid: string) {
  return collection(db, "users", uid, "projects");
}

// shareCode を「確実に一意」で確保する
async function reserveShareCode(params: {
  db: Firestore;
  ownerUid: string;
  projectId: string;
}) {
  const { db, ownerUid, projectId } = params;

  for (let i = 0; i < 10; i++) {
    const code = nanoid(6).toUpperCase();
    const ref = doc(db, "shareCodes", code);

    try {
      await runTransaction(db, async (tx) => {
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
      // 衝突したら再生成してリトライ
      if (e instanceof Error && e.message.includes("code_exists")) continue;
      // その他も一旦リトライ（通信瞬断などもあるため）
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
  const { db, uid, me, name, subtitle } = params;

  // まず project を作ってID確定（shareCodeは後で入れる）
  const docRef = await addDoc(projectsCol(db, uid), {
    name,
    subtitle,
    shareCode: null,
    role: "owner",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // ✅ ここで shareCode を確実に一意で確保
  const shareCode = await reserveShareCode({
    db,
    ownerUid: uid,
    projectId: docRef.id,
  });

  // project に shareCode を反映
  await setDoc(
    doc(db, "users", uid, "projects", docRef.id),
    { shareCode, updatedAt: serverTimestamp() },
    { merge: true },
  );

  // owner は members に自分を入れておく（既存のまま）
  await setDoc(
    doc(db, "users", uid, "projects", docRef.id, "members", uid),
    {
      uid,
      displayName: me.displayName ?? "",
      email: me.email ?? "",
      joinedAt: serverTimestamp(),
      revoked: false,
    },
    { merge: true },
  );

  return { projectId: docRef.id, shareCode };
}

async function joinByShareCode(params: {
  db: Firestore;
  uid: string;
  me: User;
  code: string;
}) {
  const { db, uid, me, code } = params;

  // ✅ shareCodes/{CODE} を参照（確実）
  const codeRef = doc(db, "shareCodes", code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const codeData = codeSnap.data() as DocumentData;

  // shareCodes 側に保存した ownerUid / projectId を読む
  const ownerUid =
    typeof codeData?.ownerUid === "string" ? codeData.ownerUid : null;
  const sourceProjectId =
    typeof codeData?.projectId === "string" ? codeData.projectId : null;

  if (!ownerUid || !sourceProjectId) {
    return { ok: false as const, reason: "owner_missing" as const };
  }

  // owner の projects から表示用 name/subtitle を取得（正）
  const ownerProjectRef = doc(
    db,
    "users",
    ownerUid,
    "projects",
    sourceProjectId,
  );
  const ownerProjectSnap = await getDoc(ownerProjectRef);

  if (!ownerProjectSnap.exists()) {
    return { ok: false as const, reason: "not_found" as const };
  }

  const ownerProject = ownerProjectSnap.data() as DocumentData;
  const name = toStr(ownerProject?.name) || "工事";
  const subtitle = toStr(ownerProject?.subtitle).trim();

  // 既に自分の projects にあるかチェック（member 側の docId は sourceProjectId を使う）
  const myRef = doc(db, "users", uid, "projects", sourceProjectId);
  const exists = await getDoc(myRef);
  if (exists.exists()) {
    return { ok: false as const, reason: "already" as const };
  }

  await setDoc(myRef, {
    name,
    subtitle,
    shareCode: code,
    role: "member",
    ownerUid,
    sourceProjectId,
    revoked: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    joinedAt: serverTimestamp(),
  });

  // owner 側 members に自分を追加
  await setDoc(
    doc(db, "users", ownerUid, "projects", sourceProjectId, "members", uid),
    {
      uid,
      displayName: me.displayName ?? "",
      email: me.email ?? "",
      joinedAt: serverTimestamp(),
      revoked: false,
    },
    { merge: true },
  );

  return { ok: true as const, name, ownerUid, sourceProjectId };
}

/** ✅ owner も member も「自分の users/{uid}/projects/{projectId}」を削除するだけ */
async function deleteMyProject(params: {
  db: Firestore;
  uid: string;
  projectId: string;
}) {
  const { db, uid, projectId } = params;
  await deleteDoc(doc(db, "users", uid, "projects", projectId));
}

/** -----------------------------
 * Hooks
 * ----------------------------*/
function useProjectsList(db: Firestore, uid: string | null) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [slow, setSlow] = useState(false);

  const colRef = useMemo(() => {
    if (!uid) return null;
    return collection(db, "users", uid, "projects");
  }, [db, uid]);

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
          const data = d.data() as DocumentData;
          return {
            id: d.id,
            name: toStr(data?.name),
            subtitle: toStr(data?.subtitle),
            role: (toStr(data?.role) as Role) || "member",
            shareCode:
              typeof data?.shareCode === "string" ? data.shareCode : null,
            ownerUid: typeof data?.ownerUid === "string" ? data.ownerUid : null,
            sourceProjectId:
              typeof data?.sourceProjectId === "string"
                ? data.sourceProjectId
                : null,
            revoked: toBool(data?.revoked),
            updatedAt: data?.updatedAt,
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
  db: Firestore,
  uid: string | null,
  projects: Project[],
) {
  const targets = useMemo(() => {
    return projects.filter(
      (p) => p.role === "member" && !!p.ownerUid && !!p.sourceProjectId,
    );
  }, [projects]);

  useEffect(() => {
    if (!uid) return;
    if (targets.length === 0) return;

    const unsubs = targets.map((p) => {
      const projectId = p.sourceProjectId as string;
      const ownerUid = p.ownerUid as string;

      const memberRef = doc(
        db,
        "users",
        ownerUid,
        "projects",
        projectId,
        "members",
        uid,
      );

      return onSnapshot(
        memberRef,
        async (snap) => {
          const revokedRemote = !snap.exists()
            ? true
            : toBool((snap.data() as DocumentData)?.revoked);
          const revokedLocal = !!p.revoked;

          if (revokedRemote === revokedLocal) return;

          await setDoc(
            doc(db, "users", uid, "projects", projectId),
            { revoked: revokedRemote, updatedAt: serverTimestamp() },
            { merge: true },
          );
        },
        () => {},
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [db, uid, targets]);
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
    return (
      projects
        .filter((p) => !(p.role === "member" && p.revoked))
        .slice()
        // ✅ 五十音順（日本語ロケール）
        .sort((a, b) =>
          (a.name ?? "").localeCompare(b.name ?? "", "ja", {
            sensitivity: "base",
            numeric: true,
          }),
        )
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
      window.alert("サブタイトルを入力してください。");
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
      const res = await joinByShareCode({ db, uid: me.uid, me, code });

      if (!res.ok) {
        if (res.reason === "not_found") {
          window.alert(
            "共有コードが見つかりません。正しいか確認してください。",
          );
          return;
        }
        if (res.reason === "owner_missing") {
          window.alert("参加失敗：共有元の情報が取得できませんでした。");
          return;
        }
        if (res.reason === "already") {
          window.alert("この工事はすでに一覧に追加されています。");
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

  /** ✅ owner でも member でも「自分の一覧から消す」だけ */
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
      // ✅ owner の場合だけ shareCodes も消す
      if (selected.role === "owner" && selected.shareCode) {
        await deleteDoc(doc(db, "shareCodes", selected.shareCode));
      }

      await deleteMyProject({ db, uid: me.uid, projectId: selected.id });
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
      `【ReNova】工事「${selected.name}」の共有コード：${selected.shareCode}\n` +
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
        `/proclink/projects/${encodeURIComponent(p.id)}/work-types` +
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
              ReNova（工事プロジェクト）
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
