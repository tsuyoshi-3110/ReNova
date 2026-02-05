import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

type DetectOk = {
  ok: true;
  sheetName: string;
  headerRowIndex: null; // ← 内容判定なので常に null
  detectedCols: {
    item: number; // 1-based
    desc: number; // 1-based
    qty: number; // 1-based
    unit: number; // 1-based
    amount: number | null; // 1-based
    size: number; // 1-based（基本 desc と同じ）
  };
  debug: {
    scannedRows: number;
    scannedCols: number;
    picked: {
      item0: number;
      desc0: number;
      qty0: number;
      unit0: number;
      amount0: number | null;
    };
    notes: string[];
  };
};

type DetectNg = { ok: false; error: string };

function normCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function toNumberMaybe(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  if (!t) return null;
  // 例: "12", "12.3", "-5"
  if (!/^[-+]?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function sanitizeNoSpace(s: string): string {
  return s.replace(/\s+/g, "").trim();
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function nearBonus(c: number, target: number, distMax: number): number {
  const d = Math.abs(c - target);
  if (d > distMax) return 0;
  // 近いほどボーナス
  return (distMax - d) / distMax;
}

function digitsLenFromNumber(n: number): number {
  const abs = Math.abs(n);
  if (!Number.isFinite(abs)) return 0;
  if (abs < 1) return 1;
  return Math.floor(Math.log10(abs)) + 1;
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 1) return a[mid] ?? 0;
  const lo = a[mid - 1] ?? 0;
  const hi = a[mid] ?? 0;
  return (lo + hi) / 2;
}

/**
 * 内容から列を推定する
 * - ヘッダー無し/有りどちらもOK（ヘッダー文字は使わない）
 * - 「列ズレ」があっても、中身の性質で拾う
 */
function detectByContent(rows2d: string[][]): {
  item0: number;
  desc0: number;
  qty0: number;
  unit0: number;
  amount0: number | null;
  notes: string[];
  scannedRows: number;
  scannedCols: number;
} {
  const notes: string[] = [];

  // ---- スキャン対象行の作り方 ----
  // 上から順に見ていくが、
  // 「タイトル行（1セルだけ埋まってる）」とか「空行」は特徴を壊すので間引く
  const normalized: string[][] = rows2d
    .map((r) => r.map((x) => (x ?? "").trim()))
    .filter((r) => r.some((x) => x !== ""));

  const filtered: string[][] = [];
  for (const r of normalized) {
    const nonEmpty = r.filter((x) => x !== "");
    // 1セルだけ埋まってる行（タイトル/見出し）は除外
    if (nonEmpty.length <= 1) continue;
    filtered.push(r);
    if (filtered.length >= 140) break;
  }

  const scan = filtered.length > 0 ? filtered : normalized.slice(0, 140);
  const scannedRows = scan.length;

  const maxCols = scan.reduce((m, r) => Math.max(m, r.length), 0);
  const scannedCols = maxCols;

  // 列ごとのサンプル収集（最大 200 サンプル/列）
  const colSamples: string[][] = Array.from({ length: maxCols }, () => []);
  for (const r of scan) {
    for (let c = 0; c < maxCols; c++) {
      const v = (r[c] ?? "").trim();
      if (!v) continue;
      const arr = colSamples[c];
      if (arr.length < 200) arr.push(v);
    }
  }

  // ---- 特徴語彙 ----
  const UNIT_SET = new Set<string>([
    "㎡",
    "m²",
    "m2",
    "m^2",
    "平米",
    "ｍ",
    "m",
    "メートル",
    "ヶ所",
    "ケ所",
    "個所",
    "箇所",
    "式",
    "段",
    "本",
    "枚",
    "台",
    "袋",
    "缶",
    "kg",
    "ＫＧ",
    "L",
    "ℓ",
  ]);

  // 摘要っぽい（仕様/サイズ/記号）が出やすいパターン
  const sizeLikeRe =
    /(H|W|L)\s*[=＝]?\s*\d+|立上り|巾|幅|長さ|重ね|糸尺|≒|×|mm|㎜|cm|m2|㎡|ｍ|m/i;

  // 仕様/型番っぽい（防水・塗装・材料・コード）
  const specLikeRe =
    /OAVP-|VS-|VT-|UP-\d|仕様|規格|型番|品番|メーカー|材料|シート|プライマー|ウレタン|シーリング|モルタル|塗装|下地|防水/i;

  // 金額っぽい（円/¥/カンマ桁）
  const currencyRe = /(円|¥)/;

  // 工事項目（名称）っぽい語彙（ざっくり）
  const workNameRe =
    /工事|防水|塗装|シーリング|下地|撤去|清掃|養生|補修|改修|施工|張替|取付|処分|運搬|諸経費/i;

  type ColFeat = {
    c: number;
    count: number;

    // 数値性
    numericRatio: number; // 数値だけで構成される割合
    meanAbsNumber: number; // 数値の平均絶対値
    bigNumberRatio: number; // 10000以上の割合

    // 「桁が大きい」判定（←金額検出の主役）
    medianDigits: number; // 数値の桁数の中央値（絶対値）
    medianAbsNumber: number; // 数値の絶対値中央値

    // 単位
    unitRatio: number;

    // テキスト性
    textRatio: number; // 数値ではない割合
    avgLen: number;
    longTextRatio: number;

    // 摘要/仕様っぽさ
    sizeHitRatio: number;
    specHitRatio: number;

    // 金額っぽさ（補助）
    currencyRatio: number;
    commaRatio: number;

    // 名称っぽさ
    workWordRatio: number;
  };

  const feats: ColFeat[] = [];

  for (let c = 0; c < maxCols; c++) {
    const s = colSamples[c];
    const count = s.length;
    if (count === 0) continue;

    let numeric = 0;
    let sumAbs = 0;
    let big = 0;

    const digitList: number[] = [];
    const absList: number[] = [];

    let unit = 0;

    let lenSum = 0;
    let longText = 0;
    let sizeHit = 0;
    let specHit = 0;

    let currency = 0;
    let comma = 0;

    let workWord = 0;

    for (const x of s) {
      lenSum += x.length;

      if (x.includes(",")) comma += 1;
      if (currencyRe.test(x)) currency += 1;

      const n = toNumberMaybe(x);
      if (n != null) {
        numeric += 1;
        const abs = Math.abs(n);
        sumAbs += abs;
        absList.push(abs);
        digitList.push(digitsLenFromNumber(n));
        if (abs >= 10000) big += 1;
      }
      if (n == null && x.trim().length >= 10) {
        longText += 1;
      }

      const xNoSpace = sanitizeNoSpace(x);
      if (UNIT_SET.has(xNoSpace)) unit += 1;

      if (sizeLikeRe.test(x)) sizeHit += 1;
      if (specLikeRe.test(x)) specHit += 1;

      if (workNameRe.test(x)) workWord += 1;
    }

    const numericRatio = numeric / count;
    const textRatio = 1 - numericRatio;

    const medDigits = median(digitList);
    const medAbs = median(absList);

    feats.push({
      c,
      count,
      numericRatio,
      meanAbsNumber: numeric > 0 ? sumAbs / numeric : 0,
      bigNumberRatio: numeric > 0 ? big / numeric : 0,
      medianDigits: medDigits,
      medianAbsNumber: medAbs,
      unitRatio: unit / count,
      textRatio,
      avgLen: lenSum / count,
      longTextRatio: longText / count,
      sizeHitRatio: sizeHit / count,
      specHitRatio: specHit / count,
      currencyRatio: currency / count,
      commaRatio: comma / count,
      workWordRatio: workWord / count,
    });
  }

  // 何も取れない場合の最終fallback
  const fallback = {
    item0: 3,
    desc0: 7,
    qty0: 11,
    unit0: 13,
    amount0: null as number | null,
  };

  if (feats.length === 0) {
    notes.push("no features -> fallback");
    return {
      ...fallback,
      notes,
      scannedRows,
      scannedCols,
    };
  }

  // ---- unit列 ----
  // 単位は「単位集合に一致する割合」が高い列を採用
  const unitCand = feats.slice().sort((a, b) => b.unitRatio - a.unitRatio)[0];
  const unit0 = unitCand && unitCand.unitRatio >= 0.2 ? unitCand.c : -1;
  if (unit0 >= 0)
    notes.push(
      `unit=col${unit0 + 1} unitRatio=${unitCand.unitRatio.toFixed(2)}`,
    );
  else notes.push("unit not confident");

  // ---- qty列 ----
  // 数量は「数値率が高い」「金額っぽさが弱い」「unitに近い」ことが多い
  let bestQtyScore = -1;
  let qty0 = -1;

  for (const f of feats) {
    if (f.c === unit0) continue;

    const nearU = unit0 >= 0 ? nearBonus(f.c, unit0, 3) : 0;

    // 数量は大きすぎないことが多い（平均値が大きい列は金額の可能性）
    const meanPenalty = f.meanAbsNumber >= 5000 ? 0.8 : 0;

    const score =
      f.numericRatio * 2.2 +
      nearU * 0.8 -
      f.currencyRatio * 1.2 -
      f.commaRatio * 0.6 -
      f.bigNumberRatio * 1.2 -
      meanPenalty;

    if (score > bestQtyScore) {
      bestQtyScore = score;
      qty0 = f.c;
    }
  }

  // qtyは最低限 numericRatio が必要
  const qtyFeat = feats.find((x) => x.c === qty0);
  if (!qtyFeat || qtyFeat.numericRatio < 0.25) {
    notes.push("qty not confident -> fallback");
    qty0 = fallback.qty0;
  } else {
    notes.push(
      `qty=col${qty0 + 1} score=${bestQtyScore.toFixed(2)} numericRatio=${qtyFeat.numericRatio.toFixed(2)}`,
    );
  }

  // ---- amount列（ここを強化：金抜き対応 + 右端制約） ----
  // 前提:
  // - ヘッダー無し
  // - 金額列は「数量/単位/単価」より右にある（※実務の見積書の強い傾向）
  // - ただし「金抜き」は金額が空/0 だらけなので、誤検出しないよう null を返す

  // scan を使って「列cがどれだけ埋まっているか」「0/空の比率」を行数ベースで測る
  const scanRowCount = Math.max(1, scan.length);

  function colFillStats(c: number): {
    filledRatio: number; // 数値として入っている割合（行ベース）
    nonZeroRatio: number; // 0 以外の数値が入っている割合（行ベース）
    zeroOrEmptyRatio: number; // 0 または空（非数値含む）割合（行ベース）
    filledCount: number;
    nonZeroCount: number;
    maxAbsNonZero: number; // 非ゼロ数値の最大絶対値
    maxDigitsNonZero: number; // 非ゼロ数値の最大桁数
  } {
    let filled = 0;
    let nonZero = 0;
    let zeroOrEmpty = 0;

    let maxAbsNonZero = 0;
    let maxDigitsNonZero = 0;

    for (const r of scan) {
      const raw = (r[c] ?? "").trim();
      if (!raw) {
        zeroOrEmpty += 1;
        continue;
      }
      const n = toNumberMaybe(raw);
      if (n == null) {
        // 非数値は amount 的には「空扱い」に寄せる（タイトル/注記混入に強くする）
        zeroOrEmpty += 1;
        continue;
      }
      filled += 1;
      if (n !== 0) {
        nonZero += 1;
        const abs = Math.abs(n);
        if (abs > maxAbsNonZero) maxAbsNonZero = abs;
        const d = digitsLenFromNumber(n);
        if (d > maxDigitsNonZero) maxDigitsNonZero = d;
      }
      if (n === 0) zeroOrEmpty += 1;
    }

    return {
      filledRatio: filled / scanRowCount,
      nonZeroRatio: nonZero / scanRowCount,
      zeroOrEmptyRatio: zeroOrEmpty / scanRowCount,
      filledCount: filled,
      nonZeroCount: nonZero,
      maxAbsNonZero,
      maxDigitsNonZero,
    };
  }

  // (簡易) 単価列を推定して「金額は単価より右」をさらに強化
  // 単価は: 数値率が高い / 桁が金額より小さめ / unit列の右側近辺に出やすい
  let unitPrice0 = -1;
  if (unit0 >= 0) {
    let bestUp = -Infinity;
    for (const f of feats) {
      if (f.c === unit0 || f.c === qty0) continue;
      // unit の右側（同じ列/左は除外）
      if (f.c <= unit0) continue;
      if (f.numericRatio < 0.25) continue;
      // 単価は 2〜6桁くらいが多い（ざっくり）
      if (f.medianDigits < 2 || f.medianDigits > 6) continue;

      const nearU = nearBonus(f.c, unit0, 4);
      const score =
        f.numericRatio * 1.2 +
        nearU * 1.0 +
        (1 - clamp((f.medianDigits - 4) / 4, 0, 1)) * 0.4;
      if (score > bestUp) {
        bestUp = score;
        unitPrice0 = f.c;
      }
    }
    if (unitPrice0 >= 0) notes.push(`unitPrice~col${unitPrice0 + 1}`);
  }

  // amount は「qty/unit/unitPrice より必ず右」を強制
  const rightMin = Math.max(qty0, unit0, unitPrice0) + 1; // これより右（c >= rightMin）

  let bestAmtScore = -Infinity;
  let amount0: number | null = null;

  const amountCands = feats.filter((f) => {
    if (f.c === unit0) return false;
    if (f.c === qty0) return false;
    // 右端制約
    if (f.c < rightMin) return false;
    // 数値列っぽさ最低条件（ただし金抜きでも列自体は数値列なので 0.10 まで許容）
    if (f.numericRatio < 0.1) return false;
    return true;
  });

  if (amountCands.length === 0) {
    amount0 = null;
    notes.push(
      `amount not found on right side (rightMin=col${rightMin + 1}) -> null`,
    );
  } else {
    for (const f of amountCands) {
      const st = colFillStats(f.c);

      // 金額の特徴:
      // - 右側にある（rightMin 以右）
      // - 非ゼロの「最大桁数」が大きい / 非ゼロの最大値が大きい（※金抜きでも一部だけ入ることがある）
      // - 単価列(2〜6桁)よりは桁が大きくなりやすい
      let score = 0;

      // 非ゼロが無い列は金額として成立しない
      if (st.nonZeroCount === 0) {
        score = -Infinity;
      } else {
        // 最大桁数を最重要視（"数字群の中で一番桁数が多い" を反映）
        score += clamp(st.maxDigitsNonZero / 10, 0, 1) * 6.2;

        // 最大絶対値も強めに補助（桁が同等なら額が大きい方）
        score += clamp(Math.log10(st.maxAbsNonZero + 1) / 10, 0, 1) * 3.0;

        // 中央値系は参考程度
        score += clamp(f.medianDigits / 10, 0, 1) * 0.8;
        score += clamp(Math.log10(f.medianAbsNumber + 1) / 10, 0, 1) * 0.6;

        // 埋まり具合は弱め（※金抜きで空が多いケースを許容する）
        score += st.filledRatio * 0.6;
        score += st.nonZeroRatio * 0.4;

        // 右に行くほど微ボーナス（最後尾に金額が出やすい）
        score += clamp(f.c / Math.max(1, maxCols - 1), 0, 1) * 0.8;

        // unit/qty に近すぎる列は単価の可能性があるので少し減点
        if (qty0 >= 0 && Math.abs(f.c - qty0) <= 1) score -= 0.5;
        if (unit0 >= 0 && Math.abs(f.c - unit0) <= 1) score -= 0.5;

        // 単価っぽい桁(2〜6)に強く寄る列は減点（amount はそれ以上が多い）
        if (
          f.medianDigits >= 2 &&
          f.medianDigits <= 6 &&
          st.maxDigitsNonZero <= 6
        )
          score -= 0.7;
      }

      if (score > bestAmtScore) {
        bestAmtScore = score;
        amount0 = f.c;
      }
    }

    // 金抜き対応:
    // - 「金額列が存在しない」ケースは amount=null でOK
    // - ただし金抜きでも、金額が一部だけ入っていることがある（その場合は拾いたい）
    // 判定方針:
    // - 非ゼロが 0 件なら null
    // - 非ゼロが少なくても、"右側" かつ "最大桁数/最大値" が十分なら採用
    if (amount0 != null) {
      const st = colFillStats(amount0);
      const af = feats.find((x) => x.c === amount0);
      const medD = af?.medianDigits ?? 0;

      // 完全に金額が無い
      if (st.nonZeroCount === 0) {
        notes.push(
          `amount has no non-zero numbers -> null (col${amount0 + 1} filled=${st.filledRatio.toFixed(2)})`,
        );
        amount0 = null;
      } else {
        // "金額らしさ" 最低条件（単価/数量の誤検出を抑える）
        // - 最大桁数が 4 以上、または最大値が 1000 以上
        const okByScale = st.maxDigitsNonZero >= 4 || st.maxAbsNonZero >= 1000;

        if (!okByScale) {
          notes.push(
            `amount scale too small -> null (col${amount0 + 1} maxDigits=${st.maxDigitsNonZero} maxAbs=${st.maxAbsNonZero})`,
          );
          amount0 = null;
        } else {
          notes.push(
            `amount=col${amount0 + 1} score=${bestAmtScore.toFixed(2)} nonZero=${st.nonZeroCount} maxDigits=${st.maxDigitsNonZero} maxAbs=${Math.round(st.maxAbsNonZero)} medDigits=${medD.toFixed(1)}`,
          );
        }
      }
    }
  }

  // ---- desc（摘要）列 ----
  // 摘要は「テキスト率が高い」「サイズ/仕様語彙が多い」「文字が長め」
  let bestDescScore = -1;
  let desc0 = -1;

  for (const f of feats) {
    if (f.c === unit0 || f.c === qty0 || f.c === amount0) continue;

    const score =
      f.textRatio * 1.4 +
      clamp(f.avgLen / 24, 0, 1) * 0.8 +
      f.sizeHitRatio * 2.0 +
      f.specHitRatio * 1.6 -
      f.numericRatio * 1.0;

    if (score > bestDescScore) {
      bestDescScore = score;
      desc0 = f.c;
    }
  }

  const descFeat = feats.find((x) => x.c === desc0);
  if (!descFeat || descFeat.textRatio < 0.35) {
    notes.push("desc not confident -> fallback");
    desc0 = fallback.desc0;
  } else {
    notes.push(
      `desc=col${desc0 + 1} score=${bestDescScore.toFixed(2)} sizeHit=${descFeat.sizeHitRatio.toFixed(2)}`,
    );
  }

  // ---- item（名称）列 ----
  // 名称は「長めの文章が多い」「（同じ長文群の中で）一番左にある」ことが多い。
  // さらに、摘要(仕様/サイズ)より左側に出やすいので強めに左寄りを優遇。
  let bestItemScore = -1;
  let item0 = -1;

  const maxColsForLeftness = Math.max(1, maxCols - 1);

  for (const f of feats) {
    if (f.c === desc0 || f.c === unit0 || f.c === qty0 || f.c === amount0)
      continue;

    // 原則「摘要より左」を優先（右側は強めに減点）
    const isLeftOfDesc = f.c < desc0;
    const leftness = 1 - f.c / maxColsForLeftness; // 0..1（左ほど大きい）

    const leftHardBonus = isLeftOfDesc ? 0.9 : 0;
    const rightHardPenalty = isLeftOfDesc ? 0 : 1.2;

    // 長文が多い列を強く評価（名称は工事名/部位名などで長くなりやすい）
    const longBonus = clamp(f.longTextRatio / 0.35, 0, 1) * 1.8;
    const lenBonus = clamp(f.avgLen / 28, 0, 1) * 1.2;

    // 仕様/サイズっぽい列は名称としては避ける
    const specPenalty = f.specHitRatio * 1.2;
    const sizePenalty = f.sizeHitRatio * 1.4;

    const score =
      f.textRatio * 1.4 +
      longBonus +
      lenBonus +
      leftness * 0.9 +
      leftHardBonus +
      f.workWordRatio * 0.9 -
      f.numericRatio * 1.2 -
      specPenalty -
      sizePenalty -
      rightHardPenalty;

    // 同点付近なら「より左」を採用
    if (score > bestItemScore + 0.12) {
      bestItemScore = score;
      item0 = f.c;
    } else if (
      Math.abs(score - bestItemScore) <= 0.12 &&
      item0 >= 0 &&
      f.c < item0
    ) {
      item0 = f.c;
    }
  }

  const itemFeat = feats.find((x) => x.c === item0);
  if (!itemFeat || itemFeat.textRatio < 0.35) {
    notes.push("item not confident -> fallback");
    item0 = fallback.item0;
  } else {
    notes.push(
      `item=col${item0 + 1} score=${bestItemScore.toFixed(2)} longText=${itemFeat.longTextRatio.toFixed(
        2,
      )} leftness=${(1 - item0 / maxColsForLeftness).toFixed(2)}`,
    );
  }

  // 最終整合：もし item と desc が同じになったら、desc 右側/左側の次点を探す
  if (item0 === desc0) {
    notes.push("item==desc conflict -> adjust desc");
    let best = -1;
    let alt = desc0;

    for (const f of feats) {
      if (f.c === item0 || f.c === unit0 || f.c === qty0 || f.c === amount0)
        continue;

      const score =
        f.textRatio * 1.2 +
        f.sizeHitRatio * 1.8 +
        f.specHitRatio * 1.4 -
        f.numericRatio * 1.0;

      if (score > best) {
        best = score;
        alt = f.c;
      }
    }

    if (alt !== item0) desc0 = alt;
  }

  return {
    item0,
    desc0,
    qty0,
    unit0: unit0 >= 0 ? unit0 : fallback.unit0,
    amount0,
    notes,
    scannedRows,
    scannedCols,
  };
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      const ng: DetectNg = { ok: false, error: "file がありません" };
      return NextResponse.json(ng, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });

    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) {
      const ng: DetectNg = { ok: false, error: "シートが見つかりません" };
      return NextResponse.json(ng, { status: 400 });
    }

    const ws = wb.Sheets[sheetName];

    const rowsUnknown: unknown[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      blankrows: false,
      defval: "",
    }) as unknown[][];

    const rows2d: string[][] = rowsUnknown.map((r) =>
      r.map((v) => normCell(v)),
    );

    const r = detectByContent(rows2d);

    const ok: DetectOk = {
      ok: true,
      sheetName,
      headerRowIndex: null,
      detectedCols: {
        item: r.item0 + 1,
        desc: r.desc0 + 1,
        qty: r.qty0 + 1,
        unit: r.unit0 + 1,
        amount: r.amount0 != null ? r.amount0 + 1 : null,
        size: r.desc0 + 1, // 初期は摘要からサイズ抽出
      },
      debug: {
        scannedRows: r.scannedRows,
        scannedCols: r.scannedCols,
        picked: {
          item0: r.item0,
          desc0: r.desc0,
          qty0: r.qty0,
          unit0: r.unit0,
          amount0: r.amount0,
        },
        notes: r.notes,
      },
    };

    return NextResponse.json(ok);
  } catch (e: unknown) {
    const ng: DetectNg = {
      ok: false,
      error: e instanceof Error ? e.message : "unknown error",
    };
    return NextResponse.json(ng, { status: 500 });
  }
}
