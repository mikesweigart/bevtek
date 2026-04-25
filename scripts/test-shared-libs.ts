/**
 * Minimal test harness for the shared libs that live under
 * apps/web/lib/gabby/* and apps/web/lib/sms/*.
 *
 * WHY A TSX SCRIPT (no framework)
 *   These are pure functions — no DB, no network. Adding Vitest/Jest just
 *   to cover three modules means 80 MB of dev deps, a config file, a CI
 *   step, and a lockfile churn every time their transitive deps change.
 *   Node's built-in `assert/strict` plus tsx gets us the same correctness
 *   signal with zero new dependencies.
 *
 * HOW TO RUN
 *   pnpm tsx scripts/test-shared-libs.ts
 *   Exit code is 0 on pass, 1 on any failure.
 *
 * WHAT WE COVER
 *   - extractKeywords stop-word / length / cap / idempotency invariants
 *   - buildKeywordClauses empty / single / multi shape
 *   - normalizePhoneE164 US / international / malformed inputs
 *
 * WHAT WE DELIBERATELY DON'T COVER HERE
 *   - sendSms: hits Sendblue + Supabase. Needs an integration env.
 *   - Store resolution in search-inventory: needs a live DB.
 *   Add those as separate integration harnesses when they're blocking
 *   something — not preemptively.
 */

import assert from "node:assert/strict";

import {
  extractKeywords,
  STOP_WORDS,
} from "../apps/web/lib/gabby/keywords";
import {
  buildKeywordClauses,
  SEARCH_COLUMNS,
} from "../apps/web/lib/gabby/inventorySearch";
import { normalizePhoneE164 } from "../apps/web/lib/sms/sendblue";

type TestFn = () => void | Promise<void>;
const cases: Array<{ name: string; fn: TestFn }> = [];
function test(name: string, fn: TestFn) {
  cases.push({ name, fn });
}

// ---------------------------------------------------------------------------
// extractKeywords
// ---------------------------------------------------------------------------

test("extractKeywords pulls real product words out of a natural question", () => {
  const kws = extractKeywords("Do you have Buffalo Trace bourbon?");
  // "do", "you", "have" are stop-words; rest survive.
  assert.deepEqual(kws, ["buffalo", "trace", "bourbon"]);
});

test("extractKeywords filters every word in STOP_WORDS set", () => {
  // Use only stop-words → nothing should survive.
  const onlyStopWords = [...STOP_WORDS].slice(0, 10).join(" ");
  assert.deepEqual(extractKeywords(onlyStopWords), []);
});

test("extractKeywords keeps accented characters (rosé, café, cachaça)", () => {
  const kws = extractKeywords("rosé from françe café pairings");
  // "from" is a stop word, rest should keep their diacritics.
  assert.ok(kws.includes("rosé"), `expected rosé; got ${JSON.stringify(kws)}`);
  assert.ok(kws.includes("françe"), `expected françe; got ${JSON.stringify(kws)}`);
  assert.ok(kws.includes("café"), `expected café; got ${JSON.stringify(kws)}`);
});

test("extractKeywords drops words shorter than minLen", () => {
  // "is", "an", "ok" are all < 3 chars; "big" passes.
  const kws = extractKeywords("is an ok big bottle");
  assert.ok(!kws.includes("is"));
  assert.ok(!kws.includes("an"));
  assert.ok(!kws.includes("ok"));
  assert.ok(kws.includes("big"));
});

test("extractKeywords caps at max (default 6)", () => {
  const text = "alpha beta gamma delta epsilon zeta eta theta iota kappa";
  assert.equal(extractKeywords(text).length, 6);
});

test("extractKeywords is idempotent under round-trip", () => {
  const input = "Looking for something smoky peaty scotch under fifty bucks";
  const once = extractKeywords(input);
  const twice = extractKeywords(once.join(" "));
  assert.deepEqual(twice, once);
});

