import type { SpecDef } from "@/app/sum-quantity/materials/engine";
import { NIPPON_PAINT_SPECS } from "./nippon";
import { KANSAI_PAINT_SPECS } from "./kansaiPaintSpecs";

export type PaintMaker = "nippon" | "kansai";

export function getPaintSpecs(maker: PaintMaker): SpecDef[] {
  if (maker === "nippon") return NIPPON_PAINT_SPECS;
  return KANSAI_PAINT_SPECS;
}

export function getPaintSpec(maker: PaintMaker, specId: string) {
  return getPaintSpecs(maker).find((s) => s.id === specId) ?? null;
}
