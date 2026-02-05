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
  packKgOptions?: number[];
  unitLabel?: string;
  specText?: string;
};

export type SheetRollMaterial<K extends AreaKey = AreaKey> = {
  kind: "sheetRoll";
  name: string;
  areaKey: K;
  sheetWidthM: number;
  sheetLengthM: number;
  sheetLengthMOptions?: number[];
  rollLabel?: string;
  specText?: string;
};

export type JointTapeRollMaterial<K extends AreaKey = AreaKey> = {
  kind: "jointTapeRoll";
  name: string;
  areaKey: K;

  // 計算用（必須）
  sheetWidthM: number;
  tapeLengthM: number;
  tapeLengthMOptions?: number[];
  rollLabel?: string;

  // ロス率（任意）
  wasteRate?: number;

  // ✅ 特殊：面積換算（例：スリットテープ 1巻=200㎡など）
  coverM2PerRoll?: number;

  // 表示用（任意）
  // 例：100(=100mm幅) を入れると「50m×100mm」表示できる
  tapeWidthMm?: number;

  // 表示用（任意）
  specText?: string;
};

// ✅ 外周（端末処理）テープ：面積ではなく「外周(m)」を入力して計算する
export type EndTapeMaterial<K extends AreaKey = AreaKey> = {
  kind: "endTape";
  name: string;
  areaKey: K;

  // 1巻あたりの長さ（m）
  tapeLengthM: number;
  tapeLengthMOptions?: number[];
  rollLabel?: string;

  // ロス率（任意）
  wasteRate?: number;

  // 表示用（任意）
  tapeWidthMm?: number;
  specText?: string;
};

export type MaterialDef<K extends AreaKey = AreaKey> =
  | LiquidKgMaterial<K>
  | SheetRollMaterial<K>
  | JointTapeRollMaterial<K>
  | EndTapeMaterial<K>;

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

  // ✅ 表示/デバッグ用（任意）：面積換算の基準
  coverM2PerRoll?: number;
};

export type EndTapeRow<K extends AreaKey = AreaKey> = {
  kind: "endTape";
  name: string;
  areaKey: K;
  rolls: number;
  rollLabel: string;
  perimeterM: number;
  tapeLengthM: number;
  wasteRate: number;

  // 表示/デバッグ用（任意）
  tapeWidthMm?: number;
};

export type CalcRow<K extends AreaKey = AreaKey> =
  | LiquidKgRow<K>
  | SheetRollRow<K>
  | JointTapeRollRow<K>
  | EndTapeRow<K>;

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
 * - endTape: rolls = perimeter(m) * (1 + wasteRate) / tapeLengthM
 * - jointTapeRoll:
 *    - 通常：jointLenM = (area / sheetWidthM) * (1 + wasteRate), rolls = jointLenM / tapeLengthM
 *    - 特殊（coverM2PerRoll 指定時）：rolls = area * (1 + wasteRate) / coverM2PerRoll（jointLenM は 0 扱い）
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

    if (m.kind === "endTape") {
      const wasteRate = typeof m.wasteRate === "number" ? m.wasteRate : 0;
      const perimeterM = area; // areaKey で受け取った値は外周(m)として扱う
      const tapeLengthM = m.tapeLengthM;

      const rolls =
        tapeLengthM > 0 ? (perimeterM * (1 + wasteRate)) / tapeLengthM : 0;

      rows.push({
        kind: "endTape",
        name: m.name,
        areaKey: m.areaKey,
        rolls,
        rollLabel: m.rollLabel ?? "巻",
        perimeterM: round1(perimeterM),
        tapeLengthM,
        wasteRate,
        tapeWidthMm: m.tapeWidthMm,
      });
      continue;
    }

    // jointTapeRoll
    const w = m.sheetWidthM;
    const wasteRate = typeof m.wasteRate === "number" ? m.wasteRate : 0;
    const tapeLengthM = m.tapeLengthM;

    // ✅ 特殊：面積換算（例：スリットテープ 1巻=200㎡）
    if (typeof m.coverM2PerRoll === "number" && m.coverM2PerRoll > 0) {
      const areaWithWaste = area * (1 + wasteRate);
      const rolls = areaWithWaste / m.coverM2PerRoll;

      rows.push({
        kind: "jointTapeRoll",
        name: m.name,
        areaKey: m.areaKey,
        rolls,
        rollLabel: m.rollLabel ?? "巻",
        jointLenM: 0,
        tapeLengthM,
        sheetWidthM: w,
        wasteRate,
        coverM2PerRoll: m.coverM2PerRoll,
      });
      continue;
    }

    // 通常：ジョイント長ベース
    const jointLenM = w > 0 ? (area / w) * (1 + wasteRate) : 0;
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
