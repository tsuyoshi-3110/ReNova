// src/app/api/renova/duration-summary/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

// quantity-summary から来る想定の入力
type TotalInput = {
  category: string;          // 例: "屋上防水工事（アスファルト）"
  main_type?: string | null; // 例: "アスファルト防水"（なくてもOK）
  unit: string;              // "㎡" / "ｍ" / "ヶ所" / "段" など
  total: number;             // 合計数量
};

// ユーザーが設定する歩掛り＆人員
type ParamInput = {
  category: string;          // 同じく日本語カテゴリー（完全一致でマッチ）
  main_type?: string | null; // 同じく main_type（必要なら）
  unit: string;              // 同じ単位を指定
  houkake: number;           // 歩掛り（1人1日あたりの施工量: 例 80 ㎡/人日）
  workers: number;           // 人数（例: 4 人）
};

// 計算結果
type DurationResult = {
  category: string;
  main_type?: string | null;
  unit: string;
  total_quantity: number;    // 合計数量
  houkake?: number;          // 入力歩掛り
  workers?: number;          // 入力人数
  capacity_per_day?: number; // 1日あたり施工量（houkake × workers）
  days?: number;             // 必要日数（小数1桁）
  note?: string;             // パラメータ未設定などのメモ
};

// キー生成（カテゴリ＋main_type＋単位）
function makeKey(category: string, mainType: string | null | undefined, unit: string): string {
  return [category.trim(), (mainType ?? "").trim(), unit.trim()].join("|");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { totals?: TotalInput[]; params?: ParamInput[] }
      | null;

    if (!body || !Array.isArray(body.totals) || body.totals.length === 0) {
      return NextResponse.json(
        { error: "totals（数量サマリ）が送信されていません。" },
        { status: 400 }
      );
    }

    const totals = body.totals;
    const params = Array.isArray(body.params) ? body.params : [];

    // params をマップ化（検索しやすくする）
    const paramMap = new Map<string, ParamInput>();
    for (const p of params) {
      if (!p || typeof p.category !== "string" || typeof p.unit !== "string") {
        continue;
      }
      const key = makeKey(p.category, p.main_type, p.unit);
      paramMap.set(key, p);
    }

    const results: DurationResult[] = [];

    for (const t of totals) {
      const key = makeKey(t.category, t.main_type, t.unit);
      const param = paramMap.get(key);

      // パラメータがない場合は、数量だけ返しておく
      if (!param) {
        results.push({
          category: t.category,
          main_type: t.main_type ?? undefined,
          unit: t.unit,
          total_quantity: t.total,
          note: "歩掛り・人数が未設定のため、日数は計算されていません。",
        });
        continue;
      }

      const houkake = Number(param.houkake);
      const workers = Number(param.workers);

      if (!Number.isFinite(houkake) || houkake <= 0 || !Number.isFinite(workers) || workers <= 0) {
        results.push({
          category: t.category,
          main_type: t.main_type ?? undefined,
          unit: t.unit,
          total_quantity: t.total,
          houkake,
          workers,
          note: "歩掛りまたは人数が0以下のため、日数を計算できません。",
        });
        continue;
      }

      const capacityPerDay = houkake * workers; // 1日あたり施工量
      const rawDays = t.total / capacityPerDay;
      const days = Number(rawDays.toFixed(1));  // 小数1桁に丸め

      results.push({
        category: t.category,
        main_type: t.main_type ?? undefined,
        unit: t.unit,
        total_quantity: t.total,
        houkake,
        workers,
        capacity_per_day: Number(capacityPerDay.toFixed(2)),
        days,
      });
    }

    // 全体の合計日数（undefined のものは除外）
    const totalDaysSum = results
      .map((r) => r.days ?? 0)
      .reduce((a, b) => a + b, 0);

    return NextResponse.json({
      results,
      total_days_sum: Number(totalDaysSum.toFixed(1)),
    });
  } catch (err) {
    console.error("duration-summary error:", err);
    return NextResponse.json(
      {
        error: "必要日数サマリの計算に失敗しました。",
        detail: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
