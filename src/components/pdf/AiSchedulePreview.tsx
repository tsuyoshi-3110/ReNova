import { AiScheduleResponse } from "@/types/pdf";

// AI工程表プレビューコンポーネント
function AiSchedulePreview({ data }: { data: unknown }) {
  const obj = data as AiScheduleResponse
  const sections = Array.isArray(obj?.sections) ? obj.sections : null;

  if (!sections) {
    // 想定と違う形の場合は JSON をそのまま表示（デバッグ用）
    return (
      <pre className="mt-1 p-2 border rounded bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-[11px] overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-2 max-h-80 overflow-auto text-xs">
      {sections.map((sec, i) => (
        <div
          key={sec.id ?? sec.title ?? i}
          className="border rounded p-2 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700"
        >
          <div className="font-semibold text-[12px] mb-1 text-gray-900 dark:text-gray-100">
            {sec.title ?? `工区${i + 1}`}
          </div>
          {Array.isArray(sec.items) && sec.items.length > 0 ? (
            <ul className="space-y-0.5">
              {sec.items.map((it, j) => (
                <li
                  key={it.id ?? `${i}-${j}`}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-gray-900 dark:text-gray-100">
                    {it.label ?? it.name ?? "工種"}
                    {typeof it.phase === "string" && it.phase
                      ? `（${it.phase}）`
                      : ""}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {typeof it.startOffset === "number" &&
                    typeof it.duration === "number"
                      ? `着手: ${it.startOffset}日目 / 期間: ${it.duration}日`
                      : typeof it.days === "number"
                      ? `期間: ${it.days}日`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[11px] text-gray-500 dark:text-gray-400">
              工種情報がありません。
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default AiSchedulePreview;
