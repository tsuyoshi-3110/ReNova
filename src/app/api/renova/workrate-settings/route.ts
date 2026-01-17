// src/app/api/renova/workrate-settings/route.ts
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type WorkrateSetting = {
  category: string;
  main_type?: string | null;
  unit: string;
  houkake: number;
  workers: number;
};

// プロセスが生きている間だけ保持する簡易ストア
const STORE: WorkrateSetting[] = [];

export async function GET() {
  // 今保存している設定をそのまま返す
  return NextResponse.json({ settings: STORE });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      settings?: unknown;
    } | null;

    if (!body || !Array.isArray(body.settings)) {
      return NextResponse.json(
        { error: "settings 配列が送られていません。" },
        { status: 400 }
      );
    }

    const parsed: WorkrateSetting[] = [];

    // もとの部分
    // for (const raw of body.settings) {
    //   if (!raw || typeof raw !== "object") continue;
    //   const obj = raw as any;
    //   ...
    // }

    for (const raw of body.settings as unknown[]) {
      if (!raw || typeof raw !== "object") continue;

      // any の代わりに「キーが文字列で値が unknown のオブジェクト」として扱う
      const obj = raw as {
        category?: unknown;
        main_type?: unknown;
        unit?: unknown;
        houkake?: unknown;
        workers?: unknown;
      };

      if (!obj.category || !obj.unit) continue;

      const houkake = Number(obj.houkake);
      const workers = Number(obj.workers);

      if (!Number.isFinite(houkake) || houkake <= 0) continue;
      if (!Number.isFinite(workers) || workers <= 0) continue;

      parsed.push({
        category: String(obj.category),
        main_type:
          obj.main_type === undefined ||
          obj.main_type === null ||
          obj.main_type === ""
            ? null
            : String(obj.main_type),
        unit: String(obj.unit),
        houkake,
        workers,
      });
    }

    // 既存をクリアして差し替え
    STORE.length = 0;
    STORE.push(...parsed);

    return NextResponse.json({ settings: STORE });
  } catch (err) {
    console.error("workrate-settings POST error:", err);
    return NextResponse.json(
      {
        error: "歩掛り設定の保存に失敗しました。",
        detail: err instanceof Error ? err.message : "unknown error",
      },
      { status: 500 }
    );
  }
}
