// Shared keyword extraction for Gabby's inventory lookup.
//
// WHY THIS LIVES HERE (not inline in each route):
//   We have two surfaces that keyword-search inventory on natural-language
//   shopper input:
//     1. apps/web/app/api/gabby/chat/route.ts          — web + mobile chat
//     2. apps/web/app/api/retell/tools/search-inventory/route.ts — voice
//   Historically each route carried its own STOP_WORDS copy and extractor.
//   The lists drifted (voice added "yeah/sure/okay/please/thanks/..." which
//   web chat didn't have), and a single query would surface different
//   products on voice vs. chat for no principled reason. Moving this to
//   a single module guarantees parity and keeps the cleanup diff small
//   when we next tune the filter set.
//
// DESIGN NOTES:
//   - The Unicode \p{L}\p{N} character class lets us keep accented product
//     names working ("rosé", "café", "cachaça"). Don't collapse to [a-z].
//   - min length 3 drops "a"/"an"/"is" without hand-coding them. max 25
//     caps on pathological input ("aaaaaaaaaa...") so we don't build a
//     1 MB ilike clause.
//   - slice(0, 6) caps at 6 keywords — enough to describe any real ask
//     ("smoky peaty scotch for dinner under fifty") while keeping the
//     Postgres OR expansion small (6 kw × 6 columns = 36 ilike leaves).

// Single source of truth for Gabby's natural-language filler words.
// Chosen by shipping voice + chat traffic and removing the non-signal
// tokens from matches. If you add a word here, expect it to affect both
// surfaces — test both or add a flag.
export const STOP_WORDS: ReadonlySet<string> = new Set([
  // Articles / conjunctions / modal verbs
  "the", "and", "for", "with", "what", "how", "can", "you", "like",
  "want", "need", "good", "best", "have", "does", "would", "should",
  // Demonstratives / generic shopper verbs
  "about", "that", "this", "from", "something", "looking", "recommend",
  "suggest", "help", "tonight", "today",
  // Voice-channel fillers — people say these out loud but nobody means
  // them as a product attribute. Leaving them in caused false matches
  // against words like "Okay" in a brand tagline, "Your" in a product
  // line name, etc.
  "any", "got", "your", "mine", "please", "thanks", "yeah", "yes",
  "sure", "okay",
]);

export type ExtractKeywordsOptions = {
  /** Max keywords returned. Caller can shrink for voice (3) or grow for
   *  complex prompts (10). Default 6. */
  max?: number;
  /** Min token length (inclusive). Default 3. */
  minLen?: number;
  /** Max token length (inclusive). Default 25. */
  maxLen?: number;
};

/**
 * Lowercase, strip non-alphanum-non-space, split on whitespace, drop
 * stop-words and length-bounded outliers, cap at `max`.
 *
 * Idempotent: `extractKeywords(extractKeywords(x).join(" ")) === extractKeywords(x)`
 * (up to the max cap). This matters because we sometimes feed the
 * already-extracted keyword list back through the pipeline when a
 * conversation turn is concatenated from multiple prior user messages.
 */
export function extractKeywords(
  text: string,
  opts: ExtractKeywordsOptions = {},
): string[] {
  const max = opts.max ?? 6;
  const minLen = opts.minLen ?? 3;
  const maxLen = opts.maxLen ?? 25;

  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= minLen && w.length <= maxLen && !STOP_WORDS.has(w))
    .slice(0, max);
}
