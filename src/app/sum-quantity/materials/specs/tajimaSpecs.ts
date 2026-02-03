import type { SpecDef } from "../engine";

export const TAJIMA_SPECS: SpecDef[] = [
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
        sheetWidthM: 1.0,
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
        kgPerM2: 1.3,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 1.3,
        packKg: 20,
        unitLabel: "セット",
      },

      {
        kind: "liquidKg",
        name: "GO-JIN V",
        areaKey: "flat",
        kgPerM2: 1.3,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 1.3,
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
        kgPerM2: 1.3,
        packKg: 20,
        unitLabel: "セット",
      },
      {
        kind: "liquidKg",
        name: "GO-JIN T",
        areaKey: "upstand",
        kgPerM2: 1.3,
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

export function getTajimaSpec(specId: string) {
  return TAJIMA_SPECS.find((s) => s.id === specId) ?? null;
}
