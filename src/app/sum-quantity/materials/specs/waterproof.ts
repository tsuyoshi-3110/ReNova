// app/materials/specs/waterproof.ts
import type { SpecDef } from "@/app/sum-quantity/materials/engine";
import { TAJIMA_SPECS } from "@/app/sum-quantity/materials/specs/tajimaSpecs";
import { AGC_SPECS } from "@/app/sum-quantity/materials/specs/agcSpec";

export type WaterproofMaker = "tajima" | "agc";

export function getWaterproofSpecs(maker: WaterproofMaker): SpecDef[] {
  if (maker === "tajima") return TAJIMA_SPECS;
  if (maker === "agc") return AGC_SPECS; // ✅ 追加
  return [];
}

export function getWaterproofSpec(maker: WaterproofMaker, specId: string) {
  return getWaterproofSpecs(maker).find((s) => s.id === specId) ?? null;
}
