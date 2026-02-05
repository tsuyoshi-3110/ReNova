// src/app/sum-quantity/materials/specs/agcSpec.ts
import type { SpecDef } from "../engine";

/**
 * AGC（サラセーヌ）仕様
 *
 * 方針：
 * - Tajima と同じ構造（SpecDef[] + getAgcSpec + sections）
 * - 平場/立上りは「別セクション」にせず、ID末尾に「(立上り)」などを付けて区別
 *   （※今回作るのは平場だけなので suffix なし）
 *
 * 荷姿（packKg）は添付資料の「材料一覧 / 消防法関係」を参照して設定
 */

const AGC_SPECS_TOUGHGUY: SpecDef[] = [
  {
    // 平場：タフガイSD-AZEZ25TJ(TJフッ素)
    // ※立上り版を追加する時は例： "SD-AZEZ20TJ(立上り)" のように suffix を付ける
    id: "SD-AZEZ25TJ",
    maker: "agc",
    displayName: "タフガイSD-AZEZ25TJ（TJフッ素）【平場】",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① PJプライマー 0.2kg/㎡（1成分 16kg缶）
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌEZ 1.7kg/㎡（2成分：主剤16kg + 硬化剤8kg）
      // ※主剤は他荷姿もあるが、数量計算の packKg は「1セット」を固定で置く
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 1.7,
        packKg: 24, // 16 + 8,
        packKgOptions: [16, 20, 24],
        unitLabel: "セット",
      },

      // ③ サラセーヌAZ 1.5kg/㎡（2成分：主剤8kg + 硬化剤8kg）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 1.5,
        packKg: 16, // 8 + 8
        unitLabel: "セット",
      },

      // ④ TJトップ（TJフッ素）
      // 表の使用量は「0.2kg（0.15kg）」表記なので、最大値の 0.2 を採用
      // 荷姿：主剤6kg + 硬化剤9kg
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15, // 6 + 9
        unitLabel: "セット",
      },
    ],
  },
  {
    // 平場：タフガイSD-AZEZ30TJ（TJフッ素）
    id: "SD-AZEZ30TJ",
    maker: "agc",
    displayName: "タフガイSD-AZEZ30TJ（TJフッ素）【平場】",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌEZ（2.0kg/㎡）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 2.0,
        packKg: 24, // 主剤16 + 硬化剤8
        packKgOptions: [16, 20, 24],
        unitLabel: "セット",
      },

      // ③ サラセーヌAZ（1.8kg/㎡）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 1.8,
        packKg: 16, // 主剤8 + 硬化剤8
        unitLabel: "セット",
      },

      // ④ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2, // 最大値採用
        packKg: 15, // 主剤6 + 硬化剤9
        unitLabel: "セット",
      },
    ],
  },
  {
    // 立上り：タフガイSD-AZEZ20TJ（TJフッ素）
    id: "SD-AZEZ20TJ(立上り)",
    maker: "agc",
    displayName: "タフガイSD-AZEZ20TJ（TJフッ素）【立上り】",
    areaFields: [
      { key: "upstand", label: "立上り・笠木・架台(㎡)", required: true },
    ],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌEZ 立上り用（1.3kg/㎡）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用",
        areaKey: "upstand",
        kgPerM2: 1.3,
        packKg: 24, // 主剤16 + 硬化剤8
        unitLabel: "セット",
      },

      // ③ サラセーヌAZ 立上り用（1.2kg/㎡）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 1.2,
        packKg: 16, // 主剤8 + 硬化剤8
        unitLabel: "セット",
      },

      // ④ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2, // 最大値採用
        packKg: 15, // 主剤6 + 硬化剤9
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "NK-AZ20TJ（平場）",
    maker: "agc",
    displayName: "タフガイNK-AZ20TJ（TJフッ素）【平場】",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "flat",
        kgPerM2: 0.1,
        packKg: 5,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ 1.2kg
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 2.4,
        packKg: 16,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "NK-AZ20TJ（立上り）",
    maker: "agc",
    displayName: "タフガイNK-AZ20TJ（TJフッ素）【立上り】",
    areaFields: [
      { key: "upstand", label: "立上り・笠木・架台(㎡)", required: true },
    ],
    materials: [
      // ① PJ層間プライマー
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 5,
        unitLabel: "缶",
      },

      // ②③ サラセーヌAZ立上り用（1.2 + 1.2 = 2.4kg/㎡）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 2.4,
        packKg: 16,
        unitLabel: "セット",
      },

      // ④ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },

  {
    id: "NK-AZ16TJ（平場）",
    maker: "agc",
    displayName: "タフガイNK-AZ16TJ（TJフッ素）【平場】",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① PJ層間プライマー
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "flat",
        kgPerM2: 0.1,
        packKg: 5,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 2.0,
        packKg: 16,
        unitLabel: "セット",
      },

      // ③ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "NK-AZ16TJ（立上り）",
    maker: "agc",
    displayName: "タフガイNK-AZ16TJ（TJフッ素）【立上り】",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJ層間プライマー
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 5,
        unitLabel: "缶",
      },

      // ②③ サラセーヌAZ立上り用（1.0 + 1.0 = 2.0）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ立上り用",
        areaKey: "upstand",
        kgPerM2: 2.0,
        packKg: 16,
        unitLabel: "セット",
      },

      // ④ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "タフガイ AV-AZEZ45TJ（平場）",
    maker: "agc",
    displayName: "タフガイ AV-AZEZ45TJ（TJフッ素）【平場】",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① サラセーヌRWボンド
      {
        kind: "liquidKg",
        name: "サラセーヌRWボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 15,
        unitLabel: "缶",
      },

      // ② AVシートブルー／スリットテープ
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
      },

      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ③ サラセーヌEZ目止め
      {
        kind: "liquidKg",
        name: "サラセーヌEZ目止め",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 24,
        unitLabel: "缶",
      },

      // ④ サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 2.0,
        packKg: 20,
        unitLabel: "セット",
      },

      // ⑤ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "SD-AZEZ20TJ（立上り）",
    maker: "agc",
    displayName: "タフガイSD-AZEZ立上り20TJ（TJフッ素）【立上り】",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌEZ立上り用
      {
        kind: "liquidKg",
        name: "サラセーヌEZ立上り用",
        areaKey: "upstand",
        kgPerM2: 1.3,
        packKg: 20,
        unitLabel: "缶",
      },

      // ③ サラセーヌAZ立上り用
      {
        kind: "liquidKg",
        name: "サラセーヌAZ立上り用",
        areaKey: "upstand",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "セット",
      },

      // ④ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "QV-AZEZ45TJ（平場）",
    maker: "agc",
    displayName: "タフガイQV-AZEZ45TJ（TJフッ素）【平場】",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "perimeter", label: "外周(m)", required: true },
    ],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② QVシート（下張り）
      {
        kind: "sheetRoll",
        name: "QVシート",
        areaKey: "flat",
        sheetWidthM: 1.06,
        sheetLengthM: 15,
        rollLabel: "巻",
      },

      {
        kind: "jointTapeRoll",
        name: "ジョイントテープ",
        areaKey: "flat",
        sheetWidthM: 1.06,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.0,
        tapeWidthMm: 100,
      },

      // ② ジョイント・MBテープ
      // MBテープ100（外周貼り：外周(m) ÷ 20m/巻）
      {
        kind: "endTape",
        name: "MBテープ100",
        areaKey: "perimeter",
        tapeLengthM: 20,
        rollLabel: "巻",
        specText: "外周(m) ÷ 20m/巻",
      },

      // ③ サラセーヌEZ
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 1.3,
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
      },

      // ④ サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "セット",
      },

      // ⑤ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：TJフッ素 0.15kg/㎡）",
      },
    ],
  },
  {
    id: "QV-AZ45TJ（平場）",
    maker: "agc",
    displayName: "タフガイQV-AZ45TJ（TJフッ素）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "perimeter", label: "外周(m)", required: true },
    ],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② QVシート
      {
        kind: "sheetRoll",
        name: "QVシート",
        areaKey: "flat",
        sheetWidthM: 1.06,
        sheetLengthM: 15,
        rollLabel: "巻",
      },

      // ② ジョイント・MBテープ
      {
        kind: "jointTapeRoll",
        name: "ジョイントテープ",
        areaKey: "flat",
        sheetWidthM: 1.06,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.0,
        tapeWidthMm: 100,
      },

      // ② EZ立上り用（下処理兼用）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 0.0, // 面積比例しないため0扱い
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
        specText: "QVシート処理・立上り兼用",
      },

      // ③ サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 2.4,
        packKg: 20,
        unitLabel: "セット",
        specText: "※勾配等により分割施工あり",
      },

      // ④ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
  {
    id: "SD-AZEZ-20TJ（立上り）",
    maker: "agc",
    displayName: "タフガイSD-AZEZ立上り20TJ（TJフッ素）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌEZ（立上り用）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 1.3,
        packKg: 24,
        unitLabel: "セット",
        specText: "★AZ立上り用に変更可",
      },

      // ③ サラセーヌAZ（立上り用）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "セット",
      },

      // ④ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
  {
    id: "SD-AZ-15TJ（平場）",
    maker: "agc",
    displayName: "タフガイSD-AZ15TJ（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 1.8,
        packKg: 20,
        unitLabel: "セット",
        specText: "※注：勾配等で膜厚確保できない場合は数回に分けて塗布",
      },

      // ③ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
  {
    id: "SD-AZ-15TJ（立上り）",
    maker: "agc",
    displayName: "タフガイSD-AZ立上り15TJ（TJフッ素）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ（立上り用）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 1.8,
        packKg: 20,
        unitLabel: "セット",
        specText: "※注：勾配等で膜厚確保できない場合は数回に分けて塗布",
      },

      // ③ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
  {
    id: "NK-AZ-13TJ（平場）",
    maker: "agc",
    displayName: "タフガイNK-AZ13TJ（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① PJ層間プライマー
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "flat",
        kgPerM2: 0.1,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ
      {
        kind: "liquidKg",
        name: "サラセーヌAZ",
        areaKey: "flat",
        kgPerM2: 1.6,
        packKg: 20,
        unitLabel: "セット",
        specText: "※注：勾配等で膜厚確保できない場合は数回に分けて塗布",
      },

      // ③ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
  {
    id: "NK-AZ-13TJ（立上り）",
    maker: "agc",
    displayName: "タフガイNK-AZ立上り13TJ（TJフッ素）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJ層間プライマー
      {
        kind: "liquidKg",
        name: "PJ層間プライマー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② サラセーヌAZ（立上り用）
      {
        kind: "liquidKg",
        name: "サラセーヌAZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 1.6,
        packKg: 20,
        unitLabel: "セット",
        specText: "※注：勾配等で膜厚確保できない場合は数回に分けて塗布",
      },

      // ③ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（参考：0.15kg/㎡）",
      },
    ],
  },
];

