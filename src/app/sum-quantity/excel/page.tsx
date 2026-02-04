"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ExcelCodesOk,
  ExcelSheetsOk,
  ExcelSumOk,
  ExcelSumPreviewRow,
  SavedExcelSum,
} from "@/app/features/excel-sum/types";

import {
  formatDateTimeJa,
  formatNumber,
  hasRequiredManualCols,
  isDetectColsOk,
  isOkResponse,
  isValid1BasedInt,
  normalizeUnit,
  recomputeSumsByUnit,
  toPositiveNumberOrNull,
} from "@/app/features/excel-sum/utils";

import {
  formatSize,
  guessDefaultCalcM,
  guessDefaultCalcM2PerEach,
} from "@/app/features/excel-sum/size";

import {
  loadSavedExcelSums,
  makeId,
  saveSavedExcelSums,
} from "@/app/features/excel-sum/storage";

export default function Page() {
  const SAVED_EXCEL_SUM_KEY = "renova_saved_excel_sums_v1";

  // -------- Excel ----------
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSelectedName, setExcelSelectedName] = useState<string>("");
  const [excelImported, setExcelImported] = useState(false);

  const [excelCode, setExcelCode] = useState("防-1");

  const [excelCodes, setExcelCodes] = useState<string[]>([]);
  const [excelCodesLoading, setExcelCodesLoading] = useState(false);
  const [excelCodesError, setExcelCodesError] = useState<string | null>(null);

  // ✅ B案：シート選択（先頭シートが「鏡」でも確実に対応する）
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([]);
  const [excelSheetName, setExcelSheetName] = useState<string>("");
  const [excelSheetLoading, setExcelSheetLoading] = useState(false);
  const [excelSheetError, setExcelSheetError] = useState<string | null>(null);

  const [excelLoading, setExcelLoading] = useState(false);
  const [excelError, setExcelError] = useState<string | null>(null);

  // ✅ ①結果（一覧）
  const [excelResult, setExcelResult] = useState<ExcelSumOk | null>(null);

  // ✅ ②キーワード
  const [excelKeyword2, setExcelKeyword2] = useState("");
  const [excelKeyword2Loading, setExcelKeyword2Loading] = useState(false);
  const [excelKeyword2Error, setExcelKeyword2Error] = useState<string | null>(
    null,
  );

  // ✅ ③除外キーワード（表示から除外したい行）
  const [excelExcludeKeyword, setExcelExcludeKeyword] = useState("");
  // ✅ ③除外キーワード（②を押した時に反映する用）
  const [excelExcludeKeywordApplied, setExcelExcludeKeywordApplied] = useState("");

  // ★ 要件：このExcel想定の初期値（1始まり）
  const [itemCol1Based, setItemCol1Based] = useState(""); // 品名
  const [descCol1Based, setDescCol1Based] = useState(""); // 摘要
  const [qtyCol1Based, setQtyCol1Based] = useState(""); // 数量
  const [unitCol1Based, setUnitCol1Based] = useState(""); // 単位
  const [sizeCol1Based, setSizeCol1Based] = useState(""); // サイズ抽出元（例：摘要=8 / 備考などに変更可）
  const [manualColsError, setManualColsError] = useState<string | null>(null);

  // ★ 金額 0 / 空 行の除外（任意）
  const [hideZeroAmount, setHideZeroAmount] = useState(false);
  const [amountCol1Based, setAmountCol1Based] = useState(""); // 金額 列（1始まり）
  const [amountColError, setAmountColError] = useState<string | null>(null);

  // ★ 各行の「計算に使う値」入力（1つだけ）
  // - 単位=m  → 入力は m
  // - 単位=箇所 → 入力は ㎡/箇所
  const [calcMmByRow, setCalcMmByRow] = useState<Record<number, string>>({});

  // -------- 保存（local） ----------
  const [savedSums, setSavedSums] = useState<SavedExcelSum[]>([]);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // ✅ 列自動検出
  const [autoDetectLoading, setAutoDetectLoading] = useState(false);
  const [autoDetectError, setAutoDetectError] = useState<string | null>(null);

  // ✅ Excel選択＆シート確定後に「列を自動で拾う」を1回だけ自動実行するためのフラグ
  const [didAutoDetectCols, setDidAutoDetectCols] = useState(false);

  // ✅ 保存メッセージは 3 秒後に自動で消す
  useEffect(() => {
    if (!saveMsg) return;
    const t = window.setTimeout(() => setSaveMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [saveMsg]);

  // 列指定がすべて入力済みかつ金額除外条件も満たすか
  const colsReady = useMemo(() => {
    const baseOk = hasRequiredManualCols(
      itemCol1Based,
      descCol1Based,
      qtyCol1Based,
      unitCol1Based,
      sizeCol1Based,
    );
    if (!baseOk) return false;
    if (!hideZeroAmount) return true;
    return isValid1BasedInt(amountCol1Based);
  }, [
    itemCol1Based,
    descCol1Based,
    qtyCol1Based,
    unitCol1Based,
    sizeCol1Based,
    hideZeroAmount,
    amountCol1Based,
  ]);

  useEffect(() => {
    setSavedSums(loadSavedExcelSums(SAVED_EXCEL_SUM_KEY));
  }, []);

  const validateManualCols = useCallback((): boolean => {
    const required = [
      itemCol1Based,
      descCol1Based,
      qtyCol1Based,
      unitCol1Based,
      sizeCol1Based,
    ];

    for (const v of required) {
      if (!isValid1BasedInt(v)) {
        setManualColsError(
          "列指定の場合、品名・摘要・数量・単位・サイズ列は 1,2,3... の整数で指定してください",
        );
        return false;
      }
    }

    // 金額除外がONの場合は、金額列の指定が必須
    if (hideZeroAmount) {
      if (!isValid1BasedInt(amountCol1Based)) {
        setAmountColError(
          "金額を除外する場合、金額 列を 1,2,3... の整数で指定してください",
        );
        return false;
      }
      setAmountColError(null);
    } else {
      setAmountColError(null);
    }

    setManualColsError(null);
    return true;
  }, [
    itemCol1Based,
    descCol1Based,
    qtyCol1Based,
    unitCol1Based,
    sizeCol1Based,
    hideZeroAmount,
    amountCol1Based,
  ]);

  const appendManualCols = useCallback(
    (fd: FormData) => {
      // ✅ 列指定は常に必須
      fd.append("useManualCols", "1");
      // ✅ 1始まりで送る（API側で 0始まりに変換する前提）
      fd.append("itemCol", itemCol1Based);
      fd.append("descCol", descCol1Based);
      fd.append("qtyCol", qtyCol1Based);
      fd.append("unitCol", unitCol1Based);
      fd.append("sizeCol", sizeCol1Based);
    },
    [itemCol1Based, descCol1Based, qtyCol1Based, unitCol1Based, sizeCol1Based],
  );

  const appendAmountFilter = useCallback(
    (fd: FormData) => {
      if (!hideZeroAmount) return;
      // API側のフラグ（true で amount==null/0 を除外）
      fd.append("hideZeroAmount", "true");
      // 1始まりで送る（API側で0始まりに変換される想定）
      fd.append("amountCol", amountCol1Based);
    },
    [hideZeroAmount, amountCol1Based],
  );

  const appendAiSizeFlags = useCallback((fd: FormData) => {
    // ✅ サイズ抽出は常にAI（UIで切り替えない）
    fd.append("useAiSize", "1");

    // ✅ 上限も固定で十分大きく（実運用は100行程度想定だが、保険で大きめ）
    //    API側でも最終ガードがある想定。
    fd.append("sizeAiMax", "2000");
  }, []);

  const fetchExcelCodes = useCallback(
    async (f: File) => {
      setExcelCodesLoading(true);
      setExcelCodesError(null);

      try {
        const fd = new FormData();
        fd.append("file", f);
        if (excelSheetName) fd.append("sheetName", excelSheetName);

        const res = await fetch("/api/excel-codes", {
          method: "POST",
          body: fd,
        });

        const data: unknown = await res.json();

        if (isOkResponse<ExcelCodesOk>(data) && Array.isArray(data.codes)) {
          const list = data.codes.filter((x) => typeof x === "string");
          setExcelCodes(list);
          if (list.length > 0) setExcelCode(list[0]);
          return;
        }

        const errMsg =
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "候補抽出に失敗しました";
        setExcelCodes([]);
        setExcelCodesError(errMsg);
      } catch (e: unknown) {
        setExcelCodes([]);
        setExcelCodesError(e instanceof Error ? e.message : "unknown error");
      } finally {
        setExcelCodesLoading(false);
      }
    },
    [excelSheetName],
  );

  const fetchExcelSheets = useCallback(async (f: File) => {
    setExcelSheetLoading(true);
    setExcelSheetError(null);

    try {
      const fd = new FormData();
      fd.append("file", f);

      const res = await fetch("/api/excel-sheets", {
        method: "POST",
        body: fd,
      });

      const data: unknown = await res.json();

      if (isOkResponse<ExcelSheetsOk>(data) && Array.isArray(data.sheetNames)) {
        const list = data.sheetNames.filter(
          (x) => typeof x === "string" && x.trim() !== "",
        );

        setExcelSheetNames(list);

        // 初期は先頭。必要ならユーザーが変更
        if (list.length > 0) setExcelSheetName(list[0]);
        else setExcelSheetName("");

        return;
      }

      const errMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "シート一覧取得に失敗しました";

      setExcelSheetNames([]);
      setExcelSheetName("");
      setExcelSheetError(errMsg);
    } catch (e: unknown) {
      setExcelSheetNames([]);
      setExcelSheetName("");
      setExcelSheetError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setExcelSheetLoading(false);
    }
  }, []);

  const autoDetectCols = useCallback(async () => {
    setAutoDetectError(null);

    if (!excelFile) {
      setAutoDetectError("Excelファイルを選択してください");
      return;
    }
    if (!excelSheetName) {
      setAutoDetectError("シートを選択してください");
      return;
    }

    setAutoDetectLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", excelFile);
      fd.append("sheetName", excelSheetName);

      const res = await fetch("/api/excel-detect-cols-ai", {
        method: "POST",
        body: fd,
      });

      const data: unknown = await res.json();

      if (isDetectColsOk(data)) {
        const cols = data.detectedCols;

        // ✅ 1-based の文字列でセット
        setItemCol1Based(String(cols.item));
        setDescCol1Based(String(cols.desc));
        setQtyCol1Based(String(cols.qty));
        setUnitCol1Based(String(cols.unit));
        setSizeCol1Based(String(cols.size));

        // amount は取れた時だけ入れる（任意）
        if (cols.amount != null) {
          setAmountCol1Based(String(cols.amount));
        }

        // 既存のエラー表示を消す
        setManualColsError(null);
        setAmountColError(null);
        return;
      }

      const errMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "自動検出に失敗しました";
      setAutoDetectError(errMsg);
    } catch (e: unknown) {
      setAutoDetectError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setAutoDetectLoading(false);
    }
  }, [excelFile, excelSheetName]);

  // ✅ Excelファイル選択 + シート確定後に「列を自動で拾う」を自動実行（1回だけ）
  useEffect(() => {
    if (!excelFile) return;
    if (!excelSheetName) return;
    if (didAutoDetectCols) return;

    setDidAutoDetectCols(true);
    autoDetectCols();
  }, [excelFile, excelSheetName, didAutoDetectCols, autoDetectCols]);

  const importExcel = useCallback(async () => {
    setExcelError(null);
    setExcelCodesError(null);

    if (!excelFile) {
      setExcelError("Excelファイルを選択してください");
      return;
    }
    if (!excelSheetName) {
      setExcelError("シートを選択してください");
      return;
    }

    await fetchExcelCodes(excelFile);
    setExcelImported(true);

    // ✅ 取り込みし直し時は、絞り込み状態をリセット
    setExcelResult(null);
    setExcelKeyword2("");
    setExcelKeyword2Error(null);
    setExcelExcludeKeyword("");
    setExcelExcludeKeywordApplied("");

    // ✅ 入力もリセット（別ファイルのrowIndexと混ざるの防止）
    setCalcMmByRow({});
  }, [excelFile, excelSheetName, fetchExcelCodes]);

  // ✅ ①（キーワード1 = excelCode）で絞り込み
  const runExcelSum = useCallback(async () => {
    setExcelError(null);
    setExcelKeyword2Error(null);
    setExcelResult(null);
    setExcelKeyword2("");
    setExcelExcludeKeyword("");
    setExcelExcludeKeywordApplied("");

    if (!excelFile) {
      setExcelError("Excelファイルを選択してください");
      return;
    }
    if (!excelSheetName) {
      setExcelError("シートを選択してください");
      return;
    }

    const code = excelCode.trim();
    if (!code) {
      setExcelError("キーワード1を入力してください（例：防-1）");
      return;
    }

    if (!validateManualCols()) return;

    setExcelLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", excelFile);
      fd.append("sheetName", excelSheetName);

      // ✅ 検索キー（①）
      fd.append("query", code);
      fd.append("code", code);

      // ✅ 手動列指定
      appendManualCols(fd);
      // ✅ 金額0/空除外（任意）
      appendAmountFilter(fd);
      // ✅ サイズ抽出はAIに任せる（フォールバックではなく100%）
      appendAiSizeFlags(fd);

      const res = await fetch("/api/excel-sum", {
        method: "POST",
        body: fd,
      });

      const data: unknown = await res.json();

      if (isOkResponse<ExcelSumOk>(data)) {
        const sums =
          typeof data.sumsByUnit === "object" && data.sumsByUnit !== null
            ? data.sumsByUnit
            : {};

        setExcelResult({
          ok: true,
          query: data.query,
          matchedCount: data.matchedCount,
          sumsByUnit: sums,
          sumM2: data.sumM2,
          preview: Array.isArray(data.preview) ? data.preview : [],
          detectedCols:
            typeof data.detectedCols === "object" && data.detectedCols !== null
              ? (data.detectedCols as ExcelSumOk["detectedCols"])
              : undefined,
        });
        return;
      }

      const errMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "不明なエラー";
      setExcelError(errMsg);
    } catch (e: unknown) {
      setExcelError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setExcelLoading(false);
    }
  }, [
    excelCode,
    excelFile,
    excelSheetName,
    validateManualCols,
    appendManualCols,
    appendAmountFilter,
    appendAiSizeFlags,
  ]);

  // --- Search helpers (keyword2 / exclude keyword) ---
  function normalizeForSearch(input: string): string {
    const nfkc = input.normalize("NFKC");
    return nfkc
      .replace(/\s+/g, "")
      .replace(/[－―ー−]/g, "-")
      .replace(/＝/g, "=")
      .toLowerCase();
  }

  function isJapaneseToken(s: string): boolean {
    return /[\u3040-\u30FF\u4E00-\u9FFF々]/.test(s);
  }

  // スペース区切り → OR 用トークン（短すぎ英数字は除外）
  function splitKeywords(raw: string): string[] {
    const parts = raw
      .trim()
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const tokens = parts
      .map((p) => normalizeForSearch(p))
      .filter((t) => {
        if (!t) return false;
        if (isJapaneseToken(t)) return true;
        return t.length >= 2;
      });

    return Array.from(new Set(tokens));
  }

  function rowTextForMatch(r: ExcelSumPreviewRow): string {
    return normalizeForSearch(`${r.item ?? ""} ${r.desc ?? ""} ${r.unit ?? ""}`);
  }

  function includesAnyToken(textNorm: string, tokens: string[]): boolean {
    if (tokens.length === 0) return true;
    return tokens.some((t) => textNorm.includes(t));
  }

  // ✅ ②（キーワード2でさらに絞り込み）
  const runExcelSum2 = useCallback(async () => {
    setExcelKeyword2Error(null);

    if (!excelFile) {
      setExcelKeyword2Error("Excelファイルを選択してください");
      return;
    }
    if (!excelSheetName) {
      setExcelKeyword2Error("シートを選択してください");
      return;
    }

    const code = excelCode.trim();
    if (!code) {
      setExcelKeyword2Error("先にキーワード1を入力してください");
      return;
    }

    if (!excelResult) {
      setExcelKeyword2Error("先にキーワード1で絞り込んで一覧を出してください");
      return;
    }

    const k2 = excelKeyword2.trim();
    if (!k2) {
      setExcelKeyword2Error("キーワード2を入力してください");
      return;
    }

    if (!validateManualCols()) return;

    const k2Tokens = splitKeywords(k2);
    if (k2Tokens.length === 0) {
      setExcelKeyword2Error("キーワード2を入力してください");
      return;
    }

    // ✅ 除外キーワードは「②を押した時点の入力」を反映（入力中のライブ反映はしない）
    setExcelExcludeKeywordApplied(excelExcludeKeyword.trim());

    setExcelKeyword2Loading(true);
    try {
      const fd = new FormData();
      fd.append("file", excelFile);
      fd.append("sheetName", excelSheetName);

      // ✅ ②は OR 検索したいので、API には「①だけ」を投げて母集合を取る
      fd.append("query", code);
      fd.append("code", code);

      appendManualCols(fd);
      appendAmountFilter(fd);
      // ✅ サイズ抽出はAIに任せる（フォールバックではなく100%）
      appendAiSizeFlags(fd);

      const res = await fetch("/api/excel-sum", {
        method: "POST",
        body: fd,
      });

      const data: unknown = await res.json();

      if (isOkResponse<ExcelSumOk>(data)) {
        const previewAll: ExcelSumPreviewRow[] = Array.isArray(data.preview)
          ? (data.preview as ExcelSumPreviewRow[])
          : [];

        // ✅ OR フィルタ
        const filtered = previewAll.filter((r) => {
          const text = rowTextForMatch(r);
          return includesAnyToken(text, k2Tokens);
        });

        // ✅ sumsByUnit 再計算（表示用）
        const sums: Record<string, number> = {};
        for (const r of filtered) {
          const u = typeof r.unit === "string" ? normalizeUnit(r.unit) : "";
          const q =
            typeof r.qty === "number" && Number.isFinite(r.qty) ? r.qty : null;
          if (!u || q == null) continue;
          sums[u] = (sums[u] ?? 0) + q;
        }

        // ✅ sumM2 は「API値」ではなく表示用に合わせる（既存の client 合計はそのまま機能する）
        //    ここは UI の "API計算値" 表示に使ってるだけなので 0 にするか、filtered の calcM2 を合算する
        let sumM2Filtered = 0;
        for (const r of filtered) {
          if (typeof r.calcM2 === "number" && Number.isFinite(r.calcM2)) {
            sumM2Filtered += r.calcM2;
          }
        }

        setExcelResult({
          ok: true,
          query: `${code} (k2 OR: ${k2Tokens.join(" ")})`,
          matchedCount: filtered.length,
          sumsByUnit: sums,
          sumM2: sumM2Filtered,
          preview: filtered,
          detectedCols:
            typeof data.detectedCols === "object" && data.detectedCols !== null
              ? (data.detectedCols as ExcelSumOk["detectedCols"])
              : undefined,
        });
        return;
      }

      const errMsg =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof (data as { error: unknown }).error === "string"
          ? (data as { error: string }).error
          : "不明なエラー";
      setExcelKeyword2Error(errMsg);
    } catch (e: unknown) {
      setExcelKeyword2Error(e instanceof Error ? e.message : "unknown error");
    } finally {
      setExcelKeyword2Loading(false);
    }
  }, [
    excelCode,
    excelFile,
    excelSheetName,
    excelKeyword2,
    excelExcludeKeyword,
    excelResult,
    validateManualCols,
    appendManualCols,
    appendAmountFilter,
    appendAiSizeFlags,
  ]);

  // ✅ 除外キーワード（ORで除外）を適用したプレビュー
  const filteredPreview = useMemo(() => {
    if (!excelResult) return [] as ExcelSumPreviewRow[];

    const ex = excelExcludeKeywordApplied.trim();
    if (!ex) return excelResult.preview;

    const exTokens = splitKeywords(ex);
    if (exTokens.length === 0) return excelResult.preview;

    return excelResult.preview.filter((r) => {
      const text = rowTextForMatch(r);
      // OR: どれか1つでも含むなら除外
      return !includesAnyToken(text, exTokens);
    });
  }, [excelResult, excelExcludeKeywordApplied]);

  // ✅ 単位別合計（表示用：除外後）
  const sumsByUnit = useMemo(() => {
    return recomputeSumsByUnit(filteredPreview);
  }, [filteredPreview]);

  // ✅ 既に㎡の行（単位=㎡）の㎡値（最優先：qty、それが無ければcalcM2）
  const getM2Already = useCallback((r: ExcelSumPreviewRow): number | null => {
    const unit = normalizeUnit(r.unit ?? "");
    if (unit !== "㎡") return null;

    if (typeof r.qty === "number" && Number.isFinite(r.qty)) {
      return r.qty;
    }
    if (typeof r.calcM2 === "number" && Number.isFinite(r.calcM2)) {
      return r.calcM2;
    }
    return null;
  }, []);

  // ✅ デフォルトの「使用(m)」をフロント側でも確実に算出する（新：hasExplicitSizeTextフラグ対応）
  const getDefaultMForRow = useCallback(
    (r: ExcelSumPreviewRow, hasExplicitSizeText: boolean): number | null => {
      // ✅ サイズ文字列が無いのに heightMm 等だけが入っているケースは信用しない
      // ✅ 箇所は事故が多いので、自動推定はしない（入力必須）
      if (!hasExplicitSizeText) {
        return null;
      }

      // ✅ ガード：数量(m)を誤って「H=...」として拾ってしまうケースを弾く
      // 例）数量=58.8m → H=58800mm のような異常値
      const MAX_HEIGHT_MM = 5000; // 立上り等の現実的上限（必要なら後で調整）

      const h =
        typeof r.heightMm === "number" && Number.isFinite(r.heightMm)
          ? r.heightMm
          : null;
      const o =
        typeof r.overlapMm === "number" && Number.isFinite(r.overlapMm)
          ? r.overlapMm
          : null;

      if (h != null) {
        // 異常に大きいHは無効扱いにして推定へフォールバック
        if (h <= 0 || h > MAX_HEIGHT_MM) {
          return guessDefaultCalcM(r);
        }

        const mm = h + (o ?? 0);
        if (mm <= 0) return null;
        // 小数が暴れないよう 3桁で丸め
        return Number((mm / 1000).toFixed(3));
      }

      return guessDefaultCalcM(r);
    },
    [],
  );

  // ✅ 箇所のデフォルト（㎡/箇所）（新：hasExplicitSizeTextフラグ対応）
  const getDefaultM2EachForRow = useCallback(
    (r: ExcelSumPreviewRow, hasExplicitSizeText: boolean): number | null => {
      // ✅ 方針：m 以外はサイズ自動抽出しない
      // 箇所は事故が多いので、サイズ文字列が無い場合は自動推定しない（入力必須）
      if (!hasExplicitSizeText) {
        return null;
      }

      const w =
        typeof r.wideMm === "number" && Number.isFinite(r.wideMm)
          ? r.wideMm
          : null;
      const l =
        typeof r.lengthMm === "number" && Number.isFinite(r.lengthMm)
          ? r.lengthMm
          : null;

      if (w != null && l != null) {
        const m2 = (w * l) / 1_000_000;
        if (m2 <= 0) return null;
        return Number(m2.toFixed(3));
      }

      // 明示サイズが無いなら上で null。ここも推定はしない。
      return null;
    },
    [],
  );

  // ✅ 入力1つで㎡換算（m / 箇所 / その他）＋ ㎡はそのまま
  const calcM2FromInputOrExisting = useCallback(
    (r: ExcelSumPreviewRow): number | null => {
      const unit = normalizeUnit(r.unit ?? "");

      // (C) ㎡ → そのまま表示
      if (unit === "㎡") {
        return getM2Already(r);
      }

      if (typeof r.qty !== "number" || !Number.isFinite(r.qty)) return null;

      const input = calcMmByRow[r.rowIndex] ?? "";
      const n = toPositiveNumberOrNull(input);

      // (A) m → 入力(m)で qty(m) * m
      if (unit === "m") {
        const hasExplicitSizeText = Boolean(formatSize(r));
        const m = n ?? getDefaultMForRow(r, hasExplicitSizeText);
        if (m == null) return null;
        if (m === 0) return 0;
        const m2 = r.qty * m;
        return Number.isFinite(m2) ? m2 : null;
      }

      // (B) 箇所 → 入力(㎡/箇所)のみ（自動推定しない）
      if (unit === "箇所") {
        if (n == null) return null;
        if (n === 0) return 0;
        const m2 = r.qty * n;
        return Number.isFinite(m2) ? m2 : null;
      }

      // (D) その他 → 入力を「㎡/単位」とみなして qty * 入力
      if (n == null) return null;
      const m2 = r.qty * n;
      return Number.isFinite(m2) ? m2 : null;
    },
    [calcMmByRow, getM2Already, getDefaultMForRow, getDefaultM2EachForRow],
  );

  // --- Helpers for recalculating client-side ㎡合計 after row deletion ---
  function calcM2FromInputOrExistingWithMap(
    r: ExcelSumPreviewRow,
    calcMap: Record<number, string>,
  ): number | null {
    const unit = normalizeUnit(r.unit ?? "");

    // ㎡ → qty をそのまま採用（なければ calcM2）
    if (unit === "㎡") {
      if (typeof r.qty === "number" && Number.isFinite(r.qty)) return r.qty;
      if (typeof r.calcM2 === "number" && Number.isFinite(r.calcM2))
        return r.calcM2;
      return null;
    }

    if (typeof r.qty !== "number" || !Number.isFinite(r.qty)) return null;

    const input = calcMap[r.rowIndex] ?? "";
    const n = toPositiveNumberOrNull(input);

    // m → 入力(m) or 推定(m)
    if (unit === "m") {
      const MAX_HEIGHT_MM = 5000;

      const hasExplicitSizeText = Boolean(formatSize(r));

      const m =
        n ??
        (hasExplicitSizeText &&
        typeof r.heightMm === "number" &&
        Number.isFinite(r.heightMm) &&
        r.heightMm > 0 &&
        r.heightMm <= MAX_HEIGHT_MM
          ? Number(
              (
                (r.heightMm +
                  (typeof r.overlapMm === "number" &&
                  Number.isFinite(r.overlapMm)
                    ? r.overlapMm
                    : 0)) /
                1000
              ).toFixed(3),
            )
          : guessDefaultCalcM(r));
      if (m == null) return null;
      if (m === 0) return 0;
      const m2 = r.qty * m;
      return Number.isFinite(m2) ? m2 : null;
    }

    // 箇所 → 入力(㎡/箇所)のみ（推定しない）
    if (unit === "箇所") {
      if (n == null) return null;
      if (n === 0) return 0;
      const m2 = r.qty * n;
      return Number.isFinite(m2) ? m2 : null;
    }

    // その他 → 入力を「㎡/単位」とみなす
    if (n == null) return null;
    const m2 = r.qty * n;
    return Number.isFinite(m2) ? m2 : null;
  }

  function computeSumM2ClientWithMap(
    preview: ExcelSumPreviewRow[],
    calcMap: Record<number, string>,
  ): number {
    let sum = 0;
    for (const r of preview) {
      const v = calcM2FromInputOrExistingWithMap(r, calcMap);
      if (typeof v === "number" && Number.isFinite(v)) sum += v;
    }
    return sum;
  }

  // ✅ 「現在表示されている換算㎡」の合計（m/箇所/㎡ ぜんぶ）
  const sumM2Client = useMemo(() => {
    if (!excelResult) return 0;
    let sum = 0;
    for (const r of filteredPreview) {
      const v = calcM2FromInputOrExisting(r);
      if (typeof v === "number") sum += v;
    }
    return sum;
  }, [excelResult, filteredPreview, calcM2FromInputOrExisting]);

  const saveCurrentResult = useCallback(() => {
    setSaveMsg(null);

    if (!excelResult) {
      setSaveMsg("先に①/②で結果を表示してください");
      return;
    }

    const k1 = excelCode.trim();
    if (!k1) {
      setSaveMsg("キーワード1が空です");
      return;
    }

    const k2 = excelKeyword2.trim(); // 空でも保存はできる仕様にしておく

    // ✅ 保存時は小数点第2位で四捨五入して保存（表示はそのまま）
    const sumM2Rounded = Math.round(sumM2Client * 100) / 100;

    const item: SavedExcelSum = {
      id: makeId(),
      savedAt: new Date().toISOString(),
      fileName: excelSelectedName || undefined,
      keyword1: k1,
      keyword2: k2,
      sumM2: sumM2Rounded,
      matchedCount: excelResult.matchedCount,
      query: excelResult.query,
    };

    const next = [item, ...savedSums];
    setSavedSums(next);
    saveSavedExcelSums(SAVED_EXCEL_SUM_KEY, next);
    setSaveMsg("保存しました");
  }, [
    excelResult,
    excelCode,
    excelKeyword2,
    excelSelectedName,
    sumM2Client,
    savedSums,
  ]);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6 min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Excel */}
      <section className="rounded-lg border bg-white p-4 dark:border-gray-800 dark:bg-gray-900 space-y-3">
        <div className="text-sm font-extrabold">
          Excel 集計（仕様コードで合算）
        </div>

        <div className="flex items-center gap-3">
          <label
            htmlFor="excelFileInput"
            className="inline-flex items-center justify-center rounded px-4 py-2 text-sm font-extrabold bg-black text-white cursor-pointer hover:opacity-90"
          >
            Excelを選択
          </label>

          <div className="min-w-0 text-xs opacity-80">
            {excelSelectedName ? (
              <span className="truncate">選択中：{excelSelectedName}</span>
            ) : (
              <span>未選択</span>
            )}
          </div>
        </div>

        {/* ✅ シート選択（必須） */}
        {excelFile ? (
          <div className="rounded border p-3 dark:border-gray-800 space-y-2">
            <div className="text-sm font-extrabold">シート選択（必須）</div>

            {excelSheetLoading ? (
              <div className="text-xs opacity-70">シート読込中...</div>
            ) : excelSheetError ? (
              <div className="text-xs text-red-600 dark:text-red-400">
                {excelSheetError}
              </div>
            ) : excelSheetNames.length === 0 ? (
              <div className="text-xs opacity-70">シートが見つかりません</div>
            ) : (
              <select
                value={excelSheetName}
                onChange={(e) => {
                  const next = e.target.value;
                  setExcelSheetName(next);

                  // ✅ シートを変えたら「取り込み（候補抽出）」からやり直し
                  //    → 列指定までしか表示しない状態に戻す
                  setExcelImported(false);
                  setExcelCodes([]);
                  setExcelCodesError(null);
                  setExcelError(null);

                  setExcelResult(null);
                  setExcelKeyword2("");
                  setExcelKeyword2Error(null);

                  setCalcMmByRow({});
                  setDidAutoDetectCols(false);
                }}
                className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
              >
                {excelSheetNames.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            <div className="text-[11px] opacity-80">
              ※
              先頭が「鏡」シートでも、明細が入っているシートを選べば集計できます
            </div>
          </div>
        ) : null}

        {/* ✅ 列指定（必須） */}
        {excelFile ? (
          <>
            <div className="rounded border p-3 dark:border-gray-800 space-y-2">
              <div className="text-sm font-extrabold">
                列指定
              </div>
              <div className="mt-1 text-[11px] leading-relaxed opacity-80">
                エクセルシート内で「名称・摘要・数量・単位・サイズ」が書かれている表（枠）の、先頭列の番号を指定してください。
                AIの自動抽出は間違うことがあるため、合わない場合は手動で調整してください。
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={autoDetectCols}
                  disabled={autoDetectLoading || !excelFile}
                  className="rounded px-3 py-2 text-xs font-extrabold bg-gray-800 text-white disabled:opacity-60"
                >
                  {autoDetectLoading ? "自動検出中..." : "列を自動で拾う"}
                </button>

                {autoDetectError ? (
                  <div className="text-xs text-red-600 dark:text-red-400">
                    {autoDetectError}
                  </div>
                ) : null}
              </div>
              <div className="mt-1 text-[11px] opacity-80">
                ※
                列番号は「結合セルを1つとして数える」のではなく、Excel上の実セル（A=1,
                B=2, C=3...）の位置で数えて入力してください
              </div>


              <div className="overflow-x-auto">
                <div className="flex items-end gap-3 min-w-max text-sm">
                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">名称</div>
                    <input
                      value={itemCol1Based}
                      onChange={(e) => setItemCol1Based(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：4"
                    />
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">摘要</div>
                    <input
                      value={descCol1Based}
                      onChange={(e) => setDescCol1Based(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：8"
                    />
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">数量</div>
                    <input
                      value={qtyCol1Based}
                      onChange={(e) => setQtyCol1Based(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：12"
                    />
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">単位</div>
                    <input
                      value={unitCol1Based}
                      onChange={(e) => setUnitCol1Based(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：14"
                    />
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">サイズ抽出</div>
                    <input
                      value={sizeCol1Based}
                      onChange={(e) => setSizeCol1Based(e.target.value)}
                      className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：8（摘要） / 9（備考）など"
                    />
                  </div>

                  <div className="shrink-0">
                    <div className="text-xs font-bold mb-1">金額0/空除外</div>
                    <button
                      type="button"
                      onClick={() => {
                        setHideZeroAmount((v) => !v);
                        // OFFに戻したら入力/エラーもクリア
                        setAmountColError(null);
                        if (hideZeroAmount) setAmountCol1Based("");
                      }}
                      className={
                        "w-28 rounded border px-2 py-1 text-xs font-extrabold " +
                        (hideZeroAmount
                          ? "bg-black text-white border-black"
                          : "bg-white dark:bg-gray-950 dark:border-gray-800")
                      }
                    >
                      {hideZeroAmount ? "ON" : "OFF"}
                    </button>
                  </div>

                  {hideZeroAmount ? (
                    <div className="shrink-0">
                      <div className="text-xs font-bold mb-1">金額 列</div>
                      <input
                        value={amountCol1Based}
                        onChange={(e) => setAmountCol1Based(e.target.value)}
                        className="w-16 rounded border px-2 py-1 text-xs bg-white dark:bg-gray-950 dark:border-gray-800"
                        placeholder="例：16"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-1 text-[11px] opacity-80">
                  ※
                  サイズが摘要以外（備考など）に入る明細書があるため、この列からサイズを拾います
                </div>
                {manualColsError ? (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {manualColsError}
                  </div>
                ) : null}
                {amountColError ? (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    {amountColError}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="text-xs font-bold mb-1">Excelファイル</div>

            {/* ボタン風のファイル選択 */}
            <input
              id="excelFileInput"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0] ?? null;
                setExcelFile(f);
                setExcelSelectedName(f?.name ?? "");
                setExcelImported(false);

                setExcelError(null);
                setExcelResult(null);
                setExcelCodes([]);
                setExcelCodesError(null);

                setExcelKeyword2("");
                setExcelKeyword2Error(null);

                setCalcMmByRow({});

                setHideZeroAmount(false);
                setAmountCol1Based("");
                setAmountColError(null);

                // ✅ シート選択もリセットして取り直す
                setExcelSheetNames([]);
                setExcelSheetName("");
                setExcelSheetError(null);

                setDidAutoDetectCols(false);

                if (f) {
                  (async () => {
                    await fetchExcelSheets(f);
                  })();
                }
              }}
              className="sr-only"
            />
          </div>

          <button
            onClick={importExcel}
            disabled={excelCodesLoading || !excelFile}
            className="rounded px-4 py-2 text-sm font-extrabold bg-gray-800 text-white disabled:opacity-60"
          >
            {excelCodesLoading ? "取り込み中..." : "取り込む（候補抽出）"}
          </button>
        </div>

        {excelCodesError ? (
          <div className="text-sm text-red-600 dark:text-red-400">
            {excelCodesError}
          </div>
        ) : null}
        <div className="text-[11px] opacity-70">
          ※ 候補抽出はシート内の全列から自動で拾います（列指定は不要）。
        </div>

        {/* キーワード1 */}
        {excelImported && colsReady ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="w-full sm:w-72 space-y-2">
                <div className="text-xs font-bold">
                  キーワード1（手入力 or 候補から選択）
                </div>

                <select
                  value={excelCode}
                  onChange={(e) => setExcelCode(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                  disabled={!excelImported || excelCodes.length === 0}
                >
                  {!excelImported ? (
                    <option>（まず「取り込む」を押してください）</option>
                  ) : excelCodes.length === 0 ? (
                    <option>（候補なし：手入力してください）</option>
                  ) : (
                    excelCodes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  )}
                </select>

                <input
                  value={excelCode}
                  onChange={(e) => setExcelCode(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                  placeholder="例：防-1 / OAVP-2S / 壁 巾木 ウレタン塗膜防水"
                />
              </div>

              <button
                onClick={runExcelSum}
                disabled={
                  excelLoading ||
                  !excelFile ||
                  !hasRequiredManualCols(
                    itemCol1Based,
                    descCol1Based,
                    qtyCol1Based,
                    unitCol1Based,
                    sizeCol1Based,
                  ) ||
                  (hideZeroAmount && !isValid1BasedInt(amountCol1Based))
                }
                className="rounded px-4 py-2 text-sm font-extrabold bg-black text-white disabled:opacity-60"
              >
                {excelLoading ? "絞り込み中..." : "① 絞り込む"}
              </button>
            </div>

            {excelError ? (
              <div className="text-sm text-red-600 dark:text-red-400">
                {excelError}
              </div>
            ) : null}

            {/* キーワード2 */}
            {excelResult ? (
              <div className="rounded border p-3 dark:border-gray-800 space-y-2">
                <div className="text-xs font-extrabold">
                  キーワード2（表示したいキーワードをスペースで区切って入力すると、入力したキーワードのうち1つでも含まれている行をすべて表示します。）
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <input
                      value={excelKeyword2}
                      onChange={(e) => setExcelKeyword2(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：立上り H=200 重ね 溝 入隅 平場 巾木 端末 シーリング"
                    />
                    {excelKeyword2Error ? (
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        {excelKeyword2Error}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <div className="mt-2 text-xs font-extrabold">除外キーワード（ORで除外）</div>
                    <input
                      value={excelExcludeKeyword}
                      onChange={(e) => setExcelExcludeKeyword(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm bg-white dark:bg-gray-950 dark:border-gray-800"
                      placeholder="例：端末 シーリング 共通 No.8に含む"
                    />
                    <div className="mt-1 text-[11px] opacity-80">
                      ※ スペース区切りで入力。②「さらに絞る」を押した時点の入力で、1つでも含む行を表示から除外します（OR）。
                    </div>
                  </div>
                  <button
                    onClick={runExcelSum2}
                    disabled={
                      excelKeyword2Loading ||
                      !excelFile ||
                      !excelKeyword2.trim() ||
                      !hasRequiredManualCols(
                        itemCol1Based,
                        descCol1Based,
                        qtyCol1Based,
                        unitCol1Based,
                        sizeCol1Based,
                      ) ||
                      (hideZeroAmount && !isValid1BasedInt(amountCol1Based))
                    }
                    className="rounded px-4 py-2 text-sm font-extrabold bg-gray-800 text-white disabled:opacity-60"
                  >
                    {excelKeyword2Loading ? "絞り込み中..." : "② さらに絞る"}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        {excelFile && (!excelImported || !colsReady) ? (
          <div className="text-xs opacity-70">
            {!excelImported
              ? "まず「取り込む（候補抽出）」を押すと、キーワード入力欄が表示されます。"
              : "列指定を入力すると、キーワード入力欄が表示されます。"}
          </div>
        ) : null}

        {/* 結果表示 */}
        {excelResult ? (
          <div className="space-y-3">
            <div className="text-sm">
              ヒット行数：
              <span className="ml-2 font-extrabold">
                {filteredPreview.length}
              </span>
            </div>

            <div className="rounded border p-3 dark:border-gray-800">
              <div className="text-xs font-bold mb-2">単位別合計</div>
              <ul className="text-sm space-y-1">
                {Object.entries(sumsByUnit).map(([unit, sum]) => (
                  <li key={unit} className="flex justify-between">
                    <span className="font-bold">{unit}</span>
                    <span className="font-extrabold">
                      {typeof sum === "number"
                        ? formatNumber(sum)
                        : String(sum)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded border p-3 dark:border-gray-800 space-y-2">
              <div className="text-xs font-bold">
                ㎡換算 合計（単位が m / 箇所 / ㎡ の行）
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold">
                  {formatNumber(sumM2Client)}
                </div>

                <button
                  onClick={saveCurrentResult}
                  disabled={!excelResult}
                  className="rounded px-3 py-2 text-xs font-extrabold bg-black text-white disabled:opacity-60"
                >
                  保存
                </button>
              </div>

              <div className="text-[11px] opacity-80">
                ※ API計算値（m行のみ等）：{formatNumber(excelResult.sumM2)}
              </div>

              {saveMsg ? (
                <div className="text-xs text-green-700 dark:text-green-400">
                  {saveMsg}
                </div>
              ) : null}
            </div>

            <div className="rounded border p-3 dark:border-gray-800">
              <div className="text-xs font-bold mb-2">プレビュー（除外適用後）</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b dark:border-gray-800">
                      <th className="py-2 pr-2">行</th>
                      <th className="py-2 pr-2">品名</th>
                      <th className="py-2 pr-2">摘要</th>
                      <th className="py-2 pr-2">数量</th>
                      <th className="py-2 pr-2">単位</th>
                      <th className="py-2 pr-2">寸法</th>
                      <th className="py-2 pr-2">換算㎡</th>
                      <th className="py-2 pr-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreview.map((r) => {
                      const rawUnit = (r.unit ?? "").normalize("NFKC");
                      const unitNorm = normalizeUnit(rawUnit);

                      // ✅ m 行の判定を厳格化（"ヶ所" 等の誤判定を潰す）
                      const isM =
                        unitNorm === "m" &&
                        /m/i.test(rawUnit) &&
                        !/[ヶ箇]/.test(rawUnit);

                      const isKasho = unitNorm === "箇所" || /[ヶ箇]所/.test(rawUnit);
                      const isM2 = unitNorm === "㎡";

                      // ✅ 寸法は m の行だけ計算＆表示
                      const sizeForDisplay = isM ? formatSize(r) : "";
                      const hasExplicitSizeText = Boolean(sizeForDisplay);

                      const defaultM = getDefaultMForRow(
                        r,
                        hasExplicitSizeText,
                      );

                      const input = calcMmByRow[r.rowIndex] ?? "";
                      const n = toPositiveNumberOrNull(input);

                      const m2 = calcM2FromInputOrExisting(r);
                      const showM2 =
                        typeof m2 === "number" && Number.isFinite(m2);

                      const alreadyM2 = isM2 ? getM2Already(r) : null;

                      return (
                        <tr
                          key={`${r.rowIndex}-${r.item ?? ""}`}
                          className="border-b dark:border-gray-800"
                        >
                          <td className="py-2 pr-2">{r.rowIndex}</td>
                          <td className="py-2 pr-2">{r.item ?? "-"}</td>
                          <td className="py-2 pr-2 whitespace-pre-wrap">
                            {r.desc ?? "-"}
                          </td>
                          <td className="py-2 pr-2">
                            {typeof r.qty === "number"
                              ? formatNumber(r.qty)
                              : "-"}
                          </td>
                          <td className="py-2 pr-2">{r.unit ?? "-"}</td>

                          <td className="py-2 pr-2">
                            <div className="grid grid-cols-[150px_1fr] items-center gap-2">
                              <span className="block w-[150px] truncate whitespace-nowrap">
                                {sizeForDisplay ? sizeForDisplay : "-"}
                              </span>

                              <div className="flex items-center gap-2">
                                {!isM2 && (
                                  <>
                                    <div className="flex items-center gap-1">
                                      <input
                                        value={input}
                                        onChange={(e) => {
                                          const v = e.target.value;
                                          setCalcMmByRow((prev) => ({
                                            ...prev,
                                            [r.rowIndex]: v,
                                          }));
                                        }}
                                        className="w-24 rounded border px-2 py-1 bg-white dark:bg-gray-950 dark:border-gray-800"
                                        placeholder={
                                          isM
                                            ? defaultM != null
                                              ? String(defaultM)
                                              : "例:0.1"
                                            : isKasho
                                              ? "例:0.25"
                                              : "例:0.30"
                                        }
                                      />
                                    </div>

                                    {isM && n != null && n >= 1 ? (
                                      <span className="text-[11px] font-extrabold text-red-600 dark:text-red-400 whitespace-nowrap">
                                        ⚠ 1m以上：値を確認
                                      </span>
                                    ) : null}
                                  </>
                                )}

                                {isM2 ? (
                                  <span className="text-[11px] opacity-70 whitespace-nowrap">
                                    {alreadyM2 != null
                                      ? `（㎡=${alreadyM2}）`
                                      : ""}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="py-2 pr-2">
                            {showM2 ? formatNumber(m2 as number) : "-"}
                          </td>
                          <td className="py-2 pr-2">
                            <button
                              type="button"
                              onClick={() => {
                                const ok =
                                  window.confirm(
                                    "この行を削除します。よろしいですか？",
                                  );
                                if (!ok) return;

                                setCalcMmByRow((prevCalc) => {
                                  const nextCalc: Record<number, string> = {
                                    ...prevCalc,
                                  };
                                  delete nextCalc[r.rowIndex];

                                  setExcelResult((prev) => {
                                    if (!prev) return prev;

                                    const nextPreview = prev.preview.filter(
                                      (x) => x.rowIndex !== r.rowIndex,
                                    );
                                    const nextSums =
                                      recomputeSumsByUnit(nextPreview);
                                    const nextSumM2Client =
                                      computeSumM2ClientWithMap(
                                        nextPreview,
                                        nextCalc,
                                      );

                                    return {
                                      ...prev,
                                      preview: nextPreview,
                                      matchedCount: nextPreview.length,
                                      sumsByUnit: nextSums,
                                      sumM2: nextSumM2Client,
                                    };
                                  });

                                  return nextCalc;
                                });
                              }}
                              className="rounded px-2 py-1 text-[11px] font-extrabold bg-gray-800 text-white"
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {/* 保存一覧（ページ最下部） */}
      <section className="rounded-lg border bg-white p-4 dark:border-gray-800 dark:bg-gray-900 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-extrabold">保存履歴（ローカル）</div>

          <button
            onClick={() => {
              const ok = window.confirm(
                "保存履歴を全削除します。よろしいですか？",
              );
              if (!ok) return;
              const next: SavedExcelSum[] = [];
              setSavedSums(next);
              saveSavedExcelSums(SAVED_EXCEL_SUM_KEY, next);
              setSaveMsg("保存履歴を全削除しました");
            }}
            disabled={savedSums.length === 0}
            className="rounded px-3 py-2 text-xs font-extrabold bg-gray-800 text-white disabled:opacity-60"
          >
            全削除
          </button>
        </div>

        {savedSums.length === 0 ? (
          <div className="text-sm opacity-70">まだ保存はありません</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b dark:border-gray-800">
                  <th className="py-2 pr-2">日時</th>
                  <th className="py-2 pr-2">ファイル</th>
                  <th className="py-2 pr-2">キーワード1</th>
                  <th className="py-2 pr-2">キーワード2</th>
                  <th className="py-2 pr-2">㎡換算合計</th>
                  <th className="py-2 pr-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {savedSums.map((s) => (
                  <tr key={s.id} className="border-b dark:border-gray-800">
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {formatDateTimeJa(s.savedAt)}
                    </td>
                    <td className="py-2 pr-2 max-w-[180px] truncate">
                      {s.fileName ?? "-"}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {s.keyword1 || "-"}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {s.keyword2 || "-"}
                    </td>
                    <td className="py-2 pr-2 whitespace-nowrap font-extrabold">
                      {formatNumber(s.sumM2)}
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const ok = window.confirm(
                              "この保存を削除します。よろしいですか？",
                            );
                            if (!ok) return;
                            const next = savedSums.filter((x) => x.id !== s.id);
                            setSavedSums(next);
                            saveSavedExcelSums(SAVED_EXCEL_SUM_KEY, next);
                          }}
                          className="rounded px-2 py-1 text-[11px] font-extrabold bg-gray-800 text-white"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="text-[11px] opacity-70">
          ※
          保存されるのは「キーワード1」「キーワード2」「表示中の㎡換算合計」です（端末のローカル保存）。
        </div>
      </section>
    </main>
  );
}
