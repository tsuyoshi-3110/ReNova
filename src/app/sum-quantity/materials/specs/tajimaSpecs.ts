import type { SpecDef } from "../engine";

const TAJIMA_SPECS_GOJIN: SpecDef[] = [
  {
    id: "GOW-2VA",
    maker: "tajima",
    displayName: "GOW-2VA",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り・笠木・溝・巾木(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN V",
        areaKey: "flat",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },

      {
        kind: "sheetRoll",
        name: "オルタックシートGS",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 20,
        rollLabel: "巻",
      },

      {
        kind: "jointTapeRoll",
        name: "ジョイントテープ（テープGS）",
        areaKey: "flat",
        sheetWidthM: 1.06,
        tapeLengthM: 80,
        rollLabel: "巻",
        wasteRate: 0.1,

        // ✅ 追加（幅80mm）
        tapeWidthMm: 80,
      },
    ],
  },

  {
    id: "GO-2VA",
    maker: "tajima",
    displayName: "GO-2VA",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN V",
        areaKey: "flat",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "GOD-1VA",
    maker: "tajima",
    displayName: "GOD-1VA",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "速硬化OTプライマーMブルー",
        areaKey: "flat",
        kgPerM2: 0.1,
        packKg: 8,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "速硬化OTプライマーMブルー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 8,
        unitLabel: "缶",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN V",
        areaKey: "flat",
        kgPerM2: 1.5,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 1.5,
        packKg: 20,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "GO-2TA",
    maker: "tajima",
    displayName: "GO-2TA",
    areaFields: [
      { key: "upstand", label: "笠木・架台天端(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 2.6,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "GOD-1TA",
    maker: "tajima",
    displayName: "GOD-1TA",
    areaFields: [
      { key: "upstand", label: "笠木・架台天端(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "速硬化OTプライマーMブルー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 8,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 1.5,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "GO-1HSA",
    maker: "tajima",
    displayName: "GO-1HSA",
    areaFields: [
      { key: "upstand", label: "立上り・側溝部・巾木(㎡)", required: true },
    ],
    materials: [
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN HS",
        areaKey: "upstand",
        kgPerM2: 1.5,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
];

const TAJIMA_SPECS_ORTACK_ACE: SpecDef[] = [
  {
    id: "OATW-3A",
    maker: "tajima",
    displayName: "OATW-3A（通気緩衝複合工法・接着固定）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // 1 プライマー（flat / upstand は入力が別なので2本のままでOK）
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 2 通気緩衝シート（平面部）
      {
        kind: "sheetRoll",
        name: "オルタックシートGS",
        areaKey: "flat",
        sheetWidthM: 1.0,
        sheetLengthM: 20,
        rollLabel: "巻",
      },

      // 3〜4 ウレタン（平面部）※合算（2.0 + 1.5 = 3.5）
      {
        kind: "liquidKg",
        name: "オルタックエース",
        areaKey: "flat",
        kgPerM2: 3.5,
        packKg: 32,
        unitLabel: "セット",
      },

      // 立上り用ウレタン ※合算（0.3 + 1.7 + 1.0 = 3.0）
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 3.0,
        packKg: 24,
        unitLabel: "セット",
      },

      // 補強布
      {
        kind: "sheetRoll",
        name: "メッシュUB",
        areaKey: "upstand",
        sheetWidthM: 1.04,
        sheetLengthM: 100,
        rollLabel: "巻",
      },

      // 5〜6 保護塗料（flat / upstand は入力が別なので2本のままでOK）
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },

      // 参考：ジョイントテープ（テープGS）
      {
        kind: "jointTapeRoll",
        name: "ジョイントテープ（テープGS）",
        areaKey: "flat",
        sheetWidthM: 1.06,
        tapeLengthM: 80,
        rollLabel: "巻",
        wasteRate: 0.1,
        tapeWidthMm: 80,
      },
    ],
  },
  {
    id: "OATM-3A",
    maker: "tajima",
    displayName: "OATM-3A（補強メッシュ入り）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // 1 プライマー（平場/立上り）
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 2,4,5 オルタックエース（平場）：0.3 + 1.7 + 1.5 = 3.5kg/㎡
      {
        kind: "liquidKg",
        name: "オルタックエース",
        areaKey: "flat",
        kgPerM2: 3.5,
        packKg: 32,
        unitLabel: "セット",
      },

      // 2,4,5 立上り用オルタックエース（立上り）：0.3 + 1.7 + 1.0 = 3.0kg/㎡
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 3.0,
        packKg: 24,
        unitLabel: "セット",
      },

      // 3 メッシュUB（平場/立上り）※表では「-」なので面積から必要巻数を算出する想定
      {
        kind: "sheetRoll",
        name: "メッシュUB",
        areaKey: "flat",
        sheetWidthM: 1.04,
        sheetLengthM: 100,
        rollLabel: "巻",
      },
      {
        kind: "sheetRoll",
        name: "メッシュUB",
        areaKey: "upstand",
        sheetWidthM: 1.04,
        sheetLengthM: 100,
        rollLabel: "巻",
      },

      // 6 保護塗料（平場/立上り）
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OATL-6A",
    maker: "tajima",
    displayName: "OATL-6A（メッシュなし）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // 1 プライマー（平場/立上り）
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 2,3 オルタックエース（平場）：2.0 + 1.0 = 3.0kg/㎡
      {
        kind: "liquidKg",
        name: "オルタックエース",
        areaKey: "flat",
        kgPerM2: 3.0,
        packKg: 32,
        unitLabel: "セット",
      },

      // 2,3 立上り用オルタックエース（立上り）：1.5 + 1.0 = 2.5kg/㎡
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.5,
        packKg: 24,
        unitLabel: "セット",
      },

      // 4 OTコートA（平場/立上り）
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OAPM-8A",
    maker: "tajima",
    displayName: "OAPM-8A（補強メッシュ入り）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // 1 プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 2,4,5 立上り用オルタックエース：0.3 + 1.2 + 1.0 = 2.5kg/㎡
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.5,
        packKg: 24,
        unitLabel: "セット",
      },

      // 3 補強布（メッシュUB）
      {
        kind: "sheetRoll",
        name: "メッシュUB",
        areaKey: "upstand",
        sheetWidthM: 1.04,
        sheetLengthM: 100,
        rollLabel: "巻",
      },

      // 6 保護塗料
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OAPL-8A",
    maker: "tajima",
    displayName: "OAPL-8A（メッシュなし）",
    areaFields: [{ key: "upstand", label: "立上り(㎡)", required: true }],
    materials: [
      // 1 プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 2,3 立上り用オルタックエース：1.5 + 1.0 = 2.5kg/㎡
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.5,
        packKg: 24,
        unitLabel: "セット",
      },

      // 4 OTコートA
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OATM-3VA",
    maker: "tajima",
    displayName: "OATM-3VA（補強メッシュ入り）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 平場 オルタックエースVR（合計 3.5kg）
      {
        kind: "liquidKg",
        name: "オルタックエースVR",
        areaKey: "flat",
        kgPerM2: 3.5,
        packKg: 32,
        unitLabel: "セット",
      },

      // 立上り用オルタックエース（合計 3.0kg）
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 3.0,
        packKg: 24,
        unitLabel: "セット",
      },

      // メッシュ
      {
        kind: "sheetRoll",
        name: "メッシュUB",
        areaKey: "flat",
        sheetWidthM: 1.04,
        sheetLengthM: 100,
        rollLabel: "巻",
      },

      // トップコート
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "OATL-6VA",
    maker: "tajima",
    displayName: "OATL-6VA（メッシュなし）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 平場 オルタックエースVR（合計 3.0kg）
      {
        kind: "liquidKg",
        name: "オルタックエースVR",
        areaKey: "flat",
        kgPerM2: 3.0,
        packKg: 32,
        unitLabel: "セット",
      },

      // 立上り用オルタックエース（合計 2.5kg）
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.5,
        packKg: 24,
        unitLabel: "セット",
      },

      // トップコート
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OATL-8VA",
    maker: "tajima",
    displayName: "OATL-8VA（メッシュなし）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 平場 オルタックエースVR（合計 2.5kg）
      {
        kind: "liquidKg",
        name: "オルタックエースVR",
        areaKey: "flat",
        kgPerM2: 2.5,
        packKg: 32,
        unitLabel: "セット",
      },

      // 立上り用オルタックエース（合計 2.5kg）
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.5,
        packKg: 24,
        unitLabel: "セット",
      },

      // トップコート
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },

  {
    id: "OAML-15VA",
    maker: "tajima",
    displayName: "OAML-15VA（メッシュなし）",
    areaFields: [
      { key: "flat", label: "平場(㎡)", required: true },
      { key: "upstand", label: "立上り(㎡)", required: true },
    ],
    materials: [
      // 速硬化プライマー
      {
        kind: "liquidKg",
        name: "速硬化OTプライマーMブルー",
        areaKey: "flat",
        kgPerM2: 0.1,
        packKg: 8,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "速硬化OTプライマーMブルー",
        areaKey: "upstand",
        kgPerM2: 0.1,
        packKg: 8,
        unitLabel: "缶",
      },

      // 平場 オルタックエースVR
      {
        kind: "liquidKg",
        name: "オルタックエースVR",
        areaKey: "flat",
        kgPerM2: 2.0,
        packKg: 32,
        unitLabel: "セット",
      },

      // 立上り用オルタックエース
      {
        kind: "liquidKg",
        name: "立上り用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.0,
        packKg: 24,
        unitLabel: "セット",
      },

      // トップコート
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "flat",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "OTコートA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
  {
    id: "OAVP-2B",
    maker: "tajima",
    displayName: "OAVP-2B（巾木・側溝部／メッシュなし）",
    areaFields: [{ key: "upstand", label: "巾木・側溝部(㎡)", required: true }],
    materials: [
      // プライマー
      {
        kind: "liquidKg",
        name: "OTプライマーA",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "缶",
      },

      // 巾木・側溝用オルタックエース
      {
        kind: "liquidKg",
        name: "巾木・側溝用オルタックエース",
        areaKey: "upstand",
        kgPerM2: 2.0,
        packKg: 32,
        unitLabel: "セット",
      },

      // 防カビトップ
      {
        kind: "liquidKg",
        name: "OTコート防カビ",
        areaKey: "upstand",
        kgPerM2: 0.2,
        packKg: 14,
        unitLabel: "セット",
      },
    ],
  },
];

export const TAJIMA_SPECS: SpecDef[] = [
  ...TAJIMA_SPECS_GOJIN,
  ...TAJIMA_SPECS_ORTACK_ACE,
];

export const TAJIMA_SPEC_SECTIONS = [
  { sectionId: "gojin", title: "GOJIN", specs: TAJIMA_SPECS_GOJIN },
  {
    sectionId: "ortack-ace",
    title: "オルタックエース",
    specs: TAJIMA_SPECS_ORTACK_ACE,
  },
] as const;

export function getTajimaSpec(specId: string) {
  return TAJIMA_SPECS.find((s) => s.id === specId) ?? null;
}
