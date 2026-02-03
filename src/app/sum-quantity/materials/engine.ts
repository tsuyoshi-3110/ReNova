// /src/app/sum-quantity/materials/engine.ts

export type AreaKey = string;

export type AreaField<K extends AreaKey = AreaKey> = {
  key: K;
  label: string;
  required?: boolean;
};

export type LiquidKgMaterial<K extends AreaKey = AreaKey> = {
  kind: "liquidKg";
  name: string;
  areaKey: K;
  kgPerM2: number;
  packKg?: number;
  unitLabel?: string;
  // 表示用（任意）
  specText?: string;
};

export type SheetRollMaterial<K extends AreaKey = AreaKey> = {
  kind: "sheetRoll";
  name: string;
  areaKey: K;

  // 計算用（必須）
  sheetWidthM: number;
  sheetLengthM: number;

  rollLabel?: string;

  // 表示用（任意）
  specText?: string;
};

export type JointTapeRollMaterial<K extends AreaKey = AreaKey> = {
  kind: "jointTapeRoll";
  name: string;
  areaKey: K;

  // 計算用（必須）
  sheetWidthM: number;
  tapeLengthM: number;

  rollLabel?: string;

  // ロス率（任意）
  wasteRate?: number;

  // 表示用（任意）
  // 例：100(=100mm幅) を入れると「50m×100mm」表示できる
  tapeWidthMm?: number;

  // 表示用（任意）
  specText?: string;
};

export type MaterialDef<K extends AreaKey = AreaKey> =
  | LiquidKgMaterial<K>
  | SheetRollMaterial<K>
  | JointTapeRollMaterial<K>;

export type SpecDef<K extends AreaKey = AreaKey> = {
  id: string;
  maker: string;
  displayName: string;
  areaFields: Array<AreaField<K>>;
  materials: Array<MaterialDef<K>>;
};

export type AreaInput<K extends AreaKey = AreaKey> = Partial<Record<K, number>>;

export type LiquidKgRow<K extends AreaKey = AreaKey> = {
  kind: "liquidKg";
  name: string;
  areaKey: K;
  requiredKg: number;
};

export type SheetRollRow<K extends AreaKey = AreaKey> = {
  kind: "sheetRoll";
  name: string;
  areaKey: K;
  rolls: number;
  rollLabel: string;
  sheetWidthM: number;
  sheetLengthM: number;
};

export type JointTapeRollRow<K extends AreaKey = AreaKey> = {
  kind: "jointTapeRoll";
  name: string;
  areaKey: K;
  rolls: number;
  rollLabel: string;
  jointLenM: number;
  tapeLengthM: number;
  sheetWidthM: number;
  wasteRate: number;
};

export type CalcRow<K extends AreaKey = AreaKey> =
  | LiquidKgRow<K>
  | SheetRollRow<K>
  | JointTapeRollRow<K>;

function toFiniteNumber(v: unknown): number {
  if (typeof v !== "number") return 0;
  return Number.isFinite(v) ? v : 0;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * ✅ 共通の計算式
 * - liquidKg: requiredKg = area * kgPerM2
 * - sheetRoll: rolls = area / (sheetWidthM * sheetLengthM)
 * - jointTapeRoll:
 *    jointLenM = (area / sheetWidthM) * (1 + wasteRate)
 *    rolls = jointLenM / tapeLengthM
 */
export function calcSpec<K extends AreaKey>(
  spec: SpecDef<K>,
  areas: AreaInput<K>,
): Array<CalcRow<K>> {
  const rows: Array<CalcRow<K>> = [];

  for (const m of spec.materials) {
    const area = toFiniteNumber(areas[m.areaKey]);

    if (m.kind === "liquidKg") {
      const kg = round1(area * m.kgPerM2);
      rows.push({
        kind: "liquidKg",
        name: m.name,
        areaKey: m.areaKey,
        requiredKg: kg,
      });
      continue;
    }

    if (m.kind === "sheetRoll") {
      const width = m.sheetWidthM;
      const length = m.sheetLengthM;

      const denom = width * length;
      const rolls = denom > 0 ? area / denom : 0;

      rows.push({
        kind: "sheetRoll",
        name: m.name,
        areaKey: m.areaKey,
        rolls,
        rollLabel: m.rollLabel ?? "巻",
        sheetWidthM: width,
        sheetLengthM: length,
      });
      continue;
    }

    // jointTapeRoll
    const w = m.sheetWidthM;
    const wasteRate = typeof m.wasteRate === "number" ? m.wasteRate : 0;

    const jointLenM = w > 0 ? (area / w) * (1 + wasteRate) : 0;
    const tapeLengthM = m.tapeLengthM;
    const rolls = tapeLengthM > 0 ? jointLenM / tapeLengthM : 0;

    rows.push({
      kind: "jointTapeRoll",
      name: m.name,
      areaKey: m.areaKey,
      rolls,
      rollLabel: m.rollLabel ?? "巻",
      jointLenM: round1(jointLenM),
      tapeLengthM,
      sheetWidthM: w,
      wasteRate,
    });
  }

  return rows;
}
