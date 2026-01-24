"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ArrowLeft, Info, Plus, Trash2, Download, GripVertical } from "lucide-react";

import { auth, db } from "@/lib/firebaseClient";

/* =========================
   Types
========================= */

type Role = "owner" | "member";

type ProjectMeta = {
  role: Role;
  ownerUid?: string;
  sourceProjectId?: string;
};

type Step = {
  id: string;
  name: string; // 2行まで（\n を許可）
  order: number;
};

type PublicWorkTemplateSummary = {
  id: string;
  title: string;
  count: number;
  updatedAtText: string;
};

function safeMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "不明なエラー";
}

function parseProjectMeta(data: DocumentData | undefined): ProjectMeta {
  const roleRaw = data?.role;
  const role: Role = roleRaw === "member" ? "member" : "owner";

  const ownerUid = typeof data?.ownerUid === "string" ? data.ownerUid : undefined;
  const sourceProjectId =
    typeof data?.sourceProjectId === "string" ? data.sourceProjectId : undefined;

  return { role, ownerUid, sourceProjectId };
}

function parseStepDoc(d: QueryDocumentSnapshot<DocumentData>): Step {
  const data = d.data();
  const name = typeof data?.name === "string" ? data.name : "";
  const order = typeof data?.order === "number" ? data.order : 0;
  return { id: d.id, name, order };
}

/* =========================
   Page
========================= */

const INFO_TEXT =
  "工程を事前に設定すると、黒板などの工程選択で使えます。\nここでは工程名の登録と順序変更を行います。";

