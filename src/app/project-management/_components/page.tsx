// src/app/project-management/_components/ProjectManagementPageInner.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";

export default function ProjectManagementPageInner() {
  const router = useRouter();

  return (
    <main className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-10 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl">
        <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            工程表
          </h1>
          <p className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
            工程表の作成や、歩掛り設定をここから操作します。
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => router.push("/schedule")}
              className="rounded-2xl border bg-white px-5 py-4 text-left shadow-sm hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
            >
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                工程表作成
              </div>
              <div className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                /schedule
              </div>
            </button>

            <button
              type="button"
              onClick={() => router.push("/workrate-settings")}
              className="rounded-2xl border bg-white px-5 py-4 text-left shadow-sm hover:bg-gray-50
                         dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-900"
            >
              <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                歩掛り設定
              </div>
              <div className="mt-1 text-xs font-bold text-gray-500 dark:text-gray-400">
                /workrate-settings
              </div>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
