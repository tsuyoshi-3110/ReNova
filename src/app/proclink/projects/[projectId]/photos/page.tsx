"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
} from "firebase/firestore";
import { deleteObject, getStorage, ref as storageRef } from "firebase/storage";
import {
  ArrowLeft,
  CheckSquare,
  Square,
  Download,
  Trash2,
  X,
} from "lucide-react";
import { FileText } from "lucide-react";

import { auth, db } from "@/lib/firebaseClient";

import { Loader2 } from "lucide-react";

type Role = "owner" | "member";
type BaseKind = "root" | "user";

type PhotoDoc = {
  id: string;

  shotByUid?: string | null;
  userId?: string | null;

  originalUrl?: string | null;
  renderedUrl?: string | null;

  originalPath?: string | null;
  renderedPath?: string | null;

  shotAt?: Timestamp | null;
  createdAt?: Timestamp | null;

  width?: number | null;
  height?: number | null;

  shotByDisplayName?: string | null;
  shotByEmail?: string | null;

  kokuban?: {
    projectName?: string | null;
    subtitle?: string | null; // ★追加
    location?: string | null;
    date?: string | null;
    memo?: string | null;
  } | null;

  workTypeId?: string | null;
  workTypeName?: string | null;

  stepOrder?: number | null;
};

