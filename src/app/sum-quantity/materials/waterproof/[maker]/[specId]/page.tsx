// app/sum-quantity/materials/waterproof/[maker]/[specId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

import { calcSpec, type AreaKey } from "@/app/sum-quantity/materials/engine";
import {
  getWaterproofSpec,
  type WaterproofMaker,
} from "@/app/sum-quantity/materials/specs/waterproof";

type AggRow =
  | {
      kind: "liquidKg";
      name: string;
      flatKg: number;
      upstandKg: number;
      totalKg: number;
      qty: number | null;
      unitLabel: string | null;
      packKgUsed: number | null;
    }
  | {
      kind: "sheetRoll";
      name: string;
      flatRolls: number;
      upstandRolls: number;
      totalRolls: number;
      rollLabel: string;
    }
  | {
      kind: "jointTapeRoll";
      name: string;
      flatRolls: number;
      upstandRolls: number;
      totalRolls: number;
      rollLabel: string;
      jointLenM: number;
      tapeLengthM: number;
    }
  | {
      kind: "endTape";
      name: string;
      flatQty: number;
      upstandQty: number;
      totalQty: number;
      rollLabel: string;
      tapeLengthM: number;
      perimeterM: number;
    };

const STORAGE_KEY = "renova:waterproofCalc:saved:v1";

const EXCEL_SUMS_KEY = "renova_saved_excel_sums_v1";

type SavedExcelSum = {
  id?: string;
  savedAt?: string; // ISO
  keyword1?: string;
  keyword2?: string;
  sumM2?: number;
};

