// src/app/project-management/page.tsx
import React, { Suspense } from "react";
import ProjectManagementPageInner from "./_components/page";

export default function ProjectManagementPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[calc(100vh-56px)] bg-gray-50 px-4 py-10 dark:bg-gray-950">
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-2xl border bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              読み込み中...
            </div>
          </div>
        </main>
      }
    >
      <ProjectManagementPageInner />
    </Suspense>
  );
}