type StepDoc = {
  id: string;
  name: string;
  order: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

/** ========= any禁止: ユーティリティ ========= */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}
function getNum(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
function safeDecode(v: string | null): string {
  if (!v) return "";
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
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
function getRole(v: unknown): Role {
  return v === "owner" || v === "member" ? v : "owner";
}

function pickImageUrl(p: PhotoDoc): string | null {
  const u1 = p.originalUrl ?? null;
  const u2 = p.renderedUrl ?? null;
  return u1 || u2;
}

function downloadViaApi(remoteUrl: string, filename: string) {
  const api = `/api/download?url=${encodeURIComponent(
    remoteUrl,
  )}&name=${encodeURIComponent(filename)}`;

  const a = document.createElement("a");
  a.href = api;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function decodePhotoSnap(snap: QueryDocumentSnapshot<DocumentData>): PhotoDoc {
  const data = snap.data();

  const doc0: PhotoDoc = { id: snap.id };
  if (!isRecord(data)) return doc0;

  const kokuban = isRecord(data["kokuban"])
    ? {
        projectName: getString(
          (data["kokuban"] as Record<string, unknown>)["projectName"],
        ),
        subtitle: getString(
          // ★追加：工種
          (data["kokuban"] as Record<string, unknown>)["subtitle"],
        ),
        location: getString(
          (data["kokuban"] as Record<string, unknown>)["location"],
        ),
        date: getString((data["kokuban"] as Record<string, unknown>)["date"]),
        memo: getString((data["kokuban"] as Record<string, unknown>)["memo"]),
      }
    : null;

  return {
    id: snap.id,
    shotByUid: getString(data["shotByUid"]),
    userId: getString(data["userId"]),
    originalUrl: getString(data["originalUrl"]),
    renderedUrl: getString(data["renderedUrl"]),
    originalPath: getString(data["originalPath"]),
    renderedPath: getString(data["renderedPath"]),
    width: getNum(data["width"]),
    height: getNum(data["height"]),
    kokuban,
    workTypeId: getString(data["workTypeId"]),
    workTypeName: getString(data["workTypeName"]),
    stepOrder: getNum(data["stepOrder"]),
    shotAt: (data["shotAt"] as Timestamp | undefined) ?? null,
    createdAt: (data["createdAt"] as Timestamp | undefined) ?? null,
    shotByDisplayName: getString(data["shotByDisplayName"]),
    shotByEmail: getString(data["shotByEmail"]),
  };
}

function pickShooterLabel(p: PhotoDoc): string {
  const dn = (p.shotByDisplayName ?? "").trim();
  if (dn) return dn;

  const em = (p.shotByEmail ?? "").trim();
  if (em) return em;

  return "";
}

function decodeStepSnap(snap: QueryDocumentSnapshot<DocumentData>): StepDoc {
  const data = snap.data();

  const name0 = isRecord(data) ? getString(data["name"]) : null;
  const order0 = isRecord(data) ? getNum(data["order"]) : null;

  return {
    id: snap.id,
    name: String(name0 ?? ""),
    order: typeof order0 === "number" ? order0 : 0,
    createdAt: isRecord(data)
      ? ((data["createdAt"] as Timestamp | undefined) ?? null)
      : null,
    updatedAt: isRecord(data)
      ? ((data["updatedAt"] as Timestamp | undefined) ?? null)
      : null,
  };
}

function getProjectRef(db0: Firestore, uid: string, projectId: string) {
  return doc(db0, "users", uid, "projects", projectId);
}

function normKey(s: string): string {
  return s.trim();
}

export default function RenovaProjectPhotoListPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const sp = useSearchParams();

  // params/query（Hookは常に同順で呼ばれる構造にする）
  const projectId = params?.projectId ?? "";
  const projectName = safeDecode(sp.get("projectName"));
  const workTypeId = safeDecode(sp.get("workTypeId"));
  const workTypeName = safeDecode(sp.get("workTypeName"));

  // auth
  const [me, setMe] = useState<User | null>(null);
  const uid = me?.uid ?? null;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setMe(u ?? null));
    return () => unsub();
  }, []);

  // role判定 & owner参照（memberはowner側を読む）
  const [myRole, setMyRole] = useState<Role | null>(null);
  const [dataOwnerUid, setDataOwnerUid] = useState<string | null>(null);
  const [dataProjectId, setDataProjectId] = useState<string | null>(null);

  const canEdit = myRole === "owner";

  // base（root/user 混在の可能性に備える）
  const [base, setBase] = useState<BaseKind>("user");

  // list
  const [loading, setLoading] = useState<boolean>(true);
  const [photos, setPhotos] = useState<PhotoDoc[]>([]);

  // steps
  const [stepsLoading, setStepsLoading] = useState<boolean>(true);
  const [steps, setSteps] = useState<StepDoc[]>([]);

  // select mode
  const [selectMode, setSelectMode] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const selectedCount = useMemo<number>(() => {
    return Object.values(selectedIds).filter(Boolean).length;
  }, [selectedIds]);

  // bulk overlay
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [bulkText, setBulkText] = useState<string>("");

  const bulkRunIdRef = useRef<number>(0);

  // delete busy
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});

  const [pdfBusy, setPdfBusy] = useState(false);

  // stepごとの表示中インデックス（スライド）
  const [stepSlideIndex, setStepSlideIndex] = useState<Record<string, number>>(
    {},
  );

  const slidePrev = useCallback((stepId: string) => {
    setStepSlideIndex((prev) => {
      const cur = prev[stepId] ?? 0;
      const next = Math.max(cur - 1, 0);
      return { ...prev, [stepId]: next };
    });
  }, []);

  const slideNext = useCallback((stepId: string, len: number) => {
    setStepSlideIndex((prev) => {
      const cur = prev[stepId] ?? 0;
      const next = Math.min(cur + 1, Math.max(len - 1, 0));
      return { ...prev, [stepId]: next };
    });
  }, []);

  // 共通クエリ（戻っても表示崩れない用）
  const baseQuery = useMemo<string>(() => {
    const q = new URLSearchParams();
    if (projectName) q.set("projectName", projectName);
    if (workTypeId) q.set("workTypeId", workTypeId);
    if (workTypeName) q.set("workTypeName", workTypeName);
    return q.toString();
  }, [projectName, workTypeId, workTypeName]);

  /** member/owner を確定し参照先 ownerUid / sourceProjectId を決める */
  useEffect(() => {
    if (!uid || !projectId) {
      setMyRole(null);
      setDataOwnerUid(null);
      setDataProjectId(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const myProjectRef = getProjectRef(db, uid, projectId);
        const snap = await getDoc(myProjectRef);

        // 自分側に projectDoc が無い = owner 扱い
        if (!snap.exists()) {
          if (!cancelled) {
            setMyRole("owner");
            setDataOwnerUid(uid);
            setDataProjectId(projectId);
          }
          return;
        }

        const data = snap.data();
        const role = isRecord(data) ? getRole(data["role"]) : "owner";
        if (cancelled) return;

        setMyRole(role);

        if (role === "member") {
          const ownerUid2 = isRecord(data) ? getString(data["ownerUid"]) : null;
          const srcProjectId = isRecord(data)
            ? (getString(data["sourceProjectId"]) ?? projectId)
            : projectId;

          if (!ownerUid2) {
            setMyRole(null);
            setDataOwnerUid(null);
            setDataProjectId(null);
            window.alert(
              "取得失敗：共有元（ownerUid）が見つかりませんでした。",
            );
            return;
          }

          setDataOwnerUid(ownerUid2);
          setDataProjectId(srcProjectId);
        } else {
          setDataOwnerUid(uid);
          setDataProjectId(projectId);
        }
      } catch (e: unknown) {
        if (cancelled) return;
        setMyRole(null);
        setDataOwnerUid(null);
        setDataProjectId(null);
        window.alert(`取得失敗：${toErrorMessage(e)}`);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [uid, projectId]);

  /** root/user の混在判定（最低限） */
  useEffect(() => {
    if (!workTypeId || !dataProjectId || !dataOwnerUid) return;

    let alive = true;

    (async () => {
      // 1) root 側 photos が1件でもあれば root
      try {
        const rootPhotos = collection(
          db,
          "projects",
          dataProjectId,
          "workTypes",
          workTypeId,
          "photos",
        );
        const s1 = await getDocs(query(rootPhotos, limit(1)));
        if (!alive) return;
        if (!s1.empty) {
          setBase("root");
          return;
        }
      } catch {
        // ignore
      }

      // 2) user(owner) 側 photos があれば user
      try {
        const userPhotos = collection(
          db,
          "users",
          dataOwnerUid,
          "projects",
          dataProjectId,
          "workTypes",
          workTypeId,
          "photos",
        );
        const s2 = await getDocs(query(userPhotos, limit(1)));
        if (!alive) return;
        if (!s2.empty) {
          setBase("user");
          return;
        }
      } catch {
        // ignore
      }

      // 3) workType doc が root にあるなら root を優先
      try {
        const wt = await getDoc(
          doc(db, "projects", dataProjectId, "workTypes", workTypeId),
        );
        if (!alive) return;
        if (wt.exists()) {
          setBase("root");
          return;
        }
      } catch {
        // ignore
      }

      if (alive) setBase("user");
    })();

    return () => {
      alive = false;
    };
  }, [workTypeId, dataProjectId, dataOwnerUid]);

  const photosCol = useMemo(() => {
    if (!workTypeId || !dataProjectId) return null;

    if (base === "root") {
      return collection(
        db,
        "projects",
        dataProjectId,
        "workTypes",
        workTypeId,
        "photos",
      );
    }

    if (!dataOwnerUid) return null;
    return collection(
      db,
      "users",
      dataOwnerUid,
      "projects",
      dataProjectId,
      "workTypes",
      workTypeId,
      "photos",
    );
  }, [base, dataOwnerUid, dataProjectId, workTypeId]);

  const stepsCol = useMemo(() => {
    if (!workTypeId || !dataProjectId) return null;

    if (base === "root") {
      return collection(
        db,
        "projects",
        dataProjectId,
        "workTypes",
        workTypeId,
        "steps",
      );
    }

    if (!dataOwnerUid) return null;
    return collection(
      db,
      "users",
      dataOwnerUid,
      "projects",
      dataProjectId,
      "workTypes",
      workTypeId,
      "steps",
    );
  }, [base, dataOwnerUid, dataProjectId, workTypeId]);

  // Firestore購読（新しい順）
  useEffect(() => {
    if (!photosCol) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const q0 = query(photosCol, orderBy("shotAt", "desc"), limit(200));
    const unsub = onSnapshot(
      q0,
      (snap) => {
        const list = snap.docs.map(decodePhotoSnap);
        setPhotos(list);
        setLoading(false);
      },
      (e: unknown) => {
        setPhotos([]);
        setLoading(false);
        window.alert(`読込失敗：${toErrorMessage(e)}`);
      },
    );

    return () => unsub();
  }, [photosCol]);

  // steps購読（order昇順）
  useEffect(() => {
    if (!stepsCol) {
      setSteps([]);
      setStepsLoading(false);
      return;
    }

    setStepsLoading(true);

    const q0 = query(stepsCol, orderBy("order", "asc"), limit(500));
    const unsub = onSnapshot(
      q0,
      (snap) => {
        const list = snap.docs.map(decodeStepSnap);
        setSteps(list);
        setStepsLoading(false);
      },
      (e: unknown) => {
        setSteps([]);
        setStepsLoading(false);
        window.alert(`工程の読込失敗：${toErrorMessage(e)}`);
      },
    );

    return () => unsub();
  }, [stepsCol]);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((v) => {
      const next = !v;
      if (!next) setSelectedIds({});
      return next;
    });
  }, []);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(() => {
      const next: Record<string, boolean> = {};
      for (const p of photos) next[p.id] = true;
      return next;
    });
  }, [photos]);

  const clearSelection = useCallback(() => {
    setSelectedIds({});
  }, []);

  const canDeleteItem = useCallback(
    (p: PhotoDoc) => {
      if (!uid || !myRole) return false;
      if (myRole === "owner") return true;

      const shotUid = p.shotByUid ?? p.userId ?? null;
      return shotUid === uid;
    },
    [uid, myRole],
  );

  const deleteStorageByPath = useCallback(async (paths: string[]) => {
    const storage = getStorage();
    for (const path of paths) {
      try {
        const r = storageRef(storage, path);
        await deleteObject(r);
      } catch {
        // storage 側の失敗は握り（doc削除は止めない）
      }
    }
  }, []);

  const deletePhoto = useCallback(
    async (p: PhotoDoc) => {
      if (!uid) {
        window.alert("削除できません：未ログインです。");
        return;
      }
      if (!myRole) {
        window.alert("削除できません：権限情報の取得中です。");
        return;
      }
      if (!canDeleteItem(p)) {
        window.alert(
          "削除できません：メンバーは自分が撮影した写真のみ削除できます。",
        );
        return;
      }
      if (!dataProjectId || !workTypeId) {
        window.alert("削除できません：参照情報が不足しています。");
        return;
      }

      const ok = window.confirm(
        "この写真を削除します。元に戻せません。続行しますか？",
      );
      if (!ok) return;

      setDeletingIds((prev) => ({ ...prev, [p.id]: true }));

      try {
        const paths: string[] = [];
        if (p.originalPath) paths.push(p.originalPath);
        if (p.renderedPath) paths.push(p.renderedPath);
        if (paths.length) await deleteStorageByPath(paths);

        const photoDocRef =
          base === "root"
            ? doc(
                db,
                "projects",
                dataProjectId,
                "workTypes",
                workTypeId,
                "photos",
                p.id,
              )
            : doc(
                db,
                "users",
                dataOwnerUid ?? uid,
                "projects",
                dataProjectId,
                "workTypes",
                workTypeId,
                "photos",
                p.id,
              );

        await deleteDoc(photoDocRef);
      } catch (e: unknown) {
        window.alert(`削除失敗：${toErrorMessage(e)}`);
      } finally {
        setDeletingIds((prev) => {
          const next = { ...prev };
          delete next[p.id];
          return next;
        });
      }
    },
    [
      uid,
      myRole,
      canDeleteItem,
      dataProjectId,
      dataOwnerUid,
      workTypeId,
      base,
      deleteStorageByPath,
    ],
  );

  const downloadOne = useCallback(
    (p: PhotoDoc) => {
      const url = pickImageUrl(p);
      if (!url) {
        window.alert("保存できません：画像URLが見つかりませんでした。");
        return;
      }
      const name = `${projectName || "project"}_${
        workTypeName || "worktype"
      }_${Date.now()}.jpg`;
      downloadViaApi(url, name);
    },
    [projectName, workTypeName],
  );

  /** ========= steps × photos グルーピング ========= */
  const stepKeyToStep = useMemo(() => {
    const m = new Map<string, StepDoc>();
    for (const s of steps) {
      const k = normKey(s.name);
      if (!k) continue;
      if (!m.has(k)) m.set(k, s);
    }
    return m;
  }, [steps]);

  const orderToStep = useMemo(() => {
    const m = new Map<number, StepDoc>();
    for (const s of steps) {
      m.set(s.order, s);
    }
    return m;
  }, [steps]);

  const stepIdToPhotos = useMemo(() => {
    const m = new Map<string, PhotoDoc[]>();

    for (const p of photos) {
      const memo = normKey(p.kokuban?.memo ?? "");
      let step: StepDoc | null = null;

      if (memo) {
        step = stepKeyToStep.get(memo) ?? null;
      }

      // memo が無い/合わない場合だけ、stepOrder があれば order で紐づける（余計な変更を避けつつ最低限）
      if (!step && typeof p.stepOrder === "number") {
        step = orderToStep.get(p.stepOrder) ?? null;
      }

      if (!step) continue;

      const arr = m.get(step.id) ?? [];
      arr.push(p);
      m.set(step.id, arr);
    }

    return m;
  }, [photos, stepKeyToStep, orderToStep]);

  const groupedBySteps = useMemo(() => {
    return steps.map((s) => ({
      step: s,
      photos: stepIdToPhotos.get(s.id) ?? [],
    }));
  }, [steps, stepIdToPhotos]);

  const unshotSteps = useMemo(() => {
    return groupedBySteps
      .filter((g) => g.photos.length === 0)
      .map((g) => g.step);
  }, [groupedBySteps]);

  const unclassifiedPhotos = useMemo(() => {
    if (steps.length === 0) return photos;

    const stepIds = new Set(steps.map((s) => s.id));
    const matched = new Set<string>();

    for (const [sid, arr] of stepIdToPhotos.entries()) {
      if (!stepIds.has(sid)) continue;
      for (const p of arr) matched.add(p.id);
    }

    return photos.filter((p) => !matched.has(p.id));
  }, [photos, steps, stepIdToPhotos]);

  async function downloadViaApiSequential(remoteUrl: string, filename: string) {
    const api = `/api/download?url=${encodeURIComponent(remoteUrl)}&name=${encodeURIComponent(filename)}`;

    const res = await fetch(api);
    if (!res.ok) throw new Error(`download failed: ${res.status}`);

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // メモリ解放（少し遅らせる）
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
  }

  const bulkDownload = useCallback(async () => {
    if (bulkBusy) return;

    if (!selectMode || selectedCount === 0) {
      window.alert("選択してください：保存する写真を選択してください。");
      return;
    }

    // ✅ 既定工程（steps順）→ 未分類 の順で並べる（「表示順＝工程順」）
    const ordered: Array<{
      p: PhotoDoc;
      kind: "step" | "unclassified";
      stepOrder?: number;
      stepName?: string;
    }> = [];

    // 1) 既定工程（表示順＝steps順）で、選択されている p0 だけ
    for (const g of groupedBySteps) {
      const p0 = g.photos[0] ?? null;
      if (!p0) continue;
      if (!selectedIds[p0.id]) continue;

      ordered.push({
        p: p0,
        kind: "step",
        stepOrder: g.step.order,
        stepName: g.step.name,
      });
    }

    // 2) 未分類（選択されているものだけ）
    for (const p of unclassifiedPhotos) {
      if (!selectedIds[p.id]) continue;
      ordered.push({ p, kind: "unclassified" });
    }

    if (ordered.length === 0) {
      window.alert("選択してください：保存する写真を選択してください。");
      return;
    }

    const ok = window.confirm(
      `選択 ${ordered.length} 件をダウンロードします。\n（既定工程 → 未分類 の順で保存します）\n続行しますか？`,
    );
    if (!ok) return;

    const myRunId = ++bulkRunIdRef.current;

    try {
      setBulkBusy(true);

      const pad3 = (n: number) => String(n).padStart(3, "0");

      // 未分類の連番（未分類は既定工程の後に来ればOKなので別カウント）
      let unclassifiedIndex = 0;

      for (let i = 0; i < ordered.length; i++) {
        if (bulkRunIdRef.current !== myRunId) break;

        const item = ordered[i];
        const p = item.p;

        const url = pickImageUrl(p);
        if (!url) continue;

        setBulkText(`保存中... ${i + 1}/${ordered.length}`);

        // ✅ ファイル名に「工程順」が出るようにする（ここが肝）
        let name = "";
        if (item.kind === "step" && typeof item.stepOrder === "number") {
          // 既定工程：001_工程名_...
          const stepNo = pad3(item.stepOrder);
          const stepName = (item.stepName ?? "").trim() || "step";
          name = `${projectName || "project"}_${workTypeName || "worktype"}_${stepNo}_${stepName}_${Date.now()}.jpg`;
        } else {
          // 未分類：U_001_...
          unclassifiedIndex += 1;
          const uNo = pad3(unclassifiedIndex);
          name = `${projectName || "project"}_${workTypeName || "worktype"}_U_${uNo}_${Date.now()}.jpg`;
        }

        await downloadViaApiSequential(url, name);

        // ブラウザの連続ダウンロード制限対策（少し待つ）
        await new Promise((r) => setTimeout(r, 400));
      }

      setSelectMode(false);
      setSelectedIds({});
      window.alert(
        "完了：ダウンロードを開始しました。ブラウザの設定により保存先は「ダウンロード」になります。",
      );
    } catch (e: unknown) {
      window.alert(`一括保存失敗：${toErrorMessage(e)}`);
    } finally {
      setBulkBusy(false);
      setBulkText("");
    }
  }, [
    bulkBusy,
    selectMode,
    selectedCount,
    groupedBySteps,
    unclassifiedPhotos,
    selectedIds,
    projectName,
    workTypeName,
  ]);

  const buildPdfItems = useCallback(() => {
    const ordered: Array<{
      imageUrl: string;
      projectName: string;
      subtitle: string; // 工種（kokuban.subtitle）
      workTypeName: string; // workTypes/name（クエリの workTypeName）
      location: string; // 場所（kokuban.location）
      memo: string; // 作業内容（kokuban.memo）
    }> = [];

    const useSelected = selectMode && selectedCount > 0;

    // 1) 既定工程（先頭1枚だけ）
    for (const g of groupedBySteps) {
      const p0 = g.photos[0] ?? null;
      if (!p0) continue;
      if (useSelected && !selectedIds[p0.id]) continue;

      const url = pickImageUrl(p0);
      if (!url) continue;

      const k = p0.kokuban ?? null;

      ordered.push({
        imageUrl: url,
        projectName: (k?.projectName ?? projectName ?? "").trim(),
        subtitle: (k?.subtitle ?? "").trim(), // ★ここが工種
        workTypeName: (workTypeName ?? "").trim(), // ★workTypes/name
        location: (k?.location ?? "").trim(),
        memo: (k?.memo ?? "").trim(), // ★作業内容
      });
    }

    // 2) 未分類（全部）
    for (const p of unclassifiedPhotos) {
      if (useSelected && !selectedIds[p.id]) continue;

      const url = pickImageUrl(p);
      if (!url) continue;

      const k = p.kokuban ?? null;

      ordered.push({
        imageUrl: url,
        projectName: (k?.projectName ?? projectName ?? "").trim(),
        subtitle: (k?.subtitle ?? "").trim(), // ★未分類でも memo を入れない
        workTypeName: (workTypeName ?? "").trim(), // ★workTypes/name
        location: (k?.location ?? "").trim(),
        memo: (k?.memo ?? "").trim(),
      });
    }

    return ordered;
  }, [
    groupedBySteps,
    unclassifiedPhotos,
    selectMode,
    selectedCount,
    selectedIds,
    projectName,
    workTypeName,
  ]);

  const downloadPdf = useCallback(async () => {
    if (pdfBusy) return;

    const items = buildPdfItems();
    console.log("PDF items[0]", items[0]);
    if (items.length === 0) {
      window.alert("PDF化できません：対象の写真がありません。");
      return;
    }

    const ok = window.confirm(
      `PDFを作成します（${items.length}ページ）。続行しますか？`,
    );
    if (!ok) return;

    try {
      setPdfBusy(true);

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`PDF生成失敗: ${res.status} ${t}`);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${projectName || "project"}_${workTypeName || "worktype"}_photos.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
    } catch (e: unknown) {
      window.alert(`PDF生成失敗：${toErrorMessage(e)}`);
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, buildPdfItems, projectName, workTypeName]);

  /** ========= 画面のエラー表示（Hook後に分岐するので安全） ========= */
  const missingParams = !projectId || !workTypeId;

  // カード幅（横に並べられるだけ並べて折り返し）
  const cardClass =
    "w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.75rem)] overflow-hidden rounded-2xl border bg-white dark:border-gray-800 dark:bg-gray-900";

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
              工事写真一覧
            </h1>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              工事：{projectName || "（名称未設定）"}
            </div>
            <div className="mt-1 text-sm font-extrabold text-gray-900 dark:text-gray-100">
              工種：{workTypeName || "（工種未設定）"}
              {myRole ? (
                <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  {myRole === "owner" ? "オーナー" : "メンバー"}
                </span>
              ) : null}
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
              href={`/proclink/projects/projectMenu?projectId=${encodeURIComponent(
                projectId,
              )}&${baseQuery}`}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              メニュー
            </Link>

            <button
              type="button"
              onClick={toggleSelectMode}
              disabled={loading || photos.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              {selectMode ? (
                <X className="h-4 w-4" />
              ) : (
                <CheckSquare className="h-4 w-4" />
              )}
              {selectMode ? "解除" : "選択"}
            </button>

            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={
                loading || stepsLoading || photos.length === 0 || pdfBusy
              }
              className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
            >
              {pdfBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {pdfBusy ? "PDF作成中..." : "PDF化"}
            </button>
          </div>
        </div>

        {/* missing */}
        {missingParams && (
          <div className="mt-6 rounded-2xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
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
        )}

        {!missingParams && (
          <>
            {/* select bar */}
            {selectMode && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
                <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                  選択: {selectedCount} 件
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    disabled={bulkBusy || photos.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                  >
                    <CheckSquare className="h-4 w-4" />
                    全選択
                  </button>

                  <button
                    type="button"
                    onClick={clearSelection}
                    disabled={bulkBusy || selectedCount === 0}
                    className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-extrabold text-gray-900 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
                  >
                    <Square className="h-4 w-4" />
                    解除
                  </button>
                </div>
              </div>
            )}

            {/* loading / empty */}
            {loading || stepsLoading ? (
              <div className="mt-6 rounded-2xl border bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  読み込み中...
                </div>
              </div>
            ) : photos.length === 0 ? (
              <div className="mt-10 text-center">
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  写真がまだありません
                </div>
              </div>
            ) : (
              <>
                {/* steps summary（stepsは全体件数のみ） */}
                <div className="mt-6 rounded-2xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                      工程数：{steps.length} 件
                    </div>
                    {canEdit ? (
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                        ※ 工程設定で順番が変わります
                      </div>
                    ) : null}
                  </div>

                  {unshotSteps.length > 0 && (
                    <div className="mt-3 rounded-xl border bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950">
                      <div className="text-xs font-extrabold text-gray-900 dark:text-gray-100">
                        未撮影の工程
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {unshotSteps.map((s) => (
                          <span
                            key={s.id}
                            className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-extrabold text-gray-900 border dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                          >
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* steps groups（step単体に件数は出さない） */}
                <div className="mt-6">
                  <div className="mt-6">
                    <div className="text-xl font-extrabold text-gray-900 mb-4 dark:text-gray-100">
                      既定工程
                    </div>
                  </div>
                  {/* 工程カードを「画面幅に応じて横に並ぶ」グリッドにする */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groupedBySteps.map((g) => {
                      const hasAny = g.photos.length > 0;
                      const len = g.photos.length;
                      const idx = stepSlideIndex[g.step.id] ?? 0;

                      return (
                        <div
                          key={g.step.id}
                          className="overflow-hidden rounded border bg-white dark:border-gray-800 dark:bg-gray-900"
                        >
                          {/* header */}
                          <div className="p-4 border-b dark:border-gray-800">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-extrabold text-gray-900 dark:text-gray-100">
                                  {g.step.name}
                                </div>
                              </div>

                              {!hasAny && (
                                <span className="shrink-0 inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-extrabold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                                  未撮影
                                </span>
                              )}
                            </div>
                          </div>

                          {/* photos (all) */}
                          {/* ✅ photo (single) + arrows */}
                          {hasAny ? (
                            <div className="p-4">
                              {(() => {
                                const safeIdx = Math.min(
                                  Math.max(idx, 0),
                                  len - 1,
                                );
                                const p = g.photos[safeIdx];
                                const url = pickImageUrl(p);

                                const selected = !!selectedIds[p.id];
                                const canDeleteThis = canDeleteItem(p);
                                const deleting = !!deletingIds[p.id];

                                return (
                                  <div className="overflow-hidden rounded-xl border bg-white dark:border-gray-800 dark:bg-gray-950">
                                    {/* thumb */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!selectMode) return;
                                        toggleSelectOne(p.id);
                                      }}
                                      className="relative block w-full bg-black"
                                      style={{ aspectRatio: "4 / 3" }}
                                    >
                                      {url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={url}
                                          alt="photo"
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        <div className="grid h-full w-full place-items-center text-sm font-bold text-white/70">
                                          No Image
                                        </div>
                                      )}

                                      {/* 選択チェック */}
                                      {selectMode && (
                                        <div className="absolute right-3 top-3">
                                          <div
                                            className={[
                                              "grid h-8 w-8 place-items-center rounded-full border-2",
                                              selected
                                                ? "border-white bg-blue-600"
                                                : "border-white/90 bg-black/30",
                                            ].join(" ")}
                                          >
                                            {selected ? (
                                              <CheckSquare className="h-5 w-5 text-white" />
                                            ) : (
                                              <Square className="h-5 w-5 text-white" />
                                            )}
                                          </div>
                                        </div>
                                      )}

                                      {/* ✅ 複数枚のときだけ矢印 */}
                                      {len > 1 && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              slidePrev(g.step.id);
                                            }}
                                            disabled={safeIdx <= 0}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white disabled:opacity-30"
                                          >
                                            ‹
                                          </button>

                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              slideNext(g.step.id, len);
                                            }}
                                            disabled={safeIdx >= len - 1}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-black/40 text-white disabled:opacity-30"
                                          >
                                            ›
                                          </button>

                                          <div className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-1 text-xs font-extrabold text-white">
                                            {safeIdx + 1}/{len}
                                          </div>
                                        </>
                                      )}
                                    </button>

                                    {/* meta + actions */}
                                    <div className="p-3">
                                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                        <div>{p.kokuban?.date ?? ""}</div>
                                        {pickShooterLabel(p) ? (
                                          <div className="mt-0.5">
                                            {pickShooterLabel(p)}
                                          </div>
                                        ) : null}
                                      </div>

                                      <div className="mt-3 flex items-center justify-end gap-2">
                                        <button
                                          type="button"
                                          onClick={() => downloadOne(p)}
                                          disabled={bulkBusy}
                                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                          <Download className="h-4 w-4" />
                                          保存
                                        </button>

                                        {canDeleteThis && (
                                          <button
                                            type="button"
                                            onClick={() => void deletePhoto(p)}
                                            disabled={deleting || bulkBusy}
                                            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                            {deleting ? "削除中" : "削除"}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          ) : (
                            <div
                              className="grid w-full place-items-center bg-black text-sm font-bold text-white/70"
                              style={{ aspectRatio: "4 / 3" }}
                            >
                              未撮影
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 未分類はそのまま（必要なら同じグリッドにできますが、今は余計な変更を避けます） */}
                  {unclassifiedPhotos.length > 0 && (
                    <section className="mt-10">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
                          未分類
                        </div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          {unclassifiedPhotos.length} 件
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4">
                        {unclassifiedPhotos.map((p) => {
                          const url = pickImageUrl(p);
                          const selected2 = !!selectedIds[p.id];
                          const canDeleteThis2 = canDeleteItem(p);
                          const deleting2 = !!deletingIds[p.id];

                          return (
                            <div key={p.id} className={cardClass}>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!selectMode) return;
                                  toggleSelectOne(p.id);
                                }}
                                className="relative block w-full bg-black"
                                style={{ aspectRatio: "4 / 3" }}
                              >
                                {url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={url}
                                    alt="photo"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-sm font-bold text-white/70">
                                    No Image
                                  </div>
                                )}

                                {selectMode && (
                                  <div className="absolute right-3 top-3">
                                    <div
                                      className={[
                                        "grid h-8 w-8 place-items-center rounded-full border-2",
                                        selected2
                                          ? "border-white bg-blue-600"
                                          : "border-white/90 bg-black/30",
                                      ].join(" ")}
                                    >
                                      {selected2 ? (
                                        <CheckSquare className="h-5 w-5 text-white" />
                                      ) : (
                                        <Square className="h-5 w-5 text-white" />
                                      )}
                                    </div>
                                  </div>
                                )}
                              </button>

                              <div className="p-4">
                                <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                                  {p.kokuban?.memo?.trim()
                                    ? p.kokuban.memo
                                    : p.stepOrder != null
                                      ? `工程 ${p.stepOrder}`
                                      : "—"}
                                </div>
                                <div className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                  <div>{p.kokuban?.date ?? ""}</div>
                                  {pickShooterLabel(p) ? (
                                    <div className="mt-0.5">
                                      {pickShooterLabel(p)}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="mt-4 flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => downloadOne(p)}
                                    disabled={bulkBusy}
                                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
                                  >
                                    <Download className="h-4 w-4" />
                                    保存
                                  </button>

                                  {canDeleteThis2 && (
                                    <button
                                      type="button"
                                      onClick={() => void deletePhoto(p)}
                                      disabled={deleting2 || bulkBusy}
                                      className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-3 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      {deleting2 ? "削除中" : "削除"}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}
                </div>
              </>
            )}

            {/* bottom bulk bar */}
            {selectMode && (
              <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
                <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => void bulkDownload()}
                    disabled={bulkBusy || selectedCount === 0}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Download className="h-5 w-5" />
                    一括保存
                  </button>
                </div>
              </div>
            )}

            {/* overlay */}
            {bulkBusy && (
              <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4">
                <div className="w-full max-w-md rounded-2xl border bg-white p-5 text-center dark:border-gray-800 dark:bg-gray-900">
                  <div className="text-sm font-extrabold text-gray-900 dark:text-gray-100">
                    {bulkText || "処理中..."}
                  </div>
                  <div className="mt-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                    ※ ブラウザの仕様で連続ダウンロード許可が必要な場合があります
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
