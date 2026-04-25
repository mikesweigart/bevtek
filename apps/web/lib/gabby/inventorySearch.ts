// Shared ilike-clause builder for Gabby's keyword inventory search.
//
// This is the "AND of columns, OR of keywords" shape PostgREST wants for
// a free-text-style search across multiple text columns:
//
//   .or("name.ilike.%bourbon%,brand.ilike.%bourbon%,tasting_notes.ilike.%bourbon%,...")
//
// The keyword list comes from extractKeywords() in ./keywords.ts. We
// intentionally search across six columns: name, brand, varietal,
// category, tasting_notes, summary_for_customer. These six carry enough
// signal that a shopper asking "something smoky for grilling" surfaces
// products whose NAMES don't contain either word but whose tasting_notes
// or summary_for_customer do.
//
// KEEP IN LOCKSTEP:
//   If you add/remove a column here, do it in both the web chat route
//   and the Retell voice tool route at the same commit — otherwise the
//   two surfaces drift. The whole reason this module exists is to make
//   that drift impossible.

/** Columns we ilike-match on. Change this and you change both chat and voice. */
export const SEARCH_COLUMNS = [
  "name",
  "brand",
  "varietal",
  "category",
  "tasting_notes",
  "summary_for_customer",
] as const;

/**
 * Build the comma-joined ilike clause string for PostgREST `.or(...)`.
 * Returns `null` when there are zero keywords (caller should skip the
 * .or() call rather than pass an empty string — PostgREST rejects `""`).
 *
 * Keyword values are NOT sanitized for `%` or `_` — Postgres treats them
 * as wildcards, but that's intentional: if a shopper actually types "100%"
 * the percent signs will be stripped by extractKeywords() already, and a
 * lone `%` here is harmless against stock_qty > 0 real rows.
 */
export function buildKeywordClauses(keywords: readonly string[]): string | null {
  if (keywords.length === 0) return null;
  return keywords
    .flatMap((k) => SEARCH_COLUMNS.map((col) => `${col}.ilike.%${k}%`))
    .join(",");
}
