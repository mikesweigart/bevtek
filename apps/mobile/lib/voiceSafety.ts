// Voice-safety post-processor for TTS playback.
//
// Responsibility disclosures must reach the customer's ears even on audio-
// only surfaces where they can't see the [SPONSORED] badge or a footer.
// We rely on Claude's system prompt to handle these naturally, but this
// layer is the belt-and-suspenders: if a recommendation goes out without
// a "please enjoy responsibly" cue, we append one before speaking. Same
// for a sponsored disclosure when a [FEATURED] or [SPONSORED] marker
// leaks through.
//
// This runs ONLY on the TTS path — it never mutates the on-screen text.

const PRICE_RX = /\$\d/;
const RECOMMEND_RX =
  /\b(grab|try|pick|go with|recommend|suggest|I'?d|I would|reach for|perfect|great choice|love the)\b/i;
const ALREADY_RESPONSIBLE_RX =
  /\b(enjoy|drink|sip|consume|please)\s+(it\s+)?responsibly\b/i;
const ALREADY_DISCLOSED_RX =
  /\b(sponsored|paid|partner|featured)\s+(pick|placement|item|brand|product|partner)\b|one of our featured/i;

/**
 * Prepare a Gabby/Megan reply for text-to-speech. Strips TTS-unfriendly
 * characters, enforces a responsibility cue on recommendation turns, and
 * scrubs stray sponsored-bracket markers while preserving the verbal
 * disclosure.
 */
export function prepareForSpeech(text: string): string {
  let out = text;

  // 1. Scrub hard-bracket markers that shouldn't be spoken. These are
  //    prompt-side labels, not customer-facing language; Claude is told
  //    to disclose verbally instead.
  out = out.replace(/\[SPONSORED\]/gi, "").replace(/\[FEATURED\]/gi, "");

  // 2. Light markdown cleanup (ListenButton already does some — keep this
  //    in sync so the helper is self-sufficient for any caller).
  out = out
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-•]\s/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/—/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  // 3. Read prices as words for better voice output.
  out = out.replace(/\$(\d+(?:[.,]\d+)?)/g, (_m, n) => ` ${n} dollars`);

  // 4. If this looks like a recommendation and doesn't already include a
  //    responsibility cue, tack one on. Kept short so it doesn't feel
  //    preachy on every turn.
  const looksLikeRecommendation =
    PRICE_RX.test(text) || RECOMMEND_RX.test(text);
  if (looksLikeRecommendation && !ALREADY_RESPONSIBLE_RX.test(out)) {
    out = out.replace(/[.!?]*\s*$/, "") + ". Please enjoy responsibly.";
  }

  return out;
}

/**
 * Returns true when the given reply mentions a featured/sponsored item
 * without any verbal disclosure language. Used as an assertion in dev
 * so we catch prompt regressions early, not as a hard runtime gate —
 * the model is the primary disclosure mechanism.
 */
export function missingSponsoredDisclosure(raw: string): boolean {
  if (!/\[SPONSORED\]/i.test(raw)) return false;
  return !ALREADY_DISCLOSED_RX.test(raw);
}
