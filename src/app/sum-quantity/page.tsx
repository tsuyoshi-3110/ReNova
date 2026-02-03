"use client";

import { useRouter } from "next/navigation";

export default function SumQuantityHomePage() {
  const router = useRouter();

  return (
    <main className="mx-auto w-full max-w-3xl p-4 md:p-8">
      <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="text-xl font-extrabold text-gray-900 dark:text-gray-100">
          集計メニュー
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          目的の機能を選んでください。
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => router.push("/sum-quantity/materials")}
            className="rounded-lg border bg-white px-4 py-4 text-left text-gray-900 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
          >
            <div className="text-base font-extrabold">要必要材料計算</div>
            <div className="mt-1 text-xs opacity-90">
              面積や仕様から材料を自動計算
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.push("/sum-quantity/excel")}
            className="rounded-lg border bg-white px-4 py-4 text-left text-gray-900 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-100 dark:hover:bg-gray-900"
          >
            <div className="text-base font-extrabold">
              エクセルファイルから拾う
            </div>
            <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Excel/CSV をアップして数量集計
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}
