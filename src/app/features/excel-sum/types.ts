export type ExcelSumPreviewRow = {
  rowIndex: number;
  item?: string;
  desc?: string;
  qty?: number;
  unit?: string;
  amount?: number;

  calcM2?: number;

  heightMm?: number;
  overlapMm?: number;
  wideMm?: number;
  lengthMm?: number;
  suggestedInput?: number;
};

export type ExcelSumOk = {
  ok: true;
  query: string;
  matchedCount: number;
  sumsByUnit: Record<string, number>;
  sumM2: number;
  preview: ExcelSumPreviewRow[];

  detectedCols?: {
    item: number;
    desc: number;
    qty: number;
    unit: number;
    amount: number | null;
    headerRowIndex: number | null;
    usedManualCols: boolean;
  };
};

export type ExcelCodesOk = {
  ok: true;
  sheetName: string;
  codes: string[];
};

export type ExcelSheetsOk = {
  ok: true;
  sheetNames: string[];
};

export type SavedExcelSum = {
  id: string; // unique
  savedAt: string; // ISO
  fileName?: string;

  keyword1: string;
  keyword2: string;

  sumM2: number; // ㎡換算 合計（表示中の合計）
  matchedCount: number;

  query: string; // 実際に投げたquery（① or ②）
};

export type DetectColsResponse = {
  ok: true;
  sheetName: string;
  headerRowIndex: number | null;
  detectedCols: {
    item: number; // 1-based
    desc: number; // 1-based
    qty: number; // 1-based
    unit: number; // 1-based
    amount: number | null; // 1-based or null
    size: number; // 1-based
  };
};
