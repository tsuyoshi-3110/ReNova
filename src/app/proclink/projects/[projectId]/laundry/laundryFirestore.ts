"use client";

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Firestore,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebaseClient";
import type { LaundryBoardConfig, LaundryStatus, LaundryStatusDoc } from "./types";

function assertNonEmpty(name: string, v: string): void {
  if (!v || typeof v !== "string") {
    throw new Error(`${name} is required`);
  }
}

function configRef(db0: Firestore, projectId: string) {
  assertNonEmpty("projectId", projectId);
  return doc(db0, "projects", projectId, "laundry", "config");
}

function statusRef(db0: Firestore, projectId: string, dateKey: string) {
  assertNonEmpty("projectId", projectId);
  assertNonEmpty("dateKey", dateKey);
  return doc(db0, "projects", projectId, "laundryStatus", dateKey);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sanitizeStatusMap(raw: unknown): Record<string, LaundryStatus> {
  if (!isPlainObject(raw)) return {};

  const out: Record<string, LaundryStatus> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === "ok" || v === "limited" || v === "ng") {
      out[k] = v;
    }
  }
  return out;
}

/** 設定（階・部屋数）取得 */
export async function getLaundryConfigByProject(
  projectId: string,
): Promise<LaundryBoardConfig | null> {
  const snap = await getDoc(configRef(db, projectId));
  if (!snap.exists()) return null;

  const raw = snap.data() as unknown;
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Partial<LaundryBoardConfig>;
  if (data.version !== 1 || !Array.isArray(data.floors)) return null;

  return {
    version: 1,
    floors: data.floors,
    updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
  };
}

/** 設定（階・部屋数）保存 */
export async function setLaundryConfigByProject(
  projectId: string,
  config: LaundryBoardConfig,
): Promise<void> {
  await setDoc(configRef(db, projectId), config, { merge: true });
}

export type LaundryStatusSubscribeResult = {
  /** その日付ドキュメントが存在するか（= 保存済みか） */
  exists: boolean;
  /** status map（存在しない場合は {}） */
  map: Record<string, LaundryStatus>;
  /** 参考：整形後のドキュメント（必要なら） */
  doc?: LaundryStatusDoc;
};

/** 日付別の status map を購読（exists も返す） */
export function subscribeLaundryStatusMapByProject(
  projectId: string,
  dateKey: string,
  onChange: (res: LaundryStatusSubscribeResult) => void,
): Unsubscribe {
  const ref = statusRef(db, projectId, dateKey);

  return onSnapshot(
    ref,
    (snap) => {
      // 未保存（ドキュメントなし）
      if (!snap.exists()) {
        onChange({ exists: false, map: {} });
        return;
      }

      const raw = snap.data() as DocumentData | undefined;
      if (!raw || typeof raw !== "object") {
        onChange({ exists: true, map: {} });
        return;
      }

      const data = raw as Partial<LaundryStatusDoc>;

      const map = sanitizeStatusMap(data.map);
      const docData: LaundryStatusDoc = {
        version: 1,
        dateKey: typeof data.dateKey === "string" ? data.dateKey : dateKey,
        map,
        updatedAt: typeof data.updatedAt === "number" ? data.updatedAt : Date.now(),
      };

      onChange({ exists: true, map, doc: docData });
    },
    () => {
      // エラー時は「未取得扱い」で空
      onChange({ exists: false, map: {} });
    },
  );
}

/** 日付別の status map を保存（ここで “日付も保存”） */
export async function setLaundryStatusMapByProject(
  projectId: string,
  dateKey: string,
  map: Record<string, LaundryStatus>,
): Promise<void> {
  const docData: LaundryStatusDoc = {
    version: 1,
    dateKey,
    map,
    updatedAt: Date.now(),
  };

  await setDoc(statusRef(db, projectId, dateKey), docData, { merge: true });
}
