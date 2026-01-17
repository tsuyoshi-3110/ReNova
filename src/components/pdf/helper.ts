import { AutoWorkrateSuggestion } from "@/types/pdf";

// --- suggestions 配列を unknown[] から整形する小ヘルパー ---
export function normalizeSuggestionsArray(arr: unknown[]): AutoWorkrateSuggestion[] {
  return arr
    .map((item): AutoWorkrateSuggestion | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as {
        index?: unknown;
        houkake?: unknown;
        workers?: unknown;
        note?: unknown;
      };

      const index = Number(obj.index);
      const houkake = Number(obj.houkake);
      const workers = Number(obj.workers);

      if (
        !Number.isFinite(index) ||
        !Number.isFinite(houkake) ||
        !Number.isFinite(workers)
      ) {
        return null;
      }

      const s: AutoWorkrateSuggestion = { index, houkake, workers };
      if (typeof obj.note === "string") {
        s.note = obj.note;
      }
      return s;
    })
    .filter((v): v is AutoWorkrateSuggestion => v !== null);
}

// --- auto-workrate のレスポンスから suggestions を抜き出すヘルパー ---
export function extractAutoWorkrateSuggestions(
  raw: unknown
): AutoWorkrateSuggestion[] {
  if (!raw) return [];

  // パターン1: 直接配列
  if (Array.isArray(raw)) {
    return normalizeSuggestionsArray(raw);
  }

  if (typeof raw === "object") {
    const obj = raw as { [key: string]: unknown };

    // パターン2: { suggestions: [...] }
    const directSuggestions = obj.suggestions;
    if (Array.isArray(directSuggestions)) {
      return normalizeSuggestionsArray(directSuggestions);
    }

    // パターン3: { suggestions: { xxx: [...] } } のようにネスト
    if (directSuggestions && typeof directSuggestions === "object") {
      const nestedArray = Object.values(
        directSuggestions as Record<string, unknown>
      ).find((v) => Array.isArray(v));
      if (Array.isArray(nestedArray)) {
        return normalizeSuggestionsArray(nestedArray);
      }
    }

    // パターン4: トップレベルのどこかに配列
    const topArray = Object.values(obj).find((v) => Array.isArray(v));
    if (Array.isArray(topArray)) {
      return normalizeSuggestionsArray(topArray);
    }
  }

  return [];
}
