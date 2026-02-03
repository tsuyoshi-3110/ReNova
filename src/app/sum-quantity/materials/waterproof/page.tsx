import Link from "next/link";

export default function WaterproofMakersPage() {
  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">防水工事：メーカー一覧</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            メーカーを選択してください
          </p>
        </header>

        <div className="grid gap-4">
          <Link
            href="/sum-quantity/materials/waterproof/tajima"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">タジマルーフィング</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              仕様を選択して必要数量を算出
            </div>
          </Link>

          <Link
            href="/sum-quantity/materials/waterproof/agc"
            className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="text-base font-extrabold">AGC</div>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              仕様を選択して必要数量を算出
            </div>
          </Link>
        </div>

        <div className="pt-2">
          <Link
            href="/renova/materials"
            className="inline-flex items-center text-sm font-bold text-gray-700 hover:underline dark:text-gray-200"
          >
            ← 材料計算メニューへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
