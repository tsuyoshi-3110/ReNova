import LaundryResidentClient from "../LaundryResidentClient";

export default function LaundryBoardPage({ params }: { params: { projectId: string } }) {
  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">
          洗濯物情報掲示板（居住者）
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          今日の日付に自動で切り替わります（編集はできません）
        </p>
      </div>

      <LaundryResidentClient projectId={params.projectId} />
    </main>
  );
}
