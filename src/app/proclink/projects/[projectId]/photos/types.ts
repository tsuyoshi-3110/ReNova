// src/app/proclink/projects/[projectId]/photos/types.ts

export type Role = "owner" | "member";

export type PhotoDoc = {
  id: string;

  projectId?: string;

  // ✅ カメラ側は shotByUid を保存している前提
  shotByUid?: string | null;

  // 旧互換（入っていれば使う）
  userId?: string | null;

  originalUrl?: string | null;
  renderedUrl?: string | null;

  originalPath?: string | null;
  renderedPath?: string | null;

  shotAt?: unknown;
  createdAt?: unknown;

  width?: number;
  height?: number;

  kokuban?: {
    projectName?: string;
    location?: string;
    date?: string;
    memo?: string;
  };

  workTypeId?: string | null;
  workTypeName?: string | null;

  stepOrder?: number | null;
};
