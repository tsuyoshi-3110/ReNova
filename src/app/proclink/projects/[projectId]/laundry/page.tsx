// src/app/proclink/projects/[projectId]/laundry/page.tsx
import LaundryAdminClient from "./LaundryAdminClient";

type Params = { projectId: string };
type SearchParams = { date?: string };

function isDateKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function LaundryPage(props: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  const params = await props.params;
  const sp = props.searchParams ? await props.searchParams : undefined;

  const initialDate = isDateKey(sp?.date) ? sp!.date! : undefined;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
          洗濯物情報掲示板（管理）
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          前日に「明日」を選んで入力してもOKです（保存時に日付も保存されます）
        </p>
      </div>

      <LaundryAdminClient projectId={params.projectId} initialDate={initialDate} />
    </main>
  );
}
