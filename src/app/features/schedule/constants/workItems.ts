// src/features/schedule/constants/workItems.ts
import { WorkItem } from "../types";

export const wallWorkItems: WorkItem[] = [
  { name: "足場組立", unit: "㎡", mode: "calc", defaultWorkers: 5, defaultProductivity: 100, defaultQty: 2000, color: "#43A047" },
  { name: "下地補修", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 30, defaultQty: 300, color: "#FB8C00" },
  { name: "シーリング", unit: "m",  mode: "calc", defaultWorkers: 2, defaultProductivity: 150, defaultQty: 1500, color: "#8E24AA" },
  { name: "塗装（外壁）", unit: "㎡", mode: "calc", defaultWorkers: 5, defaultProductivity: 120, defaultQty: 1500, color: "#1E88E5" },
  { name: "塗装（鉄部）", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 40,  defaultQty: 200,  color: "#1E88E5" },
  { name: "防水工事", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 50,  defaultQty: 600,  color: "#00ACC1" },
  { name: "長尺シート", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 200, defaultQty: 1500, color: "#6D4C41" },
  { name: "美装",     unit: "㎡", mode: "calc", defaultWorkers: 3, defaultProductivity: 200, defaultQty: 500,  color: "#E91E63" },
  { name: "検査",     unit: "days", mode: "days", defaultQty: 2, color: "#3949AB" },
  { name: "手直し",   unit: "days", mode: "days", defaultQty: 3, color: "#F4511E" },
  { name: "足場解体", unit: "㎡", mode: "calc", defaultWorkers: 5, defaultProductivity: 200, defaultQty: 2000, color: "#9E9E9E" },
];

export const rooftopWithTower: WorkItem[] = [
  { name: "塔屋-足場組立", unit: "㎡", mode: "calc", defaultWorkers: 3, defaultProductivity: 80,  defaultQty: 300, color: "#2E7D32" },
  { name: "塔屋-下地補修", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 60,  defaultQty: 300, color: "#FB8C00" },
  { name: "塔屋-シーリング", unit: "m", mode: "calc", defaultWorkers: 2, defaultProductivity: 150, defaultQty: 600, color: "#8E24AA" },
  { name: "塔屋-外壁塗装", unit: "㎡", mode: "calc", defaultWorkers: 3, defaultProductivity: 120, defaultQty: 400, color: "#1E88E5" },
  { name: "塔屋-足場解体", unit: "㎡", mode: "calc", defaultWorkers: 3, defaultProductivity: 120, defaultQty: 300, color: "#8D8D8D" },
  { name: "屋上鉄部塗装", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 80, defaultQty: 300, color: "#1E88E5" },
  { name: "屋上防水工事", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 60, defaultQty: 800, color: "#00ACC1" },
  { name: "その他防水工事", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 60, defaultQty: 200, color: "#0097A7" },
];

export const rooftopNoTower: WorkItem[] = [
  { name: "屋上鉄部塗装", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 80, defaultQty: 300, color: "#1E88E5" },
  { name: "屋上防水工事", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 60, defaultQty: 800, color: "#00ACC1" },
  { name: "その他防水工事", unit: "㎡", mode: "calc", defaultWorkers: 2, defaultProductivity: 60, defaultQty: 200, color: "#0097A7" },
];