test("extractKeywords honors custom max/minLen/maxLen options", () => {
  const text = "bourbon vodka gin rum tequila mezcal whiskey scotch brandy";
  const three = extractKeywords(text, { max: 3 });
  assert.equal(three.length, 3);

  // minLen=7 should drop "gin", "rum", "vodka" etc.
  const long = extractKeywords("gin rum bourbon whiskey scotch", { minLen: 7 });
  assert.ok(long.every((w) => w.length >= 7));
});

test("extractKeywords lowercases everything", () => {
  const kws = extractKeywords("BUFFALO trace BOURBON");
  assert.ok(kws.every((w) => w === w.toLowerCase()));
});

// ---------------------------------------------------------------------------
// buildKeywordClauses
// ---------------------------------------------------------------------------

test("buildKeywordClauses returns null on empty keywords", () => {
  assert.equal(buildKeywordClauses([]), null);
});

test("buildKeywordClauses builds one column-leaf per (keyword × column)", () => {
  const clauses = buildKeywordClauses(["bourbon"]);
  assert.ok(clauses);
  const parts = clauses!.split(",");
  assert.equal(parts.length, SEARCH_COLUMNS.length);
  for (const col of SEARCH_COLUMNS) {
    assert.ok(
      parts.includes(`${col}.ilike.%bourbon%`),
      `missing column ${col}: ${clauses}`,
    );
  }
});

test("buildKeywordClauses expands N keywords to N × columns leaves", () => {
  const clauses = buildKeywordClauses(["bourbon", "smoky"]);
  assert.ok(clauses);
  const parts = clauses!.split(",");
  assert.equal(parts.length, 2 * SEARCH_COLUMNS.length);
});

test("buildKeywordClauses preserves wildcard markers verbatim (no escaping)", () => {
  // Intentional: the module's doc-comment says we don't escape % or _.
  // This test locks that contract in so nobody "helpfully" adds escaping
  // later and breaks the real inventory search.
  const clauses = buildKeywordClauses(["foo"]);
  assert.ok(clauses!.includes("%foo%"));
});

// ---------------------------------------------------------------------------
// normalizePhoneE164
// ---------------------------------------------------------------------------

test("normalizePhoneE164 accepts bare 10-digit US numbers", () => {
  assert.equal(normalizePhoneE164("4045551234"), "+14045551234");
});

test("normalizePhoneE164 strips formatting from 10-digit US numbers", () => {
  assert.equal(normalizePhoneE164("(404) 555-1234"), "+14045551234");
  assert.equal(normalizePhoneE164("404.555.1234"), "+14045551234");
  assert.equal(normalizePhoneE164("404 555 1234"), "+14045551234");
});

test("normalizePhoneE164 handles 11-digit numbers with leading 1", () => {
  assert.equal(normalizePhoneE164("14045551234"), "+14045551234");
  assert.equal(normalizePhoneE164("1-404-555-1234"), "+14045551234");
});

test("normalizePhoneE164 passes through E.164-prefixed inputs", () => {
  assert.equal(normalizePhoneE164("+14045551234"), "+14045551234");
  assert.equal(normalizePhoneE164("+442071234567"), "+442071234567");
});

test("normalizePhoneE164 rejects too-short inputs", () => {
  assert.equal(normalizePhoneE164(""), null);
  assert.equal(normalizePhoneE164("555"), null);
  assert.equal(normalizePhoneE164("1234567"), null); // 7 digits, no +
});

test("normalizePhoneE164 rejects plainly invalid inputs", () => {
  // 12-digit with no + is ambiguous — we refuse rather than guess.
  assert.equal(normalizePhoneE164("123456789012"), null);
});

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function main() {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of cases) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed += 1;
    } catch (e) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${(e as Error).message}`);
      failed += 1;
    }
  }
  console.log(`\n${passed} passed, ${failed} failed, ${cases.length} total`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
