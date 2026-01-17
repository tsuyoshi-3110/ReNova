// src/features/schedule/types.ts
export type Unit = "㎡" | "m" | "days";
export type InputMode = "calc" | "days";

export type WorkItem = {
  name: string;
  unit: Unit;
  mode: InputMode;
  defaultWorkers?: number;
  defaultProductivity?: number;
  defaultQty?: number;
  color: string;
};

export type Scheduled = {
  section?: number;
  groupTitle: string;
  label: string;
  startDate: Date;
  endDate: Date;
  startKey: string;
  endKey: string;
  offset: number;
  duration: number;
  color: string;
};

export type SchedMemo = {
  schedule: Scheduled[];
  workingDays: Date[];
  minStartAll: Date | null;
  maxEndAll: Date | null;
  prepStart: Date | null;
  prepEndWorkNext: Date | null;
  cleanupStart: Date | null;
  cleanupEnd: Date | null;
};

export type CustomSection = {
  id: string;
  /** カスタム工区名（必ず title を使う） */
  title: string;
  items: WorkItem[];
  /** 将来拡張用オプション */
  parallelSealAndRepair?: boolean;
};
