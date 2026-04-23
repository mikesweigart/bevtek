/**
 * check-gng-urls — HEAD 20 random URLs from matches.ndjson to verify the
 * City Hive CDN actually serves images at the scraped paths.
 *
 * Why: the match phase proves "name alignment is right." This proves "the
 * URL we'd write to image_url actually resolves to a live image." Both
 * checks must pass before --write is safe.
 *
 * Samples evenly across match tiers so we catch pattern-specific breakage
 * (e.g. if token_overlap matches point at a different CDN shape).
 */
import process from "node:process";
import { readFileSync, existsSync } from "node:fs";

function loadDotenv(): void {
  const envPath = existsSync(".env.local") ? ".env.local" : existsSync(".env") ? ".env" : null;
  if (!envPath) return;
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trim = line.trim();
    if (!trim || trim.startsWith("#")) continue;
    const eq = trim.indexOf("=");
    if (eq < 0) continue;
    const key = trim.slice(0, eq).trim();
    let val = trim.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadDotenv();

type Match = {
  gng_name: string;
  gng_image_url: string;
  catalog_canonical_name: string;
  match_type: string;
  match_score: number;
};

const MATCHES_PATH = "scripts/eval-results/grapes-and-grains/matches.ndjson";
const SAMPLE_PER_TIER = 5;
const TIMEOUT_MS = 10_000;

async function headCheck(url: string): Promise<{
  ok: boolean;
  status: number;
  contentType: string | null;
  contentLength: string | null;
  error?: string;
}> {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length"),
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      contentType: null,
      contentLength: null,
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(to);
  }
}

function pickSample(matches: Match[], n: number): Match[] {
  const copy = [...matches];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

async function main() {
  if (!existsSync(MATCHES_PATH)) {
    console.error(`missing ${MATCHES_PATH}`);
    process.exit(1);
  }
  const all: Match[] = readFileSync(MATCHES_PATH, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  // Bucket by tier so we sample evenly across match types — catches
  // pattern-specific breakage that uniform random sampling might miss.
  const tiers: Record<string, Match[]> = {
    fingerprint: [],
    core_name_size: [],
    core_name_only: [],
    token_overlap_high: [],
    token_overlap_mid: [],
    token_overlap_low: [],
  };
  for (const m of all) {
    if (m.match_type === "fingerprint") tiers.fingerprint.push(m);
    else if (m.match_type === "core_name_size") tiers.core_name_size.push(m);
    else if (m.match_type === "core_name_only") tiers.core_name_only.push(m);
    else if (m.match_score >= 0.75) tiers.token_overlap_high.push(m);
    else if (m.match_score >= 0.6) tiers.token_overlap_mid.push(m);
    else tiers.token_overlap_low.push(m);
  }

  const sample: { tier: string; match: Match }[] = [];
  for (const [tier, rows] of Object.entries(tiers)) {
    for (const m of pickSample(rows, SAMPLE_PER_TIER)) sample.push({ tier, match: m });
  }

  console.log(`\nchecking ${sample.length} URLs (HEAD, ${TIMEOUT_MS}ms timeout each)\n`);

  const results = await Promise.all(
    sample.map(async ({ tier, match }) => ({ tier, match, res: await headCheck(match.gng_image_url) })),
  );

  let okCount = 0;
  let badCount = 0;
  for (const { tier, match, res } of results) {
    const isImage = res.contentType?.startsWith("image/") ?? false;
    const pass = res.ok && isImage;
    if (pass) okCount++;
    else badCount++;
    const tag = pass ? "OK " : "FAIL";
    const ct = res.contentType ?? "-";
    const size = res.contentLength ? `${Math.round(Number(res.contentLength) / 1024)}kb` : "?";
    console.log(
      `  [${tag}] ${tier.padEnd(20)} ${String(res.status).padEnd(4)} ${ct.padEnd(12)} ${size.padEnd(6)}  ${match.gng_name.slice(0, 40)}`,
    );
    if (!pass && res.error) console.log(`         err: ${res.error}`);
  }

  console.log(`\nresult: ${okCount} ok, ${badCount} fail (of ${results.length})`);
  if (badCount > 0) {
    console.log("\n!!! some URLs failed — do NOT run --write until the pattern is understood.");
    process.exit(1);
  } else {
    console.log("all URLs resolve to images. safe to proceed with --write.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
