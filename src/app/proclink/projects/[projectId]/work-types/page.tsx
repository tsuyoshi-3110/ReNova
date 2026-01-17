"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Plus,
  Info,
  Trash2,
  ArrowLeft,
  GripVertical,
  Pencil,
  Check,
  X,
} from "lucide-react";

import { auth, db } from "@/lib/firebaseClient";

// ✅ DnD
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** ========= Types ========= */

type Role = "owner" | "member";

type ProjectMeta = {
  role: Role;
  ownerUid?: string;
  sourceProjectId?: string;
};

type WorkType = {
  id: string;
  name: string;
  order?: number; // ✅ 追加：並び順
  createdAtMs?: number; // ✅ 追加：初期並びの安定用（既存データ互換）
};

function safeMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "不明なエラー";
}

function parseProjectMeta(data: DocumentData | undefined): ProjectMeta {
  const roleRaw = data?.role;
  const role: Role = roleRaw === "member" ? "member" : "owner";

  const ownerUid =
    typeof data?.ownerUid === "string" ? data.ownerUid : undefined;
  const sourceProjectId =
    typeof data?.sourceProjectId === "string"
      ? data.sourceProjectId
      : undefined;

  return { role, ownerUid, sourceProjectId };
}

function parseWorkTypeDoc(d: QueryDocumentSnapshot<DocumentData>): WorkType {
  const data = d.data();

  const createdAtMs =
    typeof data?.createdAt?.toMillis === "function"
      ? (data.createdAt.toMillis() as number)
      : undefined;

  return {
    id: d.id,
    name: typeof data?.name === "string" ? data.name : "",
    order: typeof data?.order === "number" ? data.order : undefined,
    createdAtMs,
  };
}

/** ========= UI Text ========= */

const INFO_TEXT =
  "工区（施工場所）は、できるだけ最小単位で作成してください。小さく分けるほど写真整理・管理がしやすくなります。";

/** ========= Sortable Row ========= */

function SortableRow(props: {
  wt: WorkType;
  canEdit: boolean;
  onGo: (wt: WorkType) => void;
  onDelete: (wt: WorkType) => void;
  onEdit: (wt: WorkType) => void;
}) {
  const { wt, canEdit, onGo, onDelete, onEdit } = props;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wt.id, disabled: !canEdit });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="button"
      tabIndex={0}
      onClick={() => onGo(wt)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onGo(wt);
        }
      }}
      className={[
        "rounded-2xl border border-gray-200 bg-white p-4 text-left hover:bg-gray-50 cursor-pointer",
        "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70",
        isDragging ? "ring-2 ring-gray-900/10 dark:ring-gray-100/10" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* ✅ Drag handle（ownerのみ有効） */}
            {canEdit && (
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-900"
                title="ドラッグで並び替え"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}

            <div className="min-w-0">
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                {wt.name}
              </div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                タップでメニューへ
              </div>
            </div>
          </div>
        </div>

        {/* ✅ 操作（ownerのみ） */}
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(wt);
              }}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
              title="名前を編集"
            >
              <Pencil className="h-4 w-4" />
              編集
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(wt);
              }}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
              title="削除"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** ========= Page ========= */

export default function RenovaProjectWorkTypesPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const sp = useSearchParams();

  // URL Params
  const projectId = params?.projectId ?? "";
  const projectNameParam = sp.get("projectName");
  const projectName = projectNameParam
    ? decodeURIComponent(projectNameParam)
    : "";

  // Auth
  const [me, setMe] = useState<User | null>(null);
  const uid = me?.uid ?? null;

  // Role/meta
  const [role, setRole] = useState<Role>("owner");
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);

  // List
  const [items, setItems] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add modal
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [adding, setAdding] = useState<boolean>(false);

  // ✅ Edit modal（名前編集）
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkType | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Auth subscribe
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  // まず project meta を読み、owner/member に応じた参照先を確定
  useEffect(() => {
    let cancelled = false;

    async function run() {
      // 初期化
      setRole("owner");
      setDataOwnerUid(null);
      setDataProjectId(null);

      if (!uid || !projectId) return;

      try {
        // member か owner かは「自分側の users/{uid}/projects/{projectId}」で判断
        const myProjectRef = doc(db, "users", uid, "projects", projectId);
        const snap = await getDoc(myProjectRef);

        // 無い場合は owner 扱い（念のため）
        if (!snap.exists()) {
          if (cancelled) return;
          setRole("owner");
          setDataOwnerUid(uid);
          setDataProjectId(projectId);
          return;
        }

        const meta = parseProjectMeta(snap.data());

        if (cancelled) return;
        setRole(meta.role);

        if (meta.role === "member") {
          // member は owner 側の workTypes を参照する
          if (!meta.ownerUid) {
            if (cancelled) return;
            setDataOwnerUid(null);
            setDataProjectId(null);
            return;
          }

          setDataOwnerUid(meta.ownerUid);
          setDataProjectId(meta.sourceProjectId ?? projectId);
        } else {
          setDataOwnerUid(uid);
          setDataProjectId(projectId);
        }
      } catch (e: unknown) {
        console.log("workTypes meta getDoc error:", e);
        if (cancelled) return;
        setDataOwnerUid(null);
        setDataProjectId(null);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [uid, projectId]);

  const canEdit = role === "owner";

  // owner/member の参照先が確定したら workTypes を購読
  useEffect(() => {
    if (!uid || !projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    if (!dataOwnerUid || !dataProjectId) {
      // meta 確定待ち
      setItems([]);
      setLoading(true);
      return;
    }

    setLoading(true);

    const col = collection(
      db,
      "users",
      dataOwnerUid,
      "projects",
      dataProjectId,
      "workTypes",
    );

    // ✅ 既存の createdAt を使って購読は安定させ、表示は order で並べる（既存互換）
    const q = query(col, orderBy("createdAt", "asc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map(parseWorkTypeDoc)
          .filter((x) => x.name.trim());

        // ✅ 表示順：order があるものは order 昇順 / 無いものは createdAt 昇順
        list.sort((a, b) => {
          const ao = typeof a.order === "number" ? a.order : null;
          const bo = typeof b.order === "number" ? b.order : null;
          if (ao !== null && bo !== null) return ao - bo;
          if (ao !== null) return -1;
          if (bo !== null) return 1;

          const ac = typeof a.createdAtMs === "number" ? a.createdAtMs : 0;
          const bc = typeof b.createdAtMs === "number" ? b.createdAtMs : 0;
          return ac - bc;
        });

        setItems(list);
        setLoading(false);
      },
      (e) => {
        console.log("workTypes onSnapshot error:", e);
        setItems([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [uid, projectId, dataOwnerUid, dataProjectId]);

  // 画面遷移で使う query（projectMenu と共通）
  const baseQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (projectId) q.set("projectId", projectId);
    if (projectName) q.set("projectName", projectName);
    return q.toString();
  }, [projectId, projectName]);

  const goMenu = useCallback(
    (wt: WorkType) => {
      const q = new URLSearchParams(baseQuery);
      q.set("workTypeId", wt.id);
      q.set("workTypeName", wt.name);

      // ✅ ここが要件：必ずこの遷移先
      router.push(`/proclink/projects/projectMenu?${q.toString()}`);
    },
    [router, baseQuery],
  );

  const addWorkType = useCallback(async () => {
    const name = newName.trim();

    if (!uid) {
      setAddOpen(false);
      alert("未ログインです。ログイン後に追加できます。");
      return;
    }
    if (!projectId) {
      setAddOpen(false);
      alert("工事情報が取得できません。");
      return;
    }
    if (!canEdit) {
      setAddOpen(false);
      alert("共有メンバーは工区を追加できません。");
      return;
    }
    if (!dataOwnerUid || !dataProjectId) {
      setAddOpen(false);
      alert("保存先が確定していません。");
      return;
    }
    if (!name) {
      alert("工区名を入力してください。");
      return;
    }

    try {
      setAdding(true);

      const col = collection(
        db,
        "users",
        dataOwnerUid,
        "projects",
        dataProjectId,
        "workTypes",
      );

      // ✅ 追加時点で order を付ける（新規は最後尾）
      const maxOrder = items.reduce((m, x) => {
        const o = typeof x.order === "number" ? x.order : null;
        return o === null ? m : Math.max(m, o);
      }, -1);

      await addDoc(col, {
        name,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewName("");
      setAddOpen(false);
    } catch (e: unknown) {
      alert(`追加失敗：${safeMsg(e)}`);
    } finally {
      setAdding(false);
    }
  }, [uid, projectId, canEdit, dataOwnerUid, dataProjectId, newName, items]);

  const confirmDelete = useCallback(
    async (wt: WorkType) => {
      if (!uid || !projectId) return;

      if (!canEdit) {
        alert("共有メンバーは削除できません。");
        return;
      }
      if (!dataOwnerUid || !dataProjectId) {
        alert("参照情報が確定していません。");
        return;
      }

      const ok = window.confirm(`「${wt.name}」を削除しますか？`);
      if (!ok) return;

      try {
        await deleteDoc(
          doc(
            db,
            "users",
            dataOwnerUid,
            "projects",
            dataProjectId,
            "workTypes",
            wt.id,
          ),
        );
      } catch (e: unknown) {
        alert(`削除失敗：${safeMsg(e)}`);
      }
    },
    [uid, projectId, canEdit, dataOwnerUid, dataProjectId],
  );

  // ✅ 並び順をFirestoreに保存
  const persistOrder = useCallback(
    async (next: WorkType[]) => {
      if (!canEdit) return;
      if (!dataOwnerUid || !dataProjectId) return;

      try {
        const batch = writeBatch(db);
        next.forEach((wt, idx) => {
          batch.set(
            doc(
              db,
              "users",
              dataOwnerUid,
              "projects",
              dataProjectId,
              "workTypes",
              wt.id,
            ),
            { order: idx, updatedAt: serverTimestamp() },
            { merge: true },
          );
        });
        await batch.commit();
      } catch (e) {
        console.log("persistOrder error:", e);
        alert(`並び替えの保存に失敗しました：${safeMsg(e)}`);
      }
    },
    [canEdit, dataOwnerUid, dataProjectId],
  );

  // ✅ DnD（ownerのみ有効）
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      if (!canEdit) return;

      const { active, over } = e;
      if (!over) return;
      if (active.id === over.id) return;

      const oldIndex = items.findIndex((x) => x.id === String(active.id));
      const newIndex = items.findIndex((x) => x.id === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(items, oldIndex, newIndex);

      // 先にUI反映（体感を良くする）
      setItems(next);

      // Firestoreに保存
      await persistOrder(next);
    },
    [canEdit, items, persistOrder],
  );

  // ✅ 編集モーダル
  const openEdit = useCallback((wt: WorkType) => {
    setEditTarget(wt);
    setEditName(wt.name);
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setEditTarget(null);
    setEditName("");
    setSavingEdit(false);
  }, []);

  const saveEdit = useCallback(async () => {
    const name = editName.trim();

    if (!canEdit) {
      closeEdit();
      return;
    }
    if (!editTarget) return;
    if (!name) {
      alert("工区名を入力してください。");
      return;
    }
    if (!dataOwnerUid || !dataProjectId) {
      alert("保存先が確定していません。");
      return;
    }

    try {
      setSavingEdit(true);

      await doc(
        db,
        "users",
        dataOwnerUid,
        "projects",
        dataProjectId,
        "workTypes",
        editTarget.id,
      );

      // setDoc importを増やさず、最小変更で merge 更新したいので batch.set を使う
      const batch = writeBatch(db);
      batch.set(
        doc(
          db,
          "users",
          dataOwnerUid,
          "projects",
          dataProjectId,
          "workTypes",
          editTarget.id,
        ),
        { name, updatedAt: serverTimestamp() },
        { merge: true },
      );
      await batch.commit();

      closeEdit();
    } catch (e) {
      alert(`更新失敗：${safeMsg(e)}`);
      setSavingEdit(false);
    }
  }, [editName, canEdit, editTarget, dataOwnerUid, dataProjectId, closeEdit]);

  // Guard UI（Hooks はここまでで全部呼んでいるのでOK）
  if (!projectId) {
    return (
      <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
        <div className="mx-auto w-full max-w-3xl px-4 py-8">
          <div className="rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              工事情報が取得できませんでした
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              もう一度、工事一覧から選択してください。
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
              工区一覧
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              工事：{projectName || "（名称未設定）"}
            </div>
            <div className="mt-1 text-xs font-extrabold text-gray-900 dark:text-gray-100">
              {canEdit ? "オーナー" : "メンバー"}（
              {canEdit ? "追加/削除/編集/並び替え可能" : "閲覧のみ"}）
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

            <button
              type="button"
              onClick={() => alert(INFO_TEXT)}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
              title="ヒント"
            >
              <Info className="h-4 w-4" />
              ヒント
            </button>

            <Link
              href="/proclink/projects"
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              工事一覧
            </Link>
          </div>
        </div>

        {/* Body */}
        <div className="mt-6">
          {loading && (
            <div className="rounded-2xl border bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
              読み込み中...
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                工区、施工場所を設定してください。
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {canEdit
                  ? "右下の「＋」から追加できます"
                  : "オーナーが追加するとここに表示されます"}
              </div>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div className="grid gap-3">
              {/* ✅ DnD（ownerのみ有効） */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={items.map((x) => x.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {items.map((wt) => (
                    <SortableRow
                      key={wt.id}
                      wt={wt}
                      canEdit={canEdit}
                      onGo={goMenu}
                      onDelete={confirmDelete}
                      onEdit={openEdit}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {canEdit && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  並び替え：左のハンドルをドラッグしてください（自動保存）
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating Add Button (owner only) */}
        {canEdit && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="fixed bottom-6 right-6 z-40 grid h-16 w-16 place-items-center rounded-full bg-gray-900 shadow-lg hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-white"
            aria-label="add"
          >
            <Plus className="h-7 w-7 text-white dark:text-gray-900" />
          </button>
        )}

        {/* Add Modal (owner only) */}
        {addOpen && canEdit && (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-950 dark:shadow-none dark:ring-1 dark:ring-gray-800">
              <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                工区を追加
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                工事「{projectName || "（名称未設定）"}」に紐づく工区を追加します。
              </div>

              <div className="mt-4">
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  工区名
                </div>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="例：1工区、バルコニー、廊下など"
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:ring-gray-200/10"
                  autoFocus
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  disabled={adding}
                  className="flex-1 rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                >
                  キャンセル
                </button>

                <button
                  type="button"
                  onClick={addWorkType}
                  disabled={adding}
                  className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {adding ? "追加中..." : "追加"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Edit Modal (owner only) */}
        {editOpen && canEdit && editTarget && (
          <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-950 dark:shadow-none dark:ring-1 dark:ring-gray-800">
              <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                工区名を編集
              </div>

              <div className="mt-4">
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  工区名
                </div>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:ring-gray-200/10"
                  autoFocus
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={savingEdit}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                >
                  <X className="h-4 w-4" />
                  キャンセル
                </button>

                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  <Check className="h-4 w-4" />
                  {savingEdit ? "保存中..." : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Not logged-in note */}
        {!me && (
          <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            未ログインの可能性があります。必要に応じてログインしてください。
          </div>
        )}
      </div>
    </main>
  );
}
