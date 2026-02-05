// app/agc/page.tsx
import Link from "next/link";
import type { SpecDef } from "@/app/sum-quantity/materials/engine";
import { getWaterproofSpecs } from "@/app/sum-quantity/materials/specs/waterproof";
import { AGC_SPEC_SECTIONS } from "@/app/sum-quantity/materials/specs/agcSpec";

type SectionView = {
  sectionId: string;
  title: string;
  specs: SpecDef[];
};

export default function AgcSpecListPage() {
  const allSpecs = getWaterproofSpecs("agc");

  // 1) 定義済みセクション順で並べる（タフガイ / サラセーヌ など）
  const sections: SectionView[] = AGC_SPEC_SECTIONS.map((sec) => ({
    sectionId: sec.sectionId,
    title: sec.title,
    specs: sec.specs,
  }));

  // 2) セクション未所属があれば「その他」
  const sectionSpecIds = new Set(
    sections.flatMap((sec) => sec.specs.map((s) => s.id))
  );
  const ungrouped = allSpecs.filter((s) => !sectionSpecIds.has(s.id));
  if (ungrouped.length > 0) {
    sections.push({ sectionId: "other", title: "その他", specs: ungrouped });
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">AGC：仕様一覧</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            仕様を選択して必要数量表を作成します
          </p>
        </header>

        {/* ✅ Tajima と同じ「セクション表示」 */}
        <div className="space-y-10">
          {sections.map((sec) => (
            <section key={sec.sectionId} className="space-y-3">
              <div className="px-1">
                <div className="text-xs font-extrabold tracking-wider text-gray-500 dark:text-gray-400">
                  {sec.title}
                </div>
              </div>

              <div className="grid gap-4">
                {sec.specs.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sum-quantity/materials/waterproof/agc/${encodeURIComponent(
                      s.id
                    )}`}
                    className="rounded-xl border bg-white p-5 shadow-sm hover:shadow transition dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="text-base font-extrabold">
                      {s.displayName ?? s.id}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      入力 → 算出
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