export default function RenovaProjectStepsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const sp = useSearchParams();

  // path param
  const projectId = params?.projectId ?? "";

  // query params
  const projectNameParam = sp.get("projectName");
  const projectName = projectNameParam ? decodeURIComponent(projectNameParam) : "";

  const workTypeIdParam = sp.get("workTypeId");
  const workTypeId = workTypeIdParam ? decodeURIComponent(workTypeIdParam) : "";

  const workTypeNameParam = sp.get("workTypeName");
  const workTypeName = workTypeNameParam ? decodeURIComponent(workTypeNameParam) : "";

  // auth
  const [me, setMe] = useState<User | null>(null);
  const uid = me?.uid ?? null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  // role/meta (member => owner側参照)
  const [role, setRole] = useState<Role>("owner");
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);

  // ✅ ここはそのままでOK（meta判定）
  useEffect(() => {
    let cancelled = false;

    async function run() {
      setRole("owner");
      setDataOwnerUid(null);
      setDataProjectId(null);

      if (!uid || !projectId) return;

      try {
        const myProjectRef = doc(db, "users", uid, "projects", projectId);
        const snap = await getDoc(myProjectRef);

        // 無い場合は owner 扱い（安全側）
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
          if (!meta.ownerUid) {
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
        console.log("ProjectSteps meta getDoc error:", e);
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

  // base query（戻ってきても崩れないように）
  const baseQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (projectName) q.set("projectName", projectName);
    if (workTypeId) q.set("workTypeId", workTypeId);
    if (workTypeName) q.set("workTypeName", workTypeName);
    return q.toString();
  }, [projectName, workTypeId, workTypeName]);

  /* =========================
     ✅ steps の参照先（projects 側に統一）
     - 読み込み/追加/削除/並び替え/テンプレ適用 すべてここを使う
  ========================= */

  const stepsColRef = useMemo(() => {
    if (!dataProjectId || !workTypeId) return null;
    return collection(db, "projects", dataProjectId, "workTypes", workTypeId, "steps");
  }, [dataProjectId, workTypeId]);

  const stepDocRef = useCallback(
    (stepId: string) => {
      if (!dataProjectId || !workTypeId) return null;
      return doc(db, "projects", dataProjectId, "workTypes", workTypeId, "steps", stepId);
    },
    [dataProjectId, workTypeId],
  );

  // steps
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!uid || !projectId || !workTypeId) {
      setSteps([]);
      setLoading(false);
      return;
    }
    if (!dataOwnerUid || !dataProjectId) {
      setSteps([]);
      setLoading(true);
      return;
    }
    if (!stepsColRef) {
      setSteps([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q0 = query(stepsColRef, orderBy("order", "asc"));
    const unsub = onSnapshot(
      q0,
      (snap) => {
        const list = snap.docs.map(parseStepDoc);
        setSteps(list);
        setLoading(false);
      },
      (e) => {
        console.log("steps onSnapshot error:", e);
        setSteps([]);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [uid, projectId, workTypeId, dataOwnerUid, dataProjectId, stepsColRef]);

  // add modal
  const [addOpen, setAddOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const normalize2Lines = (raw: string): string => {
    return String(raw ?? "")
      .split(/\r?\n/)
      .slice(0, 2)
      .join("\n")
      .trim();
  };

  const addStep = useCallback(async () => {
    const name = normalize2Lines(newName);

    if (!uid) {
      alert("未ログインです。ログイン後に利用できます。");
      setAddOpen(false);
      return;
    }
    if (!projectId || !workTypeId) {
      alert("工事/工種情報が取得できません。");
      setAddOpen(false);
      return;
    }
    if (!canEdit) {
      alert("共有メンバーは工程を編集できません。");
      setAddOpen(false);
      return;
    }
    if (!dataProjectId || !stepsColRef) {
      alert("共有情報の取得中です。少し待ってから再度お試しください。");
      return;
    }
    if (!name) {
      alert("工程名を入力してください（2行まで）。");
      return;
    }

    try {
      setSaving(true);

      // 末尾に追加（orderは最大+1）
      const maxOrder = steps.length ? Math.max(...steps.map((s) => s.order)) : -1;

      await addDoc(stepsColRef, {
        name,
        order: maxOrder + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setNewName("");
      setAddOpen(false);
    } catch (e: unknown) {
      alert(`保存失敗：${safeMsg(e)}`);
    } finally {
      setSaving(false);
    }
  }, [uid, projectId, workTypeId, canEdit, dataProjectId, stepsColRef, newName, steps]);

  const confirmDeleteStep = useCallback(
    async (s: Step) => {
      if (!uid) {
        alert("未ログインです。");
        return;
      }
      if (!canEdit) {
        alert("共有メンバーは削除できません。");
        return;
      }
      if (!projectId || !workTypeId || !dataProjectId) {
        alert("参照情報が確定していません。");
        return;
      }

      const ref = stepDocRef(s.id);
      if (!ref) {
        alert("参照情報が確定していません。");
        return;
      }

      const ok = window.confirm(`「${s.name}」を削除しますか？`);
      if (!ok) return;

      try {
        await deleteDoc(ref);
      } catch (e: unknown) {
        alert(`削除失敗：${safeMsg(e)}`);
      }
    },
    [uid, canEdit, projectId, workTypeId, dataProjectId, stepDocRef],
  );

  const confirmDeleteAll = useCallback(async () => {
    if (!uid) {
      alert("未ログインです。");
      return;
    }
    if (!canEdit) {
      alert("共有メンバーは全削除できません。");
      return;
    }
    if (!steps.length) {
      alert("削除する工程がありません。");
      return;
    }
    if (!dataProjectId || !workTypeId) {
      alert("参照情報が確定していません。");
      return;
    }

    const ok = window.confirm("工程を全削除しますか？\n※この操作は元に戻せません。");
    if (!ok) return;

    try {
      setSaving(true);
      const batch = writeBatch(db);

      for (const s of steps) {
        const ref = stepDocRef(s.id);
        if (ref) batch.delete(ref);
      }

      await batch.commit();
    } catch (e: unknown) {
      alert(`全削除失敗：${safeMsg(e)}`);
    } finally {
      setSaving(false);
    }
  }, [uid, canEdit, steps, dataProjectId, workTypeId, stepDocRef]);

  /* =========================
     Drag & Drop (HTML5)
========================= */

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragFromIndexRef = useRef<number>(-1);

  const reorderLocal = (from: number, to: number) => {
    const arr = [...steps];
    const picked = arr.splice(from, 1)[0];
    arr.splice(to, 0, picked);

    // order を再計算（0..）
    const normalized = arr.map((x, i) => ({ ...x, order: i }));
    setSteps(normalized);
    return normalized;
  };

  const persistOrder = useCallback(
    async (finalList: Step[]) => {
      if (!uid) throw new Error("未ログインです。");
      if (!canEdit) throw new Error("共有メンバーは並び替えできません。");
      if (!dataProjectId || !workTypeId) throw new Error("参照情報が確定していません。");

      const batch = writeBatch(db);

      for (const s of finalList) {
        const ref = stepDocRef(s.id);
        if (!ref) continue;
        batch.update(ref, {
          order: s.order,
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
    },
    [uid, canEdit, dataProjectId, workTypeId, stepDocRef],
  );

  const onDragStart = (index: number, stepId: string) => {
    if (!canEdit) return;
    setDraggingId(stepId);
    dragFromIndexRef.current = index;
  };

  const onDrop = async (toIndex: number) => {
    if (!canEdit) return;

    const from = dragFromIndexRef.current;
    dragFromIndexRef.current = -1;

    const didDrag = draggingId != null && from >= 0 && from !== toIndex;
    setDraggingId(null);

    if (!didDrag) return;

    const finalList = reorderLocal(from, toIndex);

    try {
      await persistOrder(finalList);
    } catch (e: unknown) {
      alert(`並び替え保存失敗：${safeMsg(e)}`);
    }
  };

  /* =========================
     Public templates
========================= */

  const [publicTemplates, setPublicTemplates] = useState<PublicWorkTemplateSummary[]>([]);
  const [publicTemplatesLoading, setPublicTemplatesLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setPublicTemplatesLoading(true);
      try {
        const colRef = collection(db, "publicWorkTemplates");
        const snap = await getDocs(colRef);

        const list: PublicWorkTemplateSummary[] = snap.docs.map((d) => {
          const data = d.data();

          const title =
            typeof data?.title === "string" && data.title.trim() ? data.title : d.id;

          const stepsArr = Array.isArray(data?.steps) ? (data.steps as unknown[]) : [];
          const count = stepsArr.length;

          const ts = data?.updatedAt as unknown;
          const updatedAtText =
            ts &&
            typeof ts === "object" &&
            ts !== null &&
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            typeof (ts as any).toDate === "function"
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (ts as any).toDate().toLocaleString()
              : "";

          return { id: d.id, title, count, updatedAtText };
        });

        if (!cancelled) setPublicTemplates(list);
      } catch (e: unknown) {
        console.log("publicWorkTemplates getDocs error:", e);
        if (!cancelled) setPublicTemplates([]);
      } finally {
        if (!cancelled) setPublicTemplatesLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPublicTemplate = useCallback(
    async (templateId: string) => {
      if (!uid) {
        alert("未ログインです。");
        return;
      }
      if (!projectId || !workTypeId) {
        alert("工事/工種情報が取得できません。");
        return;
      }
      if (!canEdit) {
        alert("共有メンバーはテンプレ適用できません。");
        return;
      }
      if (!dataProjectId || !stepsColRef) {
        alert("共有情報の取得中です。少し待ってから再度お試しください。");
        return;
      }

      const ok = window.confirm(
        "テンプレをダウンロードしますか？\n※現在の工程は置き換えになります。",
      );
      if (!ok) return;

      try {
        setSaving(true);

        const ref = doc(db, "publicWorkTemplates", templateId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          alert("テンプレが見つかりませんでした。");
          return;
        }

        const data = snap.data();
        const raw = Array.isArray(data?.steps) ? (data.steps as unknown[]) : [];

        // steps: [{name, order}] を想定
        const templateNames = raw
          .map((x) => {
            if (typeof x !== "object" || x === null) return null;
            const obj = x as Record<string, unknown>;
            const name = typeof obj.name === "string" ? obj.name.trim() : "";
            const order = typeof obj.order === "number" ? obj.order : 0;
            return name ? { name, order } : null;
          })
          .filter((v): v is { name: string; order: number } => v !== null)
          .sort((a, b) => a.order - b.order)
          .map((v) => v.name);

        if (!templateNames.length) {
          alert("空のテンプレです（工程が入っていません）。");
          return;
        }

        // ✅ 置換：既存削除 -> 追加（projects 側に統一）
        const batch = writeBatch(db);

        for (const s of steps) {
          const r = stepDocRef(s.id);
          if (r) batch.delete(r);
        }
        await batch.commit();

        // orderを0..で再構築
        for (let i = 0; i < templateNames.length; i++) {
          await addDoc(stepsColRef, {
            name: normalize2Lines(templateNames[i]),
            order: i,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        alert("テンプレの工程をダウンロードしました。");
      } catch (e: unknown) {
        console.log("applyPublicTemplate error:", e);
        alert(`適用失敗：${safeMsg(e)}`);
      } finally {
        setSaving(false);
      }
    },
    [uid, projectId, workTypeId, canEdit, dataProjectId, stepsColRef, steps, stepDocRef],
  );

  /* =========================
     Guard UI（Hooks後にreturn）
========================= */

  const missing = !projectId || !workTypeId;

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              工程設定
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              工事：{projectName || "（名称未設定）"}
            </div>
            <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-gray-100">
              工種：{workTypeName || "（工種未設定）"}
            </div>
            <div className="mt-1 text-xs font-extrabold text-gray-900 dark:text-gray-100">
              {canEdit ? "オーナー（編集可能）" : "メンバー（閲覧のみ）"}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              戻る
            </button>

            <button
              type="button"
              onClick={() => alert(INFO_TEXT)}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              <Info className="h-4 w-4" />
              ヒント
            </button>

            <Link
              href={`/proclink/projects/${encodeURIComponent(projectId)}?${baseQuery}`}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              工事へ
            </Link>
          </div>
        </div>

        {/* Missing guard */}
        {missing && (
          <div className="mt-6 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
              工事/工種情報が取得できませんでした
            </div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              もう一度、工事一覧 → 工区 → 工種から入り直してください。
            </div>
            <Link
              href="/proclink/projects"
              className="mt-4 inline-flex items-center justify-center rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            >
              工事一覧へ戻る
            </Link>
          </div>
        )}

        {!missing && (
          <>
            {/* Delete all */}
            <button
              type="button"
              onClick={confirmDeleteAll}
              disabled={!canEdit || saving || loading || steps.length === 0}
              className="mt-6 w-full rounded-2xl border border-red-200 bg-red-50 p-4 text-left disabled:opacity-50
                         dark:border-red-900/50 dark:bg-red-950/40"
            >
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-700 dark:text-red-300" />
                <div className="text-sm font-extrabold text-red-700 dark:text-red-300">
                  工程を全削除
                </div>
              </div>
              <div className="mt-1 text-xs font-bold text-red-700/80 dark:text-red-300/80">
                保存済み工程を一括で削除します（元に戻せません）
              </div>
            </button>

            {/* Public templates */}
            <div className="mt-4 rounded-2xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                共通テンプレ（ダウンロード）
              </div>

              {publicTemplatesLoading ? (
                <div className="mt-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  読み込み中...
                </div>
              ) : publicTemplates.length === 0 ? (
                <div className="mt-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                  テンプレがありません
                </div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {publicTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!canEdit || saving}
                      onClick={() => applyPublicTemplate(t.id)}
                      className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-left hover:bg-gray-100 disabled:opacity-50
                                 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                            {t.title}
                          </div>
                          <div className="mt-1 text-xs font-bold text-gray-600 dark:text-gray-400">
                            工程数：{t.count}
                            {t.updatedAtText ? ` / 更新：${t.updatedAtText}` : ""}
                          </div>
                        </div>
                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white dark:bg-gray-900">
                          <Download className="h-5 w-5 text-gray-900 dark:text-gray-100" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Steps list */}
            <div className="mt-4 rounded-2xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              {loading && (
                <div className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                  読み込み中...
                </div>
              )}

              {!loading && steps.length === 0 && (
                <div>
                  <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                    工程がまだありません
                  </div>
                  <div className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    {canEdit ? "右下の「＋」から追加してください" : "オーナーが追加すると表示されます"}
                  </div>
                </div>
              )}

              {!loading && steps.length > 0 && (
                <div className="grid gap-2">
                  {steps
                    .slice()
                    .sort((a, b) => a.order - b.order)
                    .map((s, idx) => {
                      const isDragging = draggingId === s.id;
                      return (
                        <div
                          key={s.id}
                          className={[
                            "rounded-2xl border p-4",
                            isDragging
                              ? "border-orange-300 bg-orange-50 dark:border-orange-500/40 dark:bg-orange-950/30"
                              : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900",
                          ].join(" ")}
                          draggable={canEdit}
                          onDragStart={() => onDragStart(idx, s.id)}
                          onDragOver={(e) => {
                            if (!canEdit) return;
                            e.preventDefault();
                          }}
                          onDrop={() => onDrop(idx)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="whitespace-pre-line text-sm font-extrabold text-gray-900 dark:text-gray-100">
                                {s.name}
                              </div>
                              <div className="mt-1 text-xs font-bold text-gray-600 dark:text-gray-400">
                                順番：{idx + 1}
                              </div>
                              {canEdit && (
                                <div className="mt-2 text-xs font-bold text-amber-700/90 dark:text-amber-300/90">
                                  ドラッグで並び替え可能
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {canEdit && (
                                <div
                                  className="grid h-10 w-10 place-items-center rounded-xl border bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
                                  title="ドラッグ"
                                >
                                  <GripVertical className="h-5 w-5 text-gray-900 dark:text-gray-100" />
                                </div>
                              )}

                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => confirmDeleteStep(s)}
                                  disabled={saving}
                                  className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-50
                                             dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  削除
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Floating Add Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="fixed bottom-6 right-6 z-40 grid h-16 w-16 place-items-center rounded-full bg-gray-900 shadow-lg hover:bg-gray-800
                           dark:bg-gray-100 dark:hover:bg-gray-200"
                aria-label="add-step"
              >
                <Plus className="h-7 w-7 text-white dark:text-gray-900" />
              </button>
            )}

            {/* Add Modal */}
            {addOpen && canEdit && (
              <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4">
                <div className="w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900">
                  <div className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
                    工程を追加
                  </div>
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    工程名は2行まで入力できます。
                  </div>

                  <div className="mt-4">
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      工程名
                    </div>
                    <textarea
                      value={newName}
                      onChange={(e) => {
                        const v = e.target.value;
                        const lines = v.split(/\r?\n/);
                        if (lines.length <= 2) setNewName(v);
                      }}
                      placeholder={"例：ケレン・清掃\nウレタン塗布"}
                      className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10
                                 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:focus:ring-gray-100/10"
                      rows={2}
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNewName("");
                        setAddOpen(false);
                      }}
                      disabled={saving}
                      className="flex-1 rounded-xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-60
                                 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                      キャンセル
                    </button>

                    <button
                      type="button"
                      onClick={addStep}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-60
                                 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      {saving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Auth note */}
            {!me && (
              <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                未ログインの可能性があります。必要に応じてログインしてください。
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
