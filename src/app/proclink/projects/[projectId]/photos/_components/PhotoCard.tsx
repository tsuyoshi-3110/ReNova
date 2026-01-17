// src/app/proclink/projects/[projectId]/photos/_components/PhotoCard.tsx
"use client";

import React, { useEffect, useState } from "react";
import type { PhotoDoc } from "../types";

type Props = {
  item: PhotoDoc;
  url: string | null;

  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;

  deleting: boolean;
  canDeleteThis: boolean;
  bulkBusy: boolean;

  onPressDownload: (p: PhotoDoc) => void;
  onDelete: (p: PhotoDoc) => void;
};

export default function PhotoCard({
  item,
  url,
  selectMode,
  selected,
  onToggleSelect,
  deleting,
  canDeleteThis,
  bulkBusy,
  onPressDownload,
  onDelete,
}: Props) {
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(() => {
    setImgLoading(false);
  }, [url]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => {
          if (selectMode) onToggleSelect(item.id);
        }}
        className="relative block w-full bg-gray-900"
        style={{ aspectRatio: "4 / 3" }}
      >
        {url ? (
          <>
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              onLoadStart={() => setImgLoading(true)}
              onLoad={() => setImgLoading(false)}
              onError={() => setImgLoading(false)}
            />

            {imgLoading && (
              <div className="absolute inset-0 grid place-items-center bg-black/40">
                <div className="text-sm font-extrabold text-white">
                  読み込み中...
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid h-full w-full place-items-center">
            <div className="text-sm font-extrabold text-gray-300">No Image</div>
          </div>
        )}

        {selectMode && (
          <div className="absolute right-3 top-3">
            <div
              className={[
                "grid h-8 w-8 place-items-center rounded-full border-2",
                selected
                  ? "bg-blue-600 border-white"
                  : "bg-black/30 border-white/80",
              ].join(" ")}
            >
              {selected && <div className="h-2 w-4 rotate-[-45deg] border-b-4 border-l-4 border-white" />}
            </div>
          </div>
        )}
      </button>

      <div className="flex items-center justify-end gap-2 p-3">
        <button
          type="button"
          onClick={() => onPressDownload(item)}
          disabled={bulkBusy}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          保存
        </button>

        {canDeleteThis && (
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={deleting || bulkBusy}
            className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? "削除中" : "削除"}
          </button>
        )}
      </div>
    </div>
  );
}
