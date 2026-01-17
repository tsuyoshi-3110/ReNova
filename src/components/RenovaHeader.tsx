// 例: src/components/renova/RenovaHeader.tsx

"use client";

import React from "react";

type Props = {
  isDark: boolean;
  setIsDark: React.Dispatch<React.SetStateAction<boolean>>;
};

const RenovaHeader: React.FC<Props> = ({ isDark, setIsDark }) => {
  return (
    // 上部ヘッダー＋トグルボタン
    <div className="flex items-center justify-between mb-2">
      <h1 className="text-2xl font-bold">Renova PDF → 数量＆日数計算テスト</h1>
      <button
        type="button"
        onClick={() => setIsDark((v) => !v)}
        className="rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-100 shadow-sm"
      >
        {isDark ? "🌞 ライトモード" : "🌙 ダークモード"}
      </button>
    </div>
  );
};

export default RenovaHeader;