type SavedCalc = {
  id: string;
  savedAt: string; // ISO
  specId: string;
  displayName: string;
  areas: { flat: number; upstand: number; perimeter: number };
  aggregated: AggRow[];
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function safeJsonParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
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

export default function WaterproofSpecCalcPage() {
  const p = useParams<{
    maker?: string | string[];
    specId?: string | string[];
  }>();

  const makerRaw = Array.isArray(p?.maker) ? p?.maker?.[0] : (p?.maker ?? "");
  const specIdRaw = Array.isArray(p?.specId)
    ? p?.specId?.[0]
    : (p?.specId ?? "");

  const maker = decodeURIComponent(makerRaw) as WaterproofMaker;
  const specId = decodeURIComponent(specIdRaw);

  const spec = getWaterproofSpec(maker, specId);

  // 入力（flat/upstandだけ使う。engineのAreaKeyが他を含んでてもエラーにならないように保持）
  const [areas, setAreas] = useState<Record<AreaKey, string>>(() => {
    return {
      flat: "",
      upstand: "",
      perimeter: "",
    } as Record<AreaKey, string>;
  });

  // ✅ 保存用の仕様名（編集して保存できる）
  const [saveSpecName, setSaveSpecName] = useState<string>("");

  useEffect(() => {
    if (!spec) return;
    // 既にユーザーが入力していたら上書きしない
    setSaveSpecName((prev) => (prev.trim() ? prev : spec.displayName));
  }, [spec]);

  // ✅ 保存前に材料名を編集（キーは「元の kind + 元の name」で固定：ここが重要）
  const [materialNameEdits, setMaterialNameEdits] = useState<
    Record<string, string>
  >({});

  // ✅ ユーザーが選んだ内容量(kg)で packKg を上書きする（kind::元name で管理）
  const [packKgOverrides, setPackKgOverrides] = useState<
    Record<string, number>
  >({});

  const areaNumbers = useMemo(() => {
    const toNum = (s: string) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    };

    const flat = toNum(areas.flat ?? "");
    const upstand = toNum(areas.upstand ?? "");
    const perimeter = toNum(areas.perimeter ?? "");

    return {
      flat,
      upstand,
      perimeter,
    } as Record<AreaKey, number>;
  }, [areas]);

  const validationError = useMemo(() => {
    if (!spec) return "仕様が見つかりません。";
    for (const f of spec.areaFields) {
      if (!f.required) continue;
      const raw = (areas[f.key] ?? "").trim();
      if (raw === "") return `${f.label} を入力してください`;
    }
    return null;
  }, [spec, areas]);

  const rows = useMemo(() => {
    if (!spec) return [];
    return calcSpec(spec, areaNumbers);
  }, [spec, areaNumbers]);

  // 仕様のメタ（缶重量など）
  const metas = useMemo(() => {
    const liquid = new Map<
      string,
      { packKg?: number; unitLabel?: string; packKgOptions?: number[] }
    >();
    const sheet = new Map<string, { rollLabel?: string }>();
    const tape = new Map<
      string,
      { rollLabel?: string; tapeLengthM?: number }
    >();
    const endTape = new Map<
      string,
      { rollLabel?: string; tapeLengthM?: number }
    >();

    if (!spec) return { liquid, sheet, tape, endTape };

    for (const m of spec.materials) {
      if (m.kind === "liquidKg") {
        if (!liquid.has(m.name))
          liquid.set(m.name, {
            packKg: m.packKg,
            unitLabel: m.unitLabel,
            // ✅ 仕様側に候補配列が実装されたらここで拾えるようにしておく
            packKgOptions: (m as unknown as { packKgOptions?: number[] })
              .packKgOptions,
          });
      } else if (m.kind === "sheetRoll") {
        if (!sheet.has(m.name)) sheet.set(m.name, { rollLabel: m.rollLabel });
      } else if (m.kind === "jointTapeRoll") {
        if (!tape.has(m.name))
          tape.set(m.name, {
            rollLabel: m.rollLabel,
            tapeLengthM: m.tapeLengthM,
          });
      } else if (m.kind === "endTape") {
        if (!endTape.has(m.name)) {
          endTape.set(m.name, {
            rollLabel: m.rollLabel,
            tapeLengthM: m.tapeLengthM,
          });
        }
      }
    }
    return { liquid, sheet, tape, endTape };
  }, [spec]);

  // 集計（工程順・同一商品合計）
  const aggregated = useMemo<AggRow[]>(() => {
    if (!spec) return [];

    const orderedKeys: string[] = [];
    for (const m of spec.materials) {
      const k = `${m.kind}::${m.name}`;
      if (!orderedKeys.includes(k)) orderedKeys.push(k);
    }

    const agg = new Map<string, AggRow>();

    for (const r of rows) {
      const k = `${r.kind}::${r.name}`;
      const prev = agg.get(k);

      if (r.kind === "liquidKg") {
        const add = r.requiredKg ?? 0;

        const flatAdd = r.areaKey === "flat" ? add : 0;
        const upAdd = r.areaKey === "upstand" ? add : 0;

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

        // packKg を決めたあと
        const packKgUsed = packKg ?? null;

        if (!prev) {
          const totalKg = round1(add);
          const qty = packKg ? Math.ceil(totalKg / packKg) : null;

          agg.set(k, {
            kind: "liquidKg",
            name: r.name,
            flatKg: round1(flatAdd),
            upstandKg: round1(upAdd),
            totalKg,
            qty,
            unitLabel,
            packKgUsed, // ✅ 追加
          });
        } else if (prev.kind === "liquidKg") {
          const flatKg = round1(prev.flatKg + flatAdd);
          const upstandKg = round1(prev.upstandKg + upAdd);
          const totalKg = round1(prev.totalKg + add);
          const qty = packKg ? Math.ceil(totalKg / packKg) : null;

          agg.set(k, {
            ...prev,
            flatKg,
            upstandKg,
            totalKg,
            qty,
            unitLabel,
            packKgUsed, // ✅ 追加（上書きでOK）
          });
        }
        continue;
      }

      if (r.kind === "sheetRoll") {
        const add = r.rolls ?? 0;
        const flatAdd = r.areaKey === "flat" ? add : 0;
        const upAdd = r.areaKey === "upstand" ? add : 0;

        const rollLabel =
          metas.sheet.get(r.name)?.rollLabel ?? r.rollLabel ?? "巻";

        if (!prev) {
          agg.set(k, {
            kind: "sheetRoll",
            name: r.name,
            flatRolls: flatAdd,
            upstandRolls: upAdd,
            totalRolls: add,
            rollLabel,
          });
        } else if (prev.kind === "sheetRoll") {
          agg.set(k, {
            ...prev,
            flatRolls: prev.flatRolls + flatAdd,
            upstandRolls: prev.upstandRolls + upAdd,
            totalRolls: prev.totalRolls + add,
            rollLabel,
          });
        }
        continue;
      }

      // ✅ endTape が rows に混ざっても、このページでは perimeter から別計算するため無視する
      if (r.kind === "endTape") {
        continue;
      }

      // ✅ ここから jointTapeRoll
      if (r.kind === "jointTapeRoll") {
        const add = r.rolls ?? 0;
        const flatAdd = r.areaKey === "flat" ? add : 0;
        const upAdd = r.areaKey === "upstand" ? add : 0;

        const addJoint = r.jointLenM ?? 0;

        const meta = metas.tape.get(r.name);
        const rollLabel = meta?.rollLabel ?? r.rollLabel ?? "巻";
        const tapeLengthM = meta?.tapeLengthM ?? r.tapeLengthM ?? 0;

        if (!prev) {
          agg.set(k, {
            kind: "jointTapeRoll",
            name: r.name,
            flatRolls: flatAdd,
            upstandRolls: upAdd,
            totalRolls: add,
            rollLabel,
            jointLenM: round1(addJoint),
            tapeLengthM,
          });
        } else if (prev.kind === "jointTapeRoll") {
          agg.set(k, {
            ...prev,
            flatRolls: prev.flatRolls + flatAdd,
            upstandRolls: prev.upstandRolls + upAdd,
            totalRolls: prev.totalRolls + add,
            rollLabel,
            tapeLengthM,
            jointLenM: round1(prev.jointLenM + addJoint),
          });
        }
        continue;
      }
    }

    // endTape は「外周(m) / テープ長(m/巻)」で計算（engineのrowsには依存しない）
    const perimeterM = areaNumbers.perimeter ?? 0;
    if (perimeterM > 0) {
      for (const m of spec.materials) {
        if (m.kind !== "endTape") continue;

        const k = `${m.kind}::${m.name}`;

        // テープ長（m/巻）
        const meta = metas.endTape.get(m.name);
        const tapeLengthM = meta?.tapeLengthM ?? m.tapeLengthM ?? 0;
        if (!tapeLengthM || tapeLengthM <= 0) continue;

        const rollLabel = meta?.rollLabel ?? m.rollLabel ?? "巻";

        // 外周は「平場側」のみで計上（立上りは0固定）
        const totalQty = perimeterM / tapeLengthM;
        const flatQty = totalQty;
        const upstandQty = 0;

        const prev = agg.get(k);
        if (!prev) {
          agg.set(k, {
            kind: "endTape",
            name: m.name,
            flatQty,
            upstandQty,
            totalQty,
            rollLabel,
            tapeLengthM,
            perimeterM,
          });
        } else if (prev.kind === "endTape") {
          // 同名 endTape が複数定義されても合算できるようにする
          agg.set(k, {
            ...prev,
            flatQty: prev.flatQty + flatQty,
            upstandQty: prev.upstandQty + upstandQty,
            totalQty: prev.totalQty + totalQty,
            rollLabel,
            tapeLengthM,
            perimeterM,
          });
        }
      }
    }

    const out: AggRow[] = [];
    for (const k of orderedKeys) {
      const v = agg.get(k);
      if (v) out.push(v);
    }
    return out;
  }, [rows, spec, metas, areaNumbers, packKgOverrides]);

  // ✅ 編集後の材料名（保存に反映する）
  // 重要：キーは「元の kind::元の name」で固定。名前を変えてもキーが変わらない。
  const aggregatedEdited = useMemo<AggRow[]>(() => {
    return aggregated.map((r) => {
      const k = `${r.kind}::${r.name}`;
      const v = materialNameEdits[k];
      const nextName = v != null && v.trim() ? v.trim() : r.name;
      if (nextName === r.name) return r;
      return { ...r, name: nextName };
    });
  }, [aggregated, materialNameEdits]);

  const canSave = !validationError && aggregatedEdited.length > 0;
  const [saveMsg, setSaveMsg] = useState<string>("");

  // ✅ Excel集計の保存一覧（renova_saved_excel_sums_v1）をタイトル直下に表示
  const [excelSaved, setExcelSaved] = useState<SavedExcelSum[]>(() => {
    if (typeof window === "undefined") return [];
    const v = safeJsonParse<unknown>(
      window.localStorage.getItem(EXCEL_SUMS_KEY),
      [],
    );
    return Array.isArray(v) ? (v as SavedExcelSum[]) : [];
  });
  const [excelCopyMsg, setExcelCopyMsg] = useState<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const load = () => {
      const v = safeJsonParse<unknown>(
        window.localStorage.getItem(EXCEL_SUMS_KEY),
        [],
      );
      setExcelSaved(Array.isArray(v) ? (v as SavedExcelSum[]) : []);
    };

    load();

    const onStorage = (e: StorageEvent) => {
      if (e.key === EXCEL_SUMS_KEY) load();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // ✅ 保存メッセージは 3 秒後に自動で消す
  useEffect(() => {
    if (!saveMsg) return;
    const t = window.setTimeout(() => setSaveMsg(""), 3000);
    return () => window.clearTimeout(t);
  }, [saveMsg]);

  const copyExcelSavedLine = async (r: SavedExcelSum) => {
    try {
      const m2 =
        typeof r.sumM2 === "number" && Number.isFinite(r.sumM2)
          ? r.sumM2
          : null;

      if (m2 == null) {
        setExcelCopyMsg("コピーする数値がありません");
        window.setTimeout(() => setExcelCopyMsg(""), 1500);
        return;
      }

      await navigator.clipboard.writeText(String(m2));
      setExcelCopyMsg("数値をコピーしました");
      window.setTimeout(() => setExcelCopyMsg(""), 1500);
    } catch {
      setExcelCopyMsg("コピーに失敗しました");
      window.setTimeout(() => setExcelCopyMsg(""), 2000);
    }
  };

  const onSave = () => {
    if (!spec) return;
    if (!canSave) return;
    if (typeof window === "undefined") return;

    const displayName = saveSpecName.trim()
      ? saveSpecName.trim()
      : spec.displayName;

    const flat = areaNumbers.flat ?? 0;
    const upstand = areaNumbers.upstand ?? 0;
    const perimeter = areaNumbers.perimeter ?? 0;

    const rec: SavedCalc = {
      id: uid(),
      savedAt: new Date().toISOString(),
      specId: spec.id,
      displayName,
      areas: { flat, upstand, perimeter },
      aggregated: aggregatedEdited,
    };

    try {
      const current = safeJsonParse<SavedCalc[]>(
        window.localStorage.getItem(STORAGE_KEY),
        [],
      );
      const list = Array.isArray(current) ? current : [];
      const next = [rec, ...list].slice(0, 50);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaveMsg("計算結果を保存しました");
    } catch {
      setSaveMsg("保存に失敗しました");
    }
  };

  // ✅ spec が無い場合でもクラッシュしない（Hooksの後で分岐する）
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
        <header className="space-y-2">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold">{spec.displayName}</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              工程順で表示し、同じ商品は合計します
            </p>
          </div>

          {/* ✅ Excel集計 保存一覧（localStorage: renova_saved_excel_sums_v1） */}
          <div className="rounded-xl border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-extrabold">Excel集計 保存一覧</div>
              {excelCopyMsg ? (
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {excelCopyMsg}
                </div>
              ) : null}
            </div>

            {excelSaved.length === 0 ? (
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">
                （保存データがありません：renova_saved_excel_sums_v1）
              </div>
            ) : (
              <div className="mt-2 grid gap-2">
                {excelSaved.slice(0, 50).map((r, idx) => {
                  const when =
                    typeof r.savedAt === "string"
                      ? fmtDateTimeJp(r.savedAt)
                      : "";
                  const k1 = (r.keyword1 ?? "").trim();
                  const k2 = (r.keyword2 ?? "").trim();
                  const m2 =
                    typeof r.sumM2 === "number" && Number.isFinite(r.sumM2)
                      ? r.sumM2
                      : null;

                  return (
                    <button
                      key={`${r.id ?? "noid"}-${idx}`}
                      type="button"
                      onClick={() => void copyExcelSavedLine(r)}
                      className="w-full text-left rounded-lg border px-3 py-2 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                      title="タップでコピー"
                    >
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        {when ? when : "保存"}
                      </div>
                      <div className="mt-1 text-sm font-extrabold">
                        {k1 || k2 ? (
                          <>
                            {k1}
                            {k2 ? <span className="ml-2">{k2}</span> : null}
                          </>
                        ) : (
                          <span className="opacity-70">（キーワード不明）</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        {m2 != null ? `㎡換算 合計：${m2}` : "㎡換算 合計：-"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        {/* 入力 */}
        <section className="rounded-xl border bg-white p-4 space-y-3 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm font-extrabold">施工数量（㎡）</div>

          <div className="grid gap-3">
            {spec.areaFields
              .filter((f) => f.key !== "perimeter")
              .map((f) => (
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
                      setAreas((prev) => ({
                        ...prev,
                        [f.key]: e.target.value,
                      }))
                    }
                    placeholder="例：120"
                  />
                </label>
              ))}

            {(() => {
              const perimeterField = spec.areaFields.find(
                (f) => f.key === "perimeter",
              );
              const needsPerimeter =
                !!perimeterField ||
                spec.materials.some((m) => m.kind === "endTape");
              if (!needsPerimeter) return null;

              const label = perimeterField?.label ?? "外周（m）";
              const required = perimeterField?.required ?? false;

              return (
                <label className="grid gap-1">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                    {label}
                    {required ? "（必須）" : ""}
                  </span>
                  <input
                    inputMode="decimal"
                    className="w-full rounded-lg border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                    value={areas.perimeter ?? ""}
                    onChange={(e) =>
                      setAreas((prev) => ({
                        ...prev,
                        perimeter: e.target.value,
                      }))
                    }
                    placeholder="例：80"
                  />
                </label>
              );
            })()}
          </div>

          {validationError && (
            <div className="text-xs font-bold text-red-600">
              {validationError}
            </div>
          )}
        </section>

        {/* ✅ 仕様名（編集して保存できる） */}
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
          <div className="text-sm font-extrabold">
            必要数量表（工程順・合計）
          </div>

          <div className="grid gap-2">
            {aggregatedEdited.map((r, idx) => {
              // materialNameEdits のキーは「元の名前」で固定したいので、
              // ここは "aggregated[idx]"（元）を基準にする
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

                  {r.kind === "liquidKg" && (
                    <>
                      <div className="mt-2 text-sm">
                        平場：<span className="font-extrabold">{r.flatKg}</span>{" "}
                        kg
                        <span className="mx-2 text-gray-400">/</span>
                        立上り：
                        <span className="font-extrabold">{r.upstandKg}</span> kg
                      </div>

                      {/* ✅ 内容量：packKgOptions がある材料だけ表示 */}
                      {(() => {
                        const meta = metas.liquid.get(base?.name ?? r.name);
                        const specOpts = meta?.packKgOptions;

                        if (!Array.isArray(specOpts) || specOpts.length === 0)
                          return null;

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

                      {r.qty != null && r.unitLabel ? (
                        <>
                          <div className="mt-1 text-sm">
                            合計：
                            <span className="font-extrabold">{r.qty}</span>
                            <span className="ml-1">{r.unitLabel}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            （合計重量：{r.totalKg} kg）
                          </div>
                        </>
                      ) : (
                        <div className="mt-1 text-sm">
                          合計：
                          <span className="font-extrabold">{r.totalKg}</span> kg
                        </div>
                      )}
                    </>
                  )}

                  {r.kind === "sheetRoll" && (
                    <div className="mt-2 text-sm">
                      平場：
                      <span className="font-extrabold">
                        {round1(r.flatRolls)}
                      </span>{" "}
                      巻<span className="mx-2 text-gray-400">/</span>
                      立上り：
                      <span className="font-extrabold">
                        {round1(r.upstandRolls)}
                      </span>{" "}
                      巻
                      <div className="mt-1 text-sm">
                        合計：
                        <span className="font-extrabold">
                          {Math.ceil(r.totalRolls)}
                        </span>{" "}
                        {r.rollLabel}
                      </div>
                    </div>
                  )}

                  {r.kind === "jointTapeRoll" && (
                    <div className="mt-2 text-sm">
                      平場：
                      <span className="font-extrabold">
                        {round1(r.flatRolls)}
                      </span>{" "}
                      巻<span className="mx-2 text-gray-400">/</span>
                      立上り：
                      <span className="font-extrabold">
                        {round1(r.upstandRolls)}
                      </span>{" "}
                      巻
                      <div className="mt-1 text-sm">
                        合計：
                        <span className="font-extrabold">
                          {Math.ceil(r.totalRolls)}
                        </span>{" "}
                        {r.rollLabel}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        （ジョイント長：{round1(r.jointLenM)}m / テープ長：
                        {r.tapeLengthM}m）
                      </div>
                    </div>
                  )}

                  {/* endTape 表示ブロック */}
                  {r.kind === "endTape" && (
                    <div className="mt-2 text-sm">
                      平場：
                      <span className="font-extrabold">
                        {round1(r.flatQty)}
                      </span>{" "}
                      巻<span className="mx-2 text-gray-400">/</span>
                      立上り：
                      <span className="font-extrabold">
                        {round1(r.upstandQty)}
                      </span>{" "}
                      巻
                      <div className="mt-1 text-sm">
                        合計：
                        <span className="font-extrabold">
                          {Math.ceil(r.totalQty)}
                        </span>{" "}
                        {r.rollLabel}
                      </div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        （外周：{round1(r.perimeterM)}m / テープ長：
                        {r.tapeLengthM}m）
                      </div>
                    </div>
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
