// src/app/workrate-settings/_components/WorkrateSettingsPageInner.tsx
"use client";

import { useEffect, useState } from "react";

type WorkrateRow = {
  category: string;
  main_type?: string | null;
  unit: string;
  houkake: string;
  workers: string;
};

// API から返ってくる 1 行分の型
type WorkrateSettingResponse = {
  category?: string;
  main_type?: string | null;
  unit?: string;
  houkake?: number | string;
  workers?: number | string;
};

const CATEGORY_OPTIONS: string[] = [
  "足場・仮設工事",
  "屋上防水工事（アスファルト）",
  "屋上防水工事（ウレタン）",
  "バルコニー床防水（ウレタン）",
  "バルコニー床仕上げ",
  "外壁・天井塗装工事",
  "鉄部塗装工事",
  "シーリング工事",
  "廊下長尺シート工事",
];

// ✅ 五十音順表示（追加するだけ）
const CATEGORY_OPTIONS_SORTED = [...CATEGORY_OPTIONS].sort((a, b) =>
  a.localeCompare(b, "ja"),
);

const MAIN_TYPE_OPTIONS: string[] = [
  "",
  "アスファルト防水",
  "ウレタン防水",
  "塩ビシート／長尺シート",
  "その他",
];

const UNIT_OPTIONS: string[] = ["㎡", "ｍ", "ヶ所", "段"];

export default function WorkrateSettingsPageInner() {
  const [rows, setRows] = useState<WorkrateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // 初期ロード：API から現在の設定を取得
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/renova/workrate-settings");
        if (!res.ok) {
          throw new Error(
            `GET /api/renova/workrate-settings status ${res.status}`,
          );
        }

        const data = await res.json();
        const rawSettings = data.settings as unknown;

        let initialRows: WorkrateRow[] = [];

        if (Array.isArray(rawSettings)) {
          const settings = rawSettings as WorkrateSettingResponse[];

          initialRows = settings.map(
            (s): WorkrateRow => ({
              category: s.category ?? "",
              main_type: s.main_type ?? "",
              unit: s.unit ?? "",
              houkake:
                s.houkake !== undefined && s.houkake !== null
                  ? String(s.houkake)
                  : "",
              workers:
                s.workers !== undefined && s.workers !== null
                  ? String(s.workers)
                  : "",
            }),
          );
        }

        setRows(initialRows);
      } catch (e) {
        console.error("failed to load workrate settings:", e);
        setError("現在の設定の読み込みに失敗しました。");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { category: "", main_type: "", unit: "", houkake: "", workers: "" },
    ]);
  };

  const updateRow = (index: number, patch: Partial<WorkrateRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSavedMessage(null);

      const payload = rows.map((r) => ({
        category: r.category.trim(),
        main_type: r.main_type ? r.main_type.trim() : null,
        unit: r.unit.trim(),
        houkake: Number(r.houkake),
        workers: Number(r.workers),
      }));

      const res = await fetch("/api/renova/workrate-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: payload }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.error || "保存に失敗しました。");
      }
    } catch (e) {
      console.error("save workrate settings error:", e);
      setError("保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">歩掛り・人数設定</h1>
      <p className="text-sm text-gray-600">
        工種ごとの標準的な歩掛り（1人1日あたりの施工量）と人数を登録しておくと、
        PDF解析画面の「工種別数量サマリ」で自動入力されます。
      </p>

      {loading ? (
        <p className="text-sm text-gray-600">読み込み中...</p>
      ) : (
        <>
          {error && <p className="text-sm text-red-600">エラー: {error}</p>}
          {savedMessage && (
            <p className="text-sm text-emerald-700">{savedMessage}</p>
          )}

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className="border rounded p-3 bg-white flex flex-col gap-2 text-xs sm:text-sm"
              >
                <div className="flex flex-wrap gap-2">
                  {/* 工事種別 */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-700">工事種別</span>
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={row.category}
                      onChange={(e) =>
                        updateRow(idx, { category: e.target.value })
                      }
                    >
                      <option value="">選択してください</option>
                      {CATEGORY_OPTIONS_SORTED.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 種別 */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-700">
                      種別（任意）
                    </span>
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={row.main_type ?? ""}
                      onChange={(e) =>
                        updateRow(idx, { main_type: e.target.value })
                      }
                    >
                      {MAIN_TYPE_OPTIONS.map((mt) => (
                        <option key={mt} value={mt}>
                          {mt || "指定なし"}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 単位 */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-700">単位</span>
                    <select
                      className="border rounded px-2 py-1 text-xs"
                      value={row.unit}
                      onChange={(e) => updateRow(idx, { unit: e.target.value })}
                    >
                      <option value="">選択</option>
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 歩掛り */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-700">
                      歩掛り（数量/人日）
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      className="border rounded px-2 py-1 w-24 text-xs"
                      value={row.houkake}
                      onChange={(e) =>
                        updateRow(idx, { houkake: e.target.value })
                      }
                    />
                  </div>

                  {/* 人数 */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] text-gray-700">人数</span>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      className="border rounded px-2 py-1 w-16 text-xs"
                      value={row.workers}
                      onChange={(e) =>
                        updateRow(idx, { workers: e.target.value })
                      }
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  className="self-end text-[11px] text-red-600 hover:underline"
                >
                  行を削除
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={addRow}
              className="rounded px-3 py-1.5 text-xs bg-gray-200 hover:bg-gray-300"
            >
              行を追加
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`rounded px-4 py-1.5 text-xs text-white ${
                saving
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {saving ? "保存中..." : "設定を保存"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
