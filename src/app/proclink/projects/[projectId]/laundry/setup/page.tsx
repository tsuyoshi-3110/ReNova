import LaundrySetupClient from "./LaundrySetupClient";

export default function LaundrySetupPage({ params }: { params: { projectId: string } }) {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
          洗濯物掲示板の作成 / 編集
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          階数・部屋数・開始番号を設定します（Firestoreに保存）
        </p>
      </div>

      <LaundrySetupClient projectId={params.projectId} />
    </main>
  );
}
