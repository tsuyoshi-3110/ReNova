"use client";

import React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

export default function BoardPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();

  const projectId = params?.projectId ?? "";
  const projectName = (searchParams.get("projectName") ?? "").trim();

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-4">
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
          掲示板 {projectName ? `：${projectName}` : ""}
        </h1>

        <div className="rounded-2xl border bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
          ここに掲示板機能を実装していきます（仮ページ）。
        </div>

        <Link
          href={`/proclink/projects/${encodeURIComponent(projectId)}/menu${
            projectName ? `?projectName=${encodeURIComponent(projectName)}` : ""
          }`}
          className="text-sm font-bold text-gray-700 hover:underline dark:text-gray-200"
        >
          ← 工事メニューへ戻る
        </Link>
      </div>
    </main>
  );
}
