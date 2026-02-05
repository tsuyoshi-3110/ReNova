import LaundryAdminClient from "./LaundryAdminClient";

export default function LaundryPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams?: { date?: string };
}) {
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

      <LaundryAdminClient projectId={params.projectId} initialDate={searchParams?.date} />
    </main>
  );
}
