// src/app/sum-quantity/materials/paint/[maker]/[specId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import {
  calcSpec,
  type AreaInput,
  type AreaKey,
} from "@/app/sum-quantity/materials/engine";
import { getNipponPaintSpec } from "@/app/sum-quantity/materials/specs/nippon";
import { getKansaiPaintSpec } from "@/app/sum-quantity/materials/specs/kansaiPaintSpecs";

type AggRow = {
  kind: "liquidKg";
  name: string;
  totalKg: number;
  qty: number | null;
  unitLabel: string | null;

  // ✅ 今回選択（または仕様既定）で使われた入目
  packKgUsed: number | null;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const STORAGE_KEY = "renova:paintCalc:saved:v1";

const EXCEL_SAVED_KEY = "renova_saved_excel_sums_v1";

type ExcelSavedSum = {
  id: string;
  savedAt: string; // ISO
  keyword1: string;
  keyword2: string;
  sumM2: number;
};

function isExcelSavedSum(v: unknown): v is ExcelSavedSum {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.savedAt === "string" &&
    typeof o.keyword1 === "string" &&
    typeof o.keyword2 === "string" &&
    typeof o.sumM2 === "number" &&
    Number.isFinite(o.sumM2)
  );
}

function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function readExcelSavedSumsFromStorage(): ExcelSavedSum[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(EXCEL_SAVED_KEY);
  const parsed = safeJsonParse<unknown>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const out: ExcelSavedSum[] = [];
  for (const it of parsed) {
    if (isExcelSavedSum(it)) out.push(it);
  }
  return out;
}

type SavedCalc = {
  id: string;
  savedAt: string; // ISO
  specId: string;
  displayName: string; // 保存用の仕様名
  areas: AreaInput;
  aggregated: AggRow[];
};

