import type { SpecDef } from "../engine";

export const KANSAI_PAINT_SPECS: SpecDef[] = [
  {
    id: "KP-ALES-DYNAMIC-01",
    maker: "kansai",
    displayName: "一般外壁・内壁／微弾性 ＜アレスダイナミック＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "アレスダイナミックフィラー",
        areaKey: "area",
        kgPerM2: 1.5,
        packKg: 16,
        unitLabel: "缶",
        specText: "16kg/缶",
      },
      {
        kind: "liquidKg",
        name: "アレスダイナミックTOP",
        areaKey: "area",
        kgPerM2: 0.28, // 0.14 × 2
        packKg: 15,
        unitLabel: "缶",
        specText: "15kg/缶",
      },
    ],
  },

  {
    id: "No2_EcoCationSealer_AlesDynamicTOP",
    maker: "kansai",
    displayName: "他壁面 ＜エコカチオンシーラー＋アレスダイナミックTOP＞",
    areaFields: [{ key: "wall", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エコカチオンシーラー",
        areaKey: "wall",
        kgPerM2: 0.17,
        packKg: 15,
        unitLabel: "缶",
        specText: "15kg",
      },
      {
        kind: "liquidKg",
        name: "アレスダイナミックTOP",
        areaKey: "wall",
        kgPerM2: 0.28,
        packKg: 15,
        unitLabel: "缶",
        specText: "15kg",
      },
    ],
  },

  {
    id: "PAINT-KP-NO6",
    maker: "kansai",
    displayName:
      "廊下天井・他天井（リシン面）※艶消し塗材面 ＜アレスノキテンコート＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "アレスノキテンコート",
        areaKey: "area",
        kgPerM2: 0.7, // 0.35 × 2
        packKg: 20,
        unitLabel: "kg",
        specText: "無希釈",
      },
    ],
  },

  {
    id: "PAINT-KP-NO7",
    maker: "kansai",
    displayName:
      "バルコニー天井・庇上裏・他天井（艶あり塗材面）＜エコカチオンシーラ+アレスダイナミックトップ＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エコカチオンシーラー",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 15,
        unitLabel: "kg",
        specText: "無希釈",
      },
      {
        kind: "liquidKg",
        name: "アレスダイナミックTOP",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 15,
        unitLabel: "kg",
        specText: "希釈：上水（3〜5%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO8",
    maker: "kansai",
    displayName:
      "エントランス天井・2階廊下天井・他天井（ボード面）＜アレスワイドグリップⅡ＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "アレス水性ワイドグリップⅡ",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "希釈：上水（0〜10%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO3",
    maker: "kansai",
    displayName:
      "廊下手摺・駐輪場外壁・他（パネルボード面）＜アレスダイナミックシーラーアクア＋アレスダイナミックTOP＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "アレスダイナミックシーラー アクア",
        areaKey: "area",
        kgPerM2: 0.2,
        packKg: 15,
        unitLabel: "kg",
        specText: "2液形・希釈：上水",
      },
      {
        kind: "liquidKg",
        name: "アレスダイナミックTOP",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 15,
        unitLabel: "kg",
        specText: "希釈：上水（3〜5%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO9",
    maker: "kansai",
    displayName: "一般鉄部＜エスコNBマイルド＋セラMレタン＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エスコNBマイルド",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：塗料用シンナーA（0〜10%）",
      },
      {
        kind: "liquidKg",
        name: "セラMレタン",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：塗料用シンナーA（5〜15%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO10",
    maker: "kansai",
    displayName:
      "鉄骨階段・屋上フェンス枠・他鉄部＜エスコNBマイルド＋セラMシリコンⅢ＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エスコNBマイルド",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：塗料用シンナーA（0〜10%）",
      },
      {
        kind: "liquidKg",
        name: "セラMシリコンⅢ",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：塗料用シンナーA",
      },
      {
        kind: "liquidKg",
        name: "ルビゴール",
        areaKey: "area",
        kgPerM2: 0.31, // 0.13 + 0.18
        packKg: 16,
        unitLabel: "kg",
        specText: "さび露出部補修用",
      },
    ],
  },

  {
    id: "PAINT-KP-NO11",
    maker: "kansai",
    displayName: "玄関扉枠＜パワーMレタンEX＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "パワーMレタンEX",
        areaKey: "area",
        kgPerM2: 0.26,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：塗料用シンナーA（2〜8%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO12",
    maker: "kansai",
    displayName: "ドレン＜エポテクトタールフリー（黒）＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エポテクトタールフリー（黒）",
        areaKey: "area",
        kgPerM2: 0.36,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形・希釈：テクトEP内面用シンナー（0〜5%）",
      },
    ],
  },

  {
    id: "PAINT-KP-NO13",
    maker: "kansai",
    displayName:
      "竪樋・パーテーションボード＜エスコNBマイルド（鉄部のみ）＋セラMレタン＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "エスコNBマイルド",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 16,
        unitLabel: "kg",
        specText: "鉄部のみ",
      },
      {
        kind: "liquidKg",
        name: "セラMレタン",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形",
      },
    ],
  },

  {
    id: "PAINT-KP-NO14",
    maker: "kansai",
    displayName:
      "高架水槽・受水槽・他（FRP貯水槽前面）＜スーパーザウルスⅡ＋セラMレタン＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "スーパーザウルスⅡ",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 16,
        unitLabel: "kg",
        specText: "下塗",
      },
      {
        kind: "liquidKg",
        name: "セラMレタン",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "上塗",
      },
    ],
  },

  {
    id: "PAINT-KP-NO15",
    maker: "kansai",
    displayName:
      "内部廊下スピーカー・他（木部塗装面）＜カンペ1液M 木部用下塗HG＋セラMレタン＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "カンペ1液M 木部用下塗HG",
        areaKey: "area",
        kgPerM2: 0.2,
        packKg: 16,
        unitLabel: "kg",
        specText: "1液形",
      },
      {
        kind: "liquidKg",
        name: "セラMレタン",
        areaKey: "area",
        kgPerM2: 0.28,
        packKg: 16,
        unitLabel: "kg",
        specText: "2液形",
      },
    ],
  },

  {
    id: "PAINT-KP-NO17",
    maker: "kansai",
    displayName: "避雷針＜スーパーザウルスⅡ＋プラチナイトR＞",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "スーパーザウルスⅡ",
        areaKey: "area",
        kgPerM2: 0.17,
        packKg: 16,
        unitLabel: "kg",
        specText: "下塗",
      },
      {
        kind: "liquidKg",
        name: "プラチナイトR",
        areaKey: "area",
        kgPerM2: 0.24, // 0.12 × 2
        packKg: 16,
        unitLabel: "kg",
        specText: "1液形",
      },
    ],
  },
];

export function getKansaiPaintSpec(specId: string) {
  return KANSAI_PAINT_SPECS.find((s) => s.id === specId) ?? null;
}
