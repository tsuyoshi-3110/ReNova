export type LaundryStatus = "ok" | "limited" | "ng";

export type LaundryFloorDef = {
  floor: number; // 1,2,3...
  roomsCount: number; // その階の部屋数
  startNo?: number; // 表示ラベルの開始番号（任意）
};

export type LaundryBoardConfig = {
  version: 1;
  floors: LaundryFloorDef[];
  updatedAt: number;
};

export type LaundryStatusDoc = {
  version: 1;
  dateKey: string; // YYYY-MM-DD
  map: Record<string, LaundryStatus>;
  updatedAt: number;
};
