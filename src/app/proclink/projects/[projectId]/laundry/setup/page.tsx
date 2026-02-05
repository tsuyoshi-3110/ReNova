// src/app/proclink/projects/[projectId]/laundry/setup/page.tsx
import LaundrySetupClient from "./LaundrySetupClient";

type Params = { projectId: string };

export default async function LaundrySetupPage(props: {
  params: Promise<Params>;
}) {
  const params = await props.params;

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
          洗濯物掲示板の設定
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          階数・部屋数などを設定して保存してください
        </p>
      </div>

      <LaundrySetupClient projectId={params.projectId} />
    </main>
  );
}
