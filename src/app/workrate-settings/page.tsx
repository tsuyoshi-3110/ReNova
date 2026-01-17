// src/app/workrate-settings/page.tsx


import React, { Suspense } from "react";
import WorkrateSettingsPageInner from "./_components/WorkrateSettingsPageInner";
export default function WorkrateSettingsPage() {
  return (
    <Suspense fallback={<main className="max-w-4xl mx-auto p-4">読み込み中...</main>}>
      <WorkrateSettingsPageInner />
    </Suspense>
  );
}
