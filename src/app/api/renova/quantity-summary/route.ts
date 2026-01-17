// src/app/api/renova/quantity-summary/route.ts
import { NextRequest, NextResponse } from "next/server";

type SpecItem = {
  section: string;  // 例: "B 直接仮設工事"
  name: string;     // 例: "外部足場 鋼製足場"
  unit: string;     // 例: "㎡", "m", "ヶ所", "式"
  quantity: number; // 行の数量
};

export type QuantityTotal = {
  category: string;         // 例: "B 直接仮設工事"
  main_type: string | null; // 工事名（原文を基本そのまま）
  unit: string;             // "㎡" / "m" / "ヶ所" / "式" など
  total: number;            // 合計数量
};

// 各工事（セクション）ごとの代表平米数
export type CategoryAreaSummary = {
  category: string;   // 例: "C 防水工事"
  total_m2: number;   // 工事全体として使う代表㎡
  sourceKeys: string[]; // どの totals 行から算出したか（デバッグ用）
};

// ちょっとだけ正規化：全角空白を半角に、連続空白を1つに
function normalizeText(s: string): string {
  return s
    .replace(/\u3000/g, " ") // 全角スペース → 半角
    .replace(/\s+/g, " ")    // 空白連続 → 1個
    .trim();
}

// 工程表上「完全に除外」したいセクションを判定
function isSectionExcluded(section: string): boolean {
  const s = normalizeText(section);
  return (
    s.startsWith("A 共通仮設工事") ||
    s.startsWith("I その他工事") ||
    s.startsWith("J 諸経費")
  );
}

// 足場・仮設系のセクションかどうか
function isScaffoldSection(category: string): boolean {
  const s = normalizeText(category);
  return s.includes("仮設工事") || s.includes("足場");
}

// main_type が「下地系」かどうか
function isBaseWork(mainType: string | null): boolean {
  if (!mainType) return false;
  const s = normalizeText(mainType);
  return s.includes("下地"); // 下地処理・下地調整・下地補修 などまとめて拾う
}

// 足場の「組立そのもの」らしい行かどうか
function isScaffoldCoreWork(mainType: string | null): boolean {
  if (!mainType) return false;
  const s = normalizeText(mainType);
  if (!s.includes("足場")) return false;
  // メッシュシート・ネット・運搬・養生などは除外
  if (
    s.includes("メッシュ") ||
    s.includes("シート") ||
    s.includes("ネット") ||
    s.includes("運搬") ||
    s.includes("養生")
  ) {
    return false;
  }
  return true;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const itemsUnknown = (body as { items?: unknown }).items;
  if (!Array.isArray(itemsUnknown)) {
    return NextResponse.json(
      { error: "`items` must be an array" },
      { status: 400 }
    );
  }

  const items: SpecItem[] = itemsUnknown
    .map((v) => v as Partial<SpecItem>)
    .filter((v): v is SpecItem => {
      return (
        !!v &&
        typeof v.section === "string" &&
        typeof v.name === "string" &&
        typeof v.unit === "string" &&
        typeof v.quantity === "number" &&
        !Number.isNaN(v.quantity)
      );
    });

  // ===== 行単位の集計（従来通り） =====
  const map = new Map<string, QuantityTotal>();
  const order: string[] = []; // 初出順を保持するため

  for (const item of items) {
    // 共通仮設・その他工事・諸経費は工程表から除外
    if (isSectionExcluded(item.section)) {
      continue;
    }

    const category = normalizeText(item.section);
    const main_type = normalizeText(item.name);
    const unit = normalizeText(item.unit);

    // 「カテゴリ + 工事名 + 単位」でキーを作る
    const key = `${category}__${main_type}__${unit}`;

    if (!map.has(key)) {
      map.set(key, {
        category,
        main_type,
        unit,
        total: 0,
      });
      order.push(key);
    }

    const current = map.get(key)!;
    current.total += item.quantity;
  }

  const totals: QuantityTotal[] = order.map((k) => map.get(k)!);

  // ===== 各工事（セクション）ごとの合計平米数を算出 =====
  // totals を category ごとにグループ化
  const byCategory = new Map<string, { key: string; row: QuantityTotal }[]>();
  order.forEach((key) => {
    const row = map.get(key)!;
    const arr = byCategory.get(row.category) ?? [];
    arr.push({ key, row });
    byCategory.set(row.category, arr);
  });

  const categoryAreas: CategoryAreaSummary[] = [];

  for (const [category, rows] of byCategory.entries()) {
    // ㎡ の行だけ見る
    const m2Rows = rows.filter((r) => r.row.unit === "㎡" && r.row.total > 0);
    if (m2Rows.length === 0) {
      // このセクションに㎡が無ければスキップ
      continue;
    }

    let selectedRows: { key: string; row: QuantityTotal }[] = [];

    if (isScaffoldSection(category)) {
      // 足場・仮設系：組立面積っぽい行だけを候補にする
      const core = m2Rows.filter((r) => isScaffoldCoreWork(r.row.main_type));
      if (core.length > 0) {
        // 数量が最大のものを代表とする
        let max = core[0];
        for (const r of core) {
          if (r.row.total > max.row.total) {
            max = r;
          }
        }
        selectedRows = [max];
      }
    }

    if (selectedRows.length === 0) {
      // 防水・塗装など：下地系があればそれを代表にする
      const baseRows = m2Rows.filter((r) => isBaseWork(r.row.main_type));
      if (baseRows.length > 0) {
        let max = baseRows[0];
        for (const r of baseRows) {
          if (r.row.total > max.row.total) {
            max = r;
          }
        }
        selectedRows = [max];
      } else {
        // 下地系が無ければ、㎡を全部足す（平場 + 立上りなど）
        selectedRows = m2Rows;
      }
    }

    const total_m2 = selectedRows.reduce((sum, r) => sum + r.row.total, 0);
    const sourceKeys = selectedRows.map((r) => r.key);

    categoryAreas.push({
      category,
      total_m2,
      sourceKeys,
    });
  }

  return NextResponse.json({ totals, categoryAreas });
}
