/**
 * Gabby evaluation harness.
 *
 * Runs a fixed set of canonical shopper prompts against the deployed
 * Gabby endpoint and scores the replies on cheap structural checks:
 *   - non-empty, above a minimum length
 *   - contains any of a set of expected keywords (for pairing/style cases)
 *   - does NOT contain forbidden phrases (for the safety cases)
 *
 * This isn't a semantic eval — it's a regression net. If a prompt change
 * makes Gabby stop saying "cabernet" in response to "ribeye," that's a
 * signal worth investigating. If a prompt change makes her encourage
 * serving alcohol to a drunk person, that's a ship-blocker.
 *
 * Usage:
 *   BEVTEK_EVAL_URL=https://bevtek-web.vercel.app \
 *   BEVTEK_EVAL_STORE_ID=<uuid> \
 *   pnpm eval:gabby
 *
 * Optional:
 *   BEVTEK_EVAL_CASES=scripts/eval-fixtures/gabby-cases.json   (default)
 *   BEVTEK_EVAL_OUTPUT=scripts/eval-results/gabby-<date>.json  (default)
 *   BEVTEK_EVAL_CONCURRENCY=3                                   (default)
 *
 * Exits non-zero if any case fails — wire into CI when you want a gate.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type Case = {
  id: string;
  category: string;
  prompt: string;
  notes?: string;
  expect: {
    minChars?: number;
    mustInclude?: string[];
    mustIncludeLower?: string[];
    anyIncludeLower?: string[];
    notIncludeLower?: string[];
  };
};

type Result = {
  id: string;
  category: string;
  prompt: string;
  pass: boolean;
  reasons: string[];
  reply: string;
  latencyMs: number;
  httpStatus: number;
};

const URL = process.env.BEVTEK_EVAL_URL ?? "https://bevtek-web.vercel.app";
const STORE_ID = process.env.BEVTEK_EVAL_STORE_ID ?? "";
const CASES_PATH =
  process.env.BEVTEK_EVAL_CASES ?? "scripts/eval-fixtures/gabby-cases.json";
const OUTPUT_PATH =
  process.env.BEVTEK_EVAL_OUTPUT ??
  `scripts/eval-results/gabby-${new Date().toISOString().slice(0, 10)}.json`;
const CONCURRENCY = Math.max(
  1,
  Number(process.env.BEVTEK_EVAL_CONCURRENCY ?? "3") | 0,
);

if (!STORE_ID) {
  console.error(
    "[eval] BEVTEK_EVAL_STORE_ID is required. Pick a real store_id (e.g. your staging store) — Gabby needs it to ground the inventory lookup.",
  );
  process.exit(2);
}

const raw = readFileSync(resolve(CASES_PATH), "utf8");
const cases = JSON.parse(raw) as Case[];
console.log(
  `[eval] Loaded ${cases.length} cases → ${URL} (store ${STORE_ID.slice(0, 8)}…, concurrency ${CONCURRENCY})`,
);

function scoreCase(c: Case, reply: string): string[] {
  const reasons: string[] = [];
  const lower = reply.toLowerCase();
  const { expect: ex } = c;

  if (ex.minChars && reply.length < ex.minChars) {
    reasons.push(`reply too short (${reply.length} < ${ex.minChars})`);
  }
  for (const s of ex.mustInclude ?? []) {
    if (!reply.includes(s)) reasons.push(`missing required substring "${s}"`);
  }
  for (const s of ex.mustIncludeLower ?? []) {
    if (!lower.includes(s))
      reasons.push(`missing required (case-insensitive) "${s}"`);
  }
  if (ex.anyIncludeLower && ex.anyIncludeLower.length > 0) {
    const hit = ex.anyIncludeLower.some((s) => lower.includes(s));
    if (!hit)
      reasons.push(
        `none of the expected terms appeared: [${ex.anyIncludeLower.join(", ")}]`,
      );
  }
  for (const s of ex.notIncludeLower ?? []) {
    if (lower.includes(s)) reasons.push(`contained forbidden phrase "${s}"`);
  }
  return reasons;
}

async function runCase(c: Case): Promise<Result> {
  const t0 = Date.now();
  let httpStatus = 0;
  let reply = "";
  try {
    const res = await fetch(`${URL}/api/gabby/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId: STORE_ID,
        messages: [],
        userMessage: c.prompt,
        sessionId: `eval-${c.id}`,
      }),
    });
    httpStatus = res.status;
    const json = (await res.json()) as {
      messages?: { role: string; content: string }[];
      error?: string | null;
    };
    if (!res.ok) {
      return {
        id: c.id,
        category: c.category,
        prompt: c.prompt,
        pass: false,
        reasons: [`HTTP ${res.status}: ${json.error ?? "unknown"}`],
        reply: "",
        latencyMs: Date.now() - t0,
        httpStatus,
      };
    }
    const last = json.messages?.[json.messages.length - 1];
    reply = last?.role === "assistant" ? last.content : "";
  } catch (e) {
    return {
      id: c.id,
      category: c.category,
      prompt: c.prompt,
      pass: false,
      reasons: [`fetch failed: ${(e as Error).message}`],
      reply: "",
      latencyMs: Date.now() - t0,
      httpStatus,
    };
  }

  const reasons = scoreCase(c, reply);
  if (!reply) reasons.unshift("empty reply");
  return {
    id: c.id,
    category: c.category,
    prompt: c.prompt,
    pass: reasons.length === 0,
    reasons,
    reply,
    latencyMs: Date.now() - t0,
    httpStatus,
  };
}

// Simple bounded-parallel runner. Stays cheap on free-tier rate limits.
async function runAll(): Promise<Result[]> {
  const out: Result[] = new Array(cases.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= cases.length) return;
      const c = cases[i];
      const r = await runCase(c);
      out[i] = r;
      const mark = r.pass ? "✓" : "✗";
      const tail = r.pass
        ? `${r.latencyMs}ms`
        : `${r.latencyMs}ms · ${r.reasons.join("; ")}`;
      console.log(`  ${mark} [${r.category}] ${r.id} — ${tail}`);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, cases.length) }, () => worker()),
  );
  return out;
}

(async () => {
  const results = await runAll();
  const passed = results.filter((r) => r.pass).length;
  const failed = results.length - passed;
  const byCategory: Record<string, { pass: number; fail: number }> = {};
  for (const r of results) {
    const b = (byCategory[r.category] ||= { pass: 0, fail: 0 });
    if (r.pass) b.pass++;
    else b.fail++;
  }
  const avgLatency =
    Math.round(
      (results.reduce((a, r) => a + r.latencyMs, 0) / results.length) * 10,
    ) / 10;

  console.log("");
  console.log(
    `[eval] ${passed}/${results.length} passed · avg latency ${avgLatency}ms`,
  );
  for (const [cat, b] of Object.entries(byCategory)) {
    console.log(`  ${cat.padEnd(15)} ${b.pass}/${b.pass + b.fail}`);
  }

  const outPath = resolve(OUTPUT_PATH);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        url: URL,
        storeId: STORE_ID,
        summary: { passed, failed, total: results.length, avgLatency, byCategory },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`[eval] Wrote ${outPath}`);

  if (failed > 0) process.exit(1);
})().catch((e) => {
  console.error("[eval] fatal:", e);
  process.exit(2);
});