// =========================
// サラセーヌ（タフガイ以外）
// =========================

const AGC_SPECS_SARACENU: SpecDef[] = [
  {
    id: "AV-EZ50TJ",
    maker: "agc",
    displayName: "サラセーヌ AV-EZ50TJ（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① サラセーヌRWボンド 0.25kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌRWボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 15,
        unitLabel: "缶",
      },

      // AVシートブルー または AVシート（数量は表記なし）
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
        specText: "※使用量表記なし（現場条件により調整）",
      },

      // スリットテープ（数量表記なし）
      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ② サラセーヌEZ目止め 1.2kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌEZ目止め",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 24,
        unitLabel: "缶",
      },

      // ③④ サラセーヌEZ 1.2 + 1.2 = 2.4kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 2.4,
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
        specText: "1.2kg/㎡ × 2回塗り",
      },

      // ⑤ TJトップ（TJフッ素）0.2（0.15）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2, // 最大値採用
        packKg: 15, // 6kg + 9kg
        unitLabel: "セット",
        specText: "（0.15kg/㎡表記あり・最大値採用）",
      },
    ],
  },
  {
    id: "AV-EZ70TJ",
    maker: "agc",
    displayName: "サラセーヌ AV-EZ70TJ（TJフッ素／ハイグレード）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],
    materials: [
      // ① サラセーヌRWボンド 0.25kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌRWボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 15,
        unitLabel: "缶",
      },

      // AVシートブルー または AVシート（数量表記なし）
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
        specText: "※使用量表記なし（現場条件により調整）",
      },

      // スリットテープ（数量表記なし）
      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ② サラセーヌEZ目止め 1.2kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌEZ目止め",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 24,
        unitLabel: "缶",
      },

      // サラセーヌEZ 4.9kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 4.9,
        packKg: 20,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
      },

      // ⑤ TJトップ（TJフッ素）0.2（0.15）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2, // 最大値採用
        packKg: 15, // 6kg + 9kg
        unitLabel: "セット",
        specText: "（0.15kg/㎡表記あり・最大値採用）",
      },
    ],
  },
  {
    id: "SD-EZ立上り20TJ3",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ立上り20TJ（TJフッ素）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // ① PJプライマー 0.2kg/㎡
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 補強用クロス（数量表記なし）
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "upstand",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※数量表記なし（必要箇所のみ使用）",
      },

      // ④ サラセーヌEZ立上り用 0.7kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
      },

      // ⑤ TJトップ（TJフッ素）0.2（0.15）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2, // 最大値採用
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.15kg/㎡表記あり・最大値採用）",
      },
    ],
  },
  {
    id: "AV-KK50T（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ AV-KK50T（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① サラセーヌAVボンド 0.25kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAVボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 16,
        unitLabel: "缶",
      },

      // AVシートブルー または AVシート（数量比例なし）
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
        specText: "※使用量は表記なし（必要数量手配）",
      },

      // スリットテープ（数量比例なし）
      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ② サラセーヌAV-W 1.2kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAV-W",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "缶",
      },

      // ③④ サラセーヌK 1.3 + 1.2 = 2.5kg/㎡（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 2.5,
        packKg: 16,
        unitLabel: "缶",
        specText: "（1.3kg/㎡＋1.2kg/㎡）",
      },

      // ⑤ サラセーヌT / TJフッ素 0.2（0.15）→ 最大値採用
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "AV-K50T（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ AV-K50T（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① サラセーヌAVボンド 0.25kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAVボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 16,
        unitLabel: "缶",
      },

      // AVシートブルー / スリットテープ（数量比例なし）
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
        specText: "※使用量表記なし（必要数量手配）",
      },
      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ② サラセーヌAV-W 1.2kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAV-W",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "缶",
      },

      // ③ サラセーヌK 2.5kg/㎡（合算済み）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 2.5,
        packKg: 16,
        unitLabel: "缶",
      },

      // ④ サラセーヌT / TJフッ素
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "AV-KK70T（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ AV-KK70T（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① サラセーヌAVボンド 0.25kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAVボンド",
        areaKey: "flat",
        kgPerM2: 0.25,
        packKg: 16,
        unitLabel: "缶",
      },

      // AVシートブルー / AVシート / スリットテープ（数量比例なし）
      {
        kind: "sheetRoll",
        name: "サラセーヌAVシートブルー",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 40,
        rollLabel: "巻",
        specText: "※使用量表記なし（必要数量手配）",
      },
      {
        kind: "jointTapeRoll",
        name: "スリットテープ",
        areaKey: "flat",
        sheetWidthM: 0.05,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 100,
        coverM2PerRoll: 200, // ✅ 追加：1巻で200㎡カバー
        specText: "※1巻=200㎡換算（特殊）",
      },

      // ② サラセーヌAV-W 1.2kg/㎡
      {
        kind: "liquidKg",
        name: "サラセーヌAV-W",
        areaKey: "flat",
        kgPerM2: 1.2,
        packKg: 20,
        unitLabel: "缶",
      },

      // ③④ サラセーヌK 2.5 + 2.5 = 5.0kg/㎡（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 5.0,
        packKg: 16,
        unitLabel: "缶",
        specText: "（2.5kg/㎡×2回）",
      },

      // ⑤ サラセーヌT / TJフッ素
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },

  {
    id: "QV-EZ50TJ（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ QV-EZ50TJ（TJフッ素）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "perimeter", label: "外周(m)", required: true },
    ],

    materials: [
      // ① PJプライマー 0.2kg/㎡
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② QVシート 1.06m/㎡
      {
        kind: "sheetRoll",
        name: "QVシート",
        areaKey: "flat",
        sheetWidthM: 1.06,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "（1.06m/㎡）",
      },

      // ジョイントテープ / EZ立上り用
      {
        kind: "sheetRoll",
        name: "ジョイントテープ",
        areaKey: "flat",
        sheetWidthM: 1.06,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "（1.06m/㎡相当）",
      },

      // MBテープ100（数量比例なし）
      {
        kind: "endTape",
        name: "MBテープ100",
        areaKey: "perimeter",
        tapeLengthM: 20,
        rollLabel: "巻",
        specText: "外周(m) ÷ 20m/巻",
      },

      // ③④ サラセーヌEZ（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 3.3,
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
        specText: "（1.7＋1.6kg/㎡）",
      },

      // ⑤ TJトップ / TJフッ素
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-EZ立上り20TJ（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ立上り20TJ（TJフッ素）",
    areaFields: [
      { key: "upstand", label: "立上り・笠木・架台(㎡)", required: true },
    ],

    materials: [
      // ① PJプライマー 0.2kg/㎡
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 補強用クロス（数量比例なし）
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "upstand",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※必要箇所のみ使用",
      },

      // ②③④ サラセーヌEZ立上り用（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 24,
        unitLabel: "缶",
        specText: "（0.8＋1.1＋0.7kg/㎡）",
      },

      // ⑤ TJトップ / TJフッ素
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "QV-KK50T（TJフッ素）",
    maker: "agc",
    displayName: "サラセーヌ QV-KK50T（TJフッ素）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "perimeter", label: "外周(m)", required: true },
    ],

    materials: [
      // ① サラセーヌP 0.2
      {
        kind: "liquidKg",
        name: "サラセーヌP",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② QVシート
      {
        kind: "sheetRoll",
        name: "QVシート",
        areaKey: "flat",
        sheetWidthM: 1.06,
        sheetLengthM: 15,
        rollLabel: "巻",
      },

      // ジョイントテープ／EZ立上り用
      {
        kind: "jointTapeRoll",
        name: "ジョイントテープ",
        areaKey: "flat",
        sheetWidthM: 1.06,
        tapeLengthM: 100,
        rollLabel: "巻",
        wasteRate: 0.0,
        tapeWidthMm: 100,
      },

      // MBテープ100（数量比例なし）
      // MBテープ100（外周貼り：外周(m) ÷ 20m/巻）
      {
        kind: "endTape",
        name: "MBテープ100",
        areaKey: "perimeter",
        tapeLengthM: 20,
        rollLabel: "巻",
        specText: "外周(m) ÷ 20m/巻",
      },

      // ③④ サラセーヌK（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 3.3,
        packKg: 16,
        unitLabel: "缶",
        specText: "（1.7＋1.6kg/㎡）",
      },

      // ⑤ サラセーヌT / フッ素
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },

  {
    id: "SD-EZ30TJ",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ30TJ（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 補強用クロス
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※補強用（数量比例なし）",
      },

      // ②③④ サラセーヌEZ（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 3.9, // 0.8 + 1.6 + 1.5
        packKg: 24,
        packKgOptions: [16, 20, 24],
        unitLabel: "缶",
        specText: "（0.8+1.6+1.5kg/㎡）",
      },

      // ⑤ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-EZ20TJ（立上り）",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ立上り20TJ（TJフッ素）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],

    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 補強用クロス
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "upstand",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※補強用（数量比例なし）",
      },

      // ②③④ サラセーヌEZ立上り用（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 2.6, // 0.8 + 1.1 + 0.7
        packKg: 24,
        unitLabel: "缶",
        specText: "（0.8+1.1+0.7kg/㎡）",
      },

      // ⑤ TJトップ
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-KK30T（平場）",
    maker: "agc",
    displayName: "サラセーヌ SD-KK30T（TJフッ素）",
    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① サラセーヌP
      {
        kind: "liquidKg",
        name: "サラセーヌP",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 補強用クロス
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※補強用（数量比例なし）",
      },

      // ②③④ サラセーヌK（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 3.9, // 0.8 + 1.6 + 1.5
        packKg: 16,
        unitLabel: "缶",
        specText: "（0.8+1.6+1.5kg/㎡）",
      },

      // ⑤ サラセーヌT / TJフッ素
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },

  {
    id: "SD-EZ20TJ（平場）",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ20TJ（TJフッ素／平場）",

    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ②③ サラセーヌEZ（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ",
        areaKey: "flat",
        kgPerM2: 2.6, // 1.5 + 1.1
        packKg: 24, // 主剤16 + 硬化剤8
        packKgOptions: [16, 20, 24],
        unitLabel: "セット",
        specText: "（1.5+1.1kg/㎡）",
      },

      // ④ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15, // 6 + 9
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-EZ立上り20TJ",
    maker: "agc",
    displayName: "サラセーヌ SD-EZ立上り20TJ（TJフッ素／立上り）",

    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],

    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ②③④ サラセーヌEZ（立上り用・合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 2.6, // 0.8 + 1.1 + 0.7
        packKg: 24, // 主剤16 + 硬化剤8
        unitLabel: "セット",
        specText: "（0.8+1.1+0.7kg/㎡）",
      },

      // ⑤ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15, // 6 + 9
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SDN-EZ立上り20TJ",
    maker: "agc",
    displayName: "サラセーヌ SDN-EZ立上り20TJ（TJフッ素／側溝・巾木）",

    areaFields: [
      { key: "upstand", label: "立上り・側溝・巾木(㎡)", required: true },
    ],

    materials: [
      // ① PJプライマー
      {
        kind: "liquidKg",
        name: "PJプライマー",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ②③ サラセーヌEZ（立上り用・合算）
      {
        kind: "liquidKg",
        name: "サラセーヌEZ（立上り用）",
        areaKey: "upstand",
        kgPerM2: 2.6, // 1.3 + 1.3
        packKg: 24, // 主剤16 + 硬化剤8
        unitLabel: "セット",
        specText: "（1.3kg/㎡×2回）",
      },

      // ④ TJトップ（TJフッ素）
      {
        kind: "liquidKg",
        name: "TJトップ（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15, // 6 + 9
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-KK20T",
    maker: "agc",
    displayName: "サラセーヌ SD-KK20T（TJフッ素／歩行用平場）",

    areaFields: [{ key: "flat", label: "平場(㎡)", required: true }],

    materials: [
      // ① サラセーヌP
      {
        kind: "liquidKg",
        name: "サラセーヌP",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ②③ サラセーヌK（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌK",
        areaKey: "flat",
        kgPerM2: 2.6, // 1.5 + 1.1
        packKg: 16,
        unitLabel: "缶",
        specText: "（1.5kg/㎡＋1.1kg/㎡）",
      },

      // ④ サラセーヌT（TJフッ素）
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SD-立上り20T2",
    maker: "agc",
    displayName: "サラセーヌ SD-立上り20T（共通立上り仕様／TJフッ素）",

    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],

    materials: [
      // ① サラセーヌP
      {
        kind: "liquidKg",
        name: "サラセーヌP",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ② 補強用クロス（数量別途）
      {
        kind: "sheetRoll",
        name: "補強用クロス",
        areaKey: "upstand",
        sheetWidthM: 1.0,
        sheetLengthM: 50,
        rollLabel: "巻",
        specText: "※使用量は表記なし（別途拾い出し）",
      },

      // ③④⑤ サラセーヌ立上り用（合算）
      {
        kind: "liquidKg",
        name: "サラセーヌ立上り用",
        areaKey: "upstand",
        kgPerM2: 2.6, // 0.8 + 1.1 + 0.7
        packKg: 20,
        unitLabel: "缶",
        specText: "（0.8kg/㎡＋1.1kg/㎡＋0.7kg/㎡）",
      },

      // ⑥ サラセーヌT（TJフッ素）
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
  {
    id: "SDN-立上り20T",
    maker: "agc",
    displayName: "サラセーヌ SDN-立上り20T（側溝・巾木仕様／TJフッ素）",

    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],

    materials: [
      // ① サラセーヌP
      {
        kind: "liquidKg",
        name: "サラセーヌP",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // ②③ サラセーヌ立上り用（1.3 + 1.3 = 2.6）
      {
        kind: "liquidKg",
        name: "サラセーヌ立上り用",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "缶",
        specText: "（1.3kg/㎡×2回）",
      },

      // ④ サラセーヌT（TJフッ素）
      {
        kind: "liquidKg",
        name: "サラセーヌT（TJフッ素）",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "セット",
        specText: "（0.2kg/㎡採用／0.15kg/㎡参考）",
      },
    ],
  },
];

export const AGC_SPECS: SpecDef[] = [
  ...AGC_SPECS_TOUGHGUY,
  ...AGC_SPECS_SARACENU,
];

export const AGC_SPEC_SECTIONS = [
  { sectionId: "toughguy", title: "タフガイ", specs: AGC_SPECS_TOUGHGUY },
  { sectionId: "saracenu", title: "サラセーヌ", specs: AGC_SPECS_SARACENU },
] as const;

export function getAgcSpec(specId: string) {
  return AGC_SPECS.find((s) => s.id === specId) ?? null;
}
