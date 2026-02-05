import Link from "next/link";
import {
  getPaintSpecs,
  type PaintMaker,
} from "@/app/sum-quantity/materials/specs/paintSpecs";

type Params = { maker: string };

export default async function PaintSpecListPage(props: { params: Promise<Params> }) {
  const params = await props.params;

  const maker = params.maker as PaintMaker;

  const makerLabel =
    maker === "nippon"
      ? "日本ペイント"
      : maker === "kansai"
        ? "関西ペイント"
        : null;

  const specs = getPaintSpecs(maker);

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">{makerLabel}：仕様一覧</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            仕様を選択して必要数量表を作成します
          </p>
        </header>

        <div className="grid gap-4">
          {specs.map((s) => (
            <Link
              key={s.id}
              href={`/sum-quantity/materials/paint/${encodeURIComponent(maker)}/${encodeURIComponent(
                s.id,
              )}`}
              className="rounded-xl border bg-white p-5 shadow-sm transition hover:shadow dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="text-base font-extrabold">{s.displayName ?? s.id}</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                入力 → 算出
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
