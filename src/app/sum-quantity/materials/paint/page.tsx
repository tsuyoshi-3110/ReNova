// app/materials/paint/page.tsx
"use client";

import Link from "next/link";

export default function PaintMakerSelectPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">塗装工事</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            メーカーを選択してください
          </p>
        </header>

        <section className="grid gap-4">
          <Link
            href="/sum-quantity/materials/paint/kansai"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">関西ペイント</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              関西ペイントの仕様から必要数量を算出
            </div>
          </Link>

          <Link
            href="/sum-quantity/materials/paint/nippon"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">日本ペイント</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              日本ペイントの仕様から必要数量を算出
            </div>
          </Link>
        </section>
      </div>
    </main>
  );
}