function uid() {
  return `lc_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function fmtDateTimeJp(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export default function PaintSpecCalcPage() {
  const p = useParams<{
    maker?: string | string[];
    specId?: string | string[];
  }>();

  const makerRaw = Array.isArray(p?.maker) ? p?.maker?.[0] : (p?.maker ?? "");
  const specIdRaw = Array.isArray(p?.specId)
    ? p?.specId?.[0]
    : (p?.specId ?? "");

  const maker = decodeURIComponent(makerRaw);
  const specId = decodeURIComponent(specIdRaw);

  const spec =
    maker === "nippon"
      ? getNipponPaintSpec(specId)
      : maker === "kansai"
        ? getKansaiPaintSpec(specId)
        : null;

  // ✅ AreaKey が flat/upstand/area を含む前提で「全キー」を持たせる
  const [areas, setAreas] = useState<Record<AreaKey, string>>({
    flat: "",
    upstand: "",
    area: "",
  });

  // ✅ 保存用の仕様名（初期は既定）
  const [saveSpecName, setSaveSpecName] = useState<string>("");

  useEffect(() => {
    if (!spec) return;
    setSaveSpecName((prev) => (prev.trim() ? prev : spec.displayName));
  }, [spec]);

  // ✅ 保存前に材料名を編集（key = kind::originalName）
  const [materialNameEdits, setMaterialNameEdits] = useState<
    Record<string, string>
  >({});

  // ✅ ユーザーが選んだ内容量(kg)で packKg を上書き（kind::元name）
  const [packKgOverrides, setPackKgOverrides] = useState<
    Record<string, number>
  >({});

  const areaNumbers = useMemo<AreaInput>(() => {
    const toNum = (s: string) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    return {
      flat: toNum(areas.flat),
      upstand: toNum(areas.upstand),
      area: toNum(areas.area),
    };
  }, [areas]);

  const validationError = useMemo(() => {
    if (!spec) return "仕様が見つかりません。";
    for (const f of spec.areaFields) {
      if (!f.required) continue;
      const v = areaNumbers[f.key];
      if (!(v > 0)) return `${f.label} を入力してください`;
    }
    return null;
  }, [spec, areaNumbers]);

  type CalcRow = ReturnType<typeof calcSpec>[number];

  const rows = useMemo<CalcRow[]>(() => {
    if (!spec) return [];
    return calcSpec(spec, areaNumbers);
  }, [spec, areaNumbers]);

  // spec.materials からメタ（packKg/ラベル/候補等）を引く
  const metas = useMemo(() => {
    const liquid = new Map<
      string,
      { packKg?: number; unitLabel?: string; packKgOptions?: number[] }
    >();

    if (!spec) return { liquid };

    for (const m of spec.materials) {
      if (m.kind === "liquidKg") {
        if (!liquid.has(m.name)) {
          liquid.set(m.name, {
            packKg: m.packKg,
            unitLabel: m.unitLabel,
            packKgOptions: (m as unknown as { packKgOptions?: number[] })
              .packKgOptions,
          });
        }
      }
    }
    return { liquid };
  }, [spec]);

  // ✅ 塗装：合計のみ（平場/立上りは使わない） + 入目選択対応
  const aggregated = useMemo<AggRow[]>(() => {
    if (!spec) return [];

    // 表示順: spec.materials の最初の登場順
    const orderedKeys: string[] = [];
    for (const m of spec.materials) {
      const k = `${m.kind}::${m.name}`;
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }

    const agg = new Map<string, AggRow>();

    for (const r of rows) {
      if (r.kind !== "liquidKg") continue;

      const k = `${r.kind}::${r.name}`;
      const prev = agg.get(k);

      const add = r.requiredKg ?? 0;

      const meta = metas.liquid.get(r.name);
      const unitLabel = meta?.unitLabel ?? null;

      const packKgBase = meta?.packKg && meta.packKg > 0 ? meta.packKg : null;

      const stableKey = `${r.kind}::${r.name}`;
      const packKgSelected = packKgOverrides[stableKey];

      const hasPackKgOptions =
        Array.isArray(meta?.packKgOptions) && meta.packKgOptions.length > 0;

      // ✅ 優先順：ユーザー選択(候補がある時のみ) > 仕様の packKg > null
      const packKg =
        hasPackKgOptions &&
        typeof packKgSelected === "number" &&
        Number.isFinite(packKgSelected) &&
        packKgSelected > 0
          ? packKgSelected
          : packKgBase;

      const packKgUsed = packKg ?? null;

      if (!prev) {
        const totalKg = round1(add);
        const qty = packKg ? Math.ceil(totalKg / packKg) : null;

        agg.set(k, {
          kind: "liquidKg",
          name: r.name,
          totalKg,
          qty,
          unitLabel,
          packKgUsed,
        });
      } else {
        const totalKg = round1(prev.totalKg + add);
        const qty = packKg ? Math.ceil(totalKg / packKg) : null;

        agg.set(k, {
          ...prev,
          totalKg,
          qty,
          unitLabel,
          packKgUsed,
        });
      }
    }

    const out: AggRow[] = [];
    for (const key of orderedKeys) {
      const v = agg.get(key);
      if (v) out.push(v);
    }
    return out;
  }, [rows, spec, metas, packKgOverrides]);

  // ✅ 反映（表示＆保存）
  // 重要：キーは「元の kind::元の name」で固定。名前を変えてもキーが変わらない。
  const aggregatedEdited = useMemo<AggRow[]>(() => {
    return aggregated.map((r) => {
      const key = `${r.kind}::${r.name}`;
      const v = materialNameEdits[key];
      const nextName = v != null && v.trim() ? v.trim() : r.name;
      if (nextName === r.name) return r;
      return { ...r, name: nextName };
    });
  }, [aggregated, materialNameEdits]);

  const canSave = !validationError && aggregatedEdited.length > 0;
  const [saveMsg, setSaveMsg] = useState<string>("");

  // ✅ Excelで保存した一覧（renova_saved_excel_sums_v1）をこのページ上部に表示
  const [excelSaved, setExcelSaved] = useState<ExcelSavedSum[]>([]);

  useEffect(() => {
    setExcelSaved(readExcelSavedSumsFromStorage());

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== EXCEL_SAVED_KEY) return;
      setExcelSaved(readExcelSavedSumsFromStorage());
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const onCopyExcelSumM2 = async (sumM2: number) => {
    const text = String(sumM2);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboardが使えない環境向けに、何もしない（要件外）
    }
  };

  const onSave = () => {
    if (!spec) return;
    if (!canSave) return;
    if (typeof window === "undefined") return;

    const displayName = saveSpecName.trim()
      ? saveSpecName.trim()
      : spec.displayName;

    const rec: SavedCalc = {
      id: uid(),
      savedAt: new Date().toISOString(),
      specId: spec.id,
      displayName,
      areas: areaNumbers,
      aggregated: aggregatedEdited,
    };

    const current = safeJsonParse<SavedCalc[]>(
      window.localStorage.getItem(STORAGE_KEY),
      [],
    );
    const list = Array.isArray(current) ? current : [];
    const next = [rec, ...list].slice(0, 50);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

    setSaveMsg(`保存しました（${fmtDateTimeJp(rec.savedAt)}）`);
  };

  // ✅ spec が無い場合でもクラッシュしない
  if (!spec) {
    return (
      <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
        <div className="max-w-3xl mx-auto p-6 space-y-3">
          <h1 className="text-xl font-extrabold">仕様が見つかりません</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            maker: <span className="font-bold">{makerRaw || "(none)"}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            specId: <span className="font-bold">{specId || "(none)"}</span>
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            対応する仕様が specs/{makerRaw}{" "}
            側の配列に入っているか確認してください。
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-100 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-extrabold">{spec.displayName}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            塗装は「面積1つ」で計算し、同じ材料は合計します
          </p>
        </header>

        {/* ✅ Excelで保存したデータ一覧（renova_saved_excel_sums_v1） */}
        {excelSaved.length > 0 ? (
          <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
            <div className="text-sm font-extrabold">
              Excel保存一覧（タップで㎡合計をコピー）
            </div>

            <div className="space-y-2">
              {excelSaved.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onCopyExcelSumM2(s.sumM2)}
                  className="w-full text-left rounded-lg border p-3 hover:opacity-90 dark:border-gray-800"
                  title="タップでコピー"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
                        {fmtDateTimeJp(s.savedAt)}
                      </div>
                      <div className="mt-1 text-sm font-extrabold truncate">
                        {s.keyword1}
                        {s.keyword2 ? ` / ${s.keyword2}` : ""}
                      </div>
                    </div>

                    <div className="shrink-0 text-sm font-extrabold">
                      {s.sumM2}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 入力（塗装は areaFields が 1 つ） */}
        <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-extrabold">施工数量（㎡）</div>

          <div className="grid gap-3">
            {spec.areaFields.map((f) => (
              <label key={f.key} className="grid gap-1">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                  {f.label}
                  {f.required ? "（必須）" : ""}
                </span>
                <input
                  inputMode="decimal"
                  className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                  value={areas[f.key] ?? ""}
                  onChange={(e) =>
                    setAreas((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  placeholder="例：120"
                />
              </label>
            ))}
          </div>

          {validationError && (
            <div className="text-xs font-bold text-red-600">
              {validationError}
            </div>
          )}
        </section>

        {/* 保存用の仕様名 */}
        <section className="rounded-xl border bg-white p-4 space-y-2 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-extrabold">仕様名</div>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
            value={saveSpecName}
            onChange={(e) => setSaveSpecName(e.target.value)}
            placeholder={spec.displayName}
          />
          <div className="text-xs text-gray-600 dark:text-gray-300">
            ※保存一覧に表示される仕様名です（必要なら編集）
          </div>
        </section>

        {/* 結果 */}
        <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-extrabold">必要数量表（合計）</div>

          <div className="grid gap-2">
            {aggregatedEdited.map((r, idx) => {
              // materialNameEdits / packKgOverrides のキーは「元の名前」で固定したいので
              // ここは aggregated[idx]（元）を基準にする
              const base = aggregated[idx];
              const stableKey = base
                ? `${base.kind}::${base.name}`
                : `${r.kind}::${r.name}`;

              return (
                <div
                  key={stableKey}
                  className="rounded-lg border p-3 dark:border-gray-800"
                >
                  <div className="text-sm font-extrabold">{r.name}</div>

                  {/* ✅ 材料名（編集して保存できる） */}
                  <div className="mt-2">
                    <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                      保存用の材料名
                    </div>
                    <input
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                      value={
                        materialNameEdits[stableKey] ?? base?.name ?? r.name
                      }
                      onChange={(e) =>
                        setMaterialNameEdits((prev) => ({
                          ...prev,
                          [stableKey]: e.target.value,
                        }))
                      }
                      placeholder={base?.name ?? r.name}
                    />
                  </div>

                  {/* ✅ 内容量（packKgOptions がある材料だけ表示） */}
                  {(() => {
                    const meta = metas.liquid.get(base?.name ?? r.name);
                    const specOpts = meta?.packKgOptions;

                    if (!Array.isArray(specOpts) || specOpts.length === 0) {
                      return null;
                    }

                    const basePackKg = meta?.packKg;

                    const options = Array.from(
                      new Set(
                        specOpts.filter(
                          (n) =>
                            typeof n === "number" &&
                            Number.isFinite(n) &&
                            n > 0,
                        ),
                      ),
                    ).sort((a, b) => a - b);

                    const selected = packKgOverrides[stableKey];

                    return (
                      <div className="mt-2">
                        <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                          内容量
                        </div>

                        <div className="mt-1 grid gap-1">
                          <select
                            className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                            value={
                              typeof selected === "number" &&
                              Number.isFinite(selected) &&
                              selected > 0
                                ? String(selected)
                                : ""
                            }
                            onChange={(e) => {
                              const v = e.target.value;
                              setPackKgOverrides((prev) => {
                                if (!v) {
                                  const rest = { ...prev };
                                  delete rest[stableKey];
                                  return rest;
                                }
                                const n = Number(v);
                                if (!Number.isFinite(n) || n <= 0) {
                                  const rest = { ...prev };
                                  delete rest[stableKey];
                                  return rest;
                                }
                                return { ...prev, [stableKey]: n };
                              });
                            }}
                          >
                            <option value="">
                              {typeof basePackKg === "number" &&
                              Number.isFinite(basePackKg) &&
                              basePackKg > 0
                                ? `${basePackKg}kg`
                                : "未設定"}
                            </option>
                            {options.map((n) => (
                              <option key={n} value={String(n)}>
                                {n}kg
                              </option>
                            ))}
                          </select>

                          <div className="text-xs text-gray-600 dark:text-gray-300">
                            ※選択すると缶数（qty）の計算に反映されます
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 合計表示 */}
                  {r.qty != null && r.unitLabel ? (
                    <>
                      <div className="mt-2 text-sm">
                        合計：<span className="font-extrabold">{r.qty}</span>
                        <span className="ml-1">{r.unitLabel}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        （合計重量：{r.totalKg} kg）
                      </div>
                      {typeof r.packKgUsed === "number" &&
                      Number.isFinite(r.packKgUsed) &&
                      r.packKgUsed > 0 ? (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          （入目：{r.packKgUsed} kg）
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <div className="mt-2 text-sm">
                        合計：
                        <span className="font-extrabold">{r.totalKg}</span> kg
                      </div>
                      {typeof r.packKgUsed === "number" &&
                      Number.isFinite(r.packKgUsed) &&
                      r.packKgUsed > 0 ? (
                        <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          （入目：{r.packKgUsed} kg）
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 保存 */}
        <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">計算結果の保存</div>

            <button
              type="button"
              onClick={onSave}
              disabled={!canSave}
              className={`rounded-lg px-4 py-2 text-sm font-extrabold transition border ${
                canSave
                  ? "bg-gray-900 text-white hover:opacity-90 dark:bg-gray-100 dark:text-gray-900"
                  : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
              }`}
            >
              計算結果を保存
            </button>
          </div>

          <div className="text-xs text-gray-600 dark:text-gray-300">
            保存した一覧は（後で）一覧画面から確認できます
          </div>

          {saveMsg && (
            <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
              {saveMsg}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
