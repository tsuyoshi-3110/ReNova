"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Camera, Shirt, MessageSquare } from "lucide-react";

export default function ProjectMenuPage() {
  const params = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();

  const projectId = params?.projectId ?? "";
  const projectName = (searchParams.get("projectName") ?? "").trim();

  const title = useMemo(() => {
    return projectName ? `工事メニュー：${projectName}` : "工事メニュー";
  }, [projectName]);

  const q = projectName
    ? `?projectName=${encodeURIComponent(projectName)}`
    : "";

  return (
    <main className="min-h-dvh bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 space-y-6">
        <header className="space-y-1">
          <div className="text-sm font-bold text-gray-600 dark:text-gray-300">
            Project ID: {projectId}
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            メニューを選択してください
          </p>
        </header>

        <section className="grid gap-3">
          {/* 写真管理 → 既存の work-types へ */}
          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/work-types${q}`}
            className={[
              "rounded-2xl border p-4 transition",
              "border-gray-200 bg-white hover:bg-gray-50",
              "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <Camera className="h-5 w-5 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  写真管理
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  工程別に撮影・未撮影を管理
                </div>
              </div>
            </div>
          </Link>

          {/* 洗濯物情報（仮ページ） */}
          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/laundry${q}`}
            className={[
              "rounded-2xl border p-4 transition",
              "border-gray-200 bg-white hover:bg-gray-50",
              "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <Shirt className="h-5 w-5 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  洗濯物情報
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  洗濯物の可否などのお知らせ（仮）
                </div>
              </div>
            </div>
          </Link>

          {/* 掲示板（仮ページ） */}
          <Link
            href={`/proclink/projects/${encodeURIComponent(projectId)}/board${q}`}
            className={[
              "rounded-2xl border p-4 transition",
              "border-gray-200 bg-white hover:bg-gray-50",
              "dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-900/70",
            ].join(" ")}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-100 dark:bg-gray-800">
                <MessageSquare className="h-5 w-5 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                  掲示板
                </div>
                <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  住人向けのお知らせ・連絡（仮）
                </div>
              </div>
            </div>
          </Link>
        </section>

        <div className="pt-2">
          <Link
            href="/proclink/projects"
            className="text-sm font-bold text-gray-700 hover:underline dark:text-gray-200"
          >
            ← 工事一覧へ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
