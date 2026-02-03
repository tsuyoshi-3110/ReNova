import type { SpecDef } from "../engine";

export const NIPPON_PAINT_SPECS: SpecDef[] = [
  {
    id: "EXTERIOR_WALL",
    maker: "nippon",
    displayName: "外壁塗装",
    areaFields: [{ key: "area", label: "塗装面積(㎡)", required: true }],
    materials: [
      {
        kind: "liquidKg",
        name: "パーフェクトフィラー",
        areaKey: "area",
        kgPerM2: 0.7,
        packKg: 15,
        unitLabel: "缶",
      },
      {
        kind: "liquidKg",
        name: "ｵｰﾃﾞﾌﾚｯｼｭＳｉ１００Ⅲ",
        areaKey: "area",
        kgPerM2: 0.31,
        packKg: 15,
        unitLabel: "缶",
      },
    ],
  },
];

export function getNipponPaintSpec(specId: string) {
  return NIPPON_PAINT_SPECS.find((s) => s.id === specId) ?? null;
}
