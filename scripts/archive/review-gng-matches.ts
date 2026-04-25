/**
 * review-gng-matches — audit the matches.ndjson output from
 * scrape-grapes-and-grains before committing to the DB.
 *
 * Groups matches by match_type and score bucket, samples N per bucket,
 * and writes an HTML report with side-by-side scraped-vs-catalog names
 * plus the candidate image. Eyeballing 20-40 rows catches false
 * positives that the threshold tuning missed.
 *
 * USAGE:
 *   pnpm tsx scripts/review-gng-matches.ts              # console table
 *   pnpm tsx scripts/review-gng-matches.ts --html       # also write HTML file
 *   pnpm tsx scripts/review-gng-matches.ts --samples=20 # N per bucket
 */
import process from "node:process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

type Match = {
  gng_product_id: string;
  gng_name: string;
  gng_image_url: string;
  catalog_product_id: string;
  catalog_canonical_name: string;
  match_type: "fingerprint" | "core_name_size" | "core_name_only" | "token_overlap";
  match_score: number;
};

const MATCHES_PATH = "scripts/eval-results/grapes-and-grains/matches.ndjson";
const REPORT_PATH = "scripts/eval-results/grapes-and-grains/match-review.html";

function parseArgs() {
  let html = false;
  let samples = 10;
  for (const a of process.argv.slice(2)) {
    if (a === "--html") html = true;
    else if (a.startsWith("--samples=")) samples = Number(a.split("=")[1]) || 10;
  }
  return { html, samples };
}

function bucket(m: Match): string {
  if (m.match_type !== "token_overlap") return m.match_type;
  // Token-overlap is the risky tier — bucket by score band so we can
  // focus review on the low-confidence end.
  if (m.match_score >= 0.9) return "token_overlap_0.90+";
  if (m.match_score >= 0.75) return "token_overlap_0.75-0.90";
  if (m.match_score >= 0.6) return "token_overlap_0.60-0.75";
  return "token_overlap_0.50-0.60";
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function main() {
  const args = parseArgs();
  if (!existsSync(MATCHES_PATH)) {
    console.error(`Missing ${MATCHES_PATH}. Run match phase first.`);
    process.exit(1);
  }
  const matches: Match[] = readFileSync(MATCHES_PATH, "utf-8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`\nloaded ${matches.length} matches from ${MATCHES_PATH}\n`);

  // Count + sample per bucket
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const b = bucket(m);
    (buckets.get(b) ?? buckets.set(b, []).get(b)!).push(m);
  }

  // Sorted bucket order: fingerprint first (safest), token_overlap_0.50-0.60 last (riskiest)
  const ORDER = [
    "fingerprint",
    "core_name_size",
    "core_name_only",
    "token_overlap_0.90+",
    "token_overlap_0.75-0.90",
    "token_overlap_0.60-0.75",
    "token_overlap_0.50-0.60",
  ];
  const summary = ORDER.filter((b) => buckets.has(b)).map((b) => ({
    bucket: b,
    count: buckets.get(b)!.length,
    pct: ((buckets.get(b)!.length / matches.length) * 100).toFixed(1) + "%",
  }));
  console.log("distribution:");
  console.table(summary);

  console.log("\nsamples (random per bucket, riskiest first):\n");
  for (const b of [...ORDER].reverse()) {
    const rows = buckets.get(b);
    if (!rows) continue;
    const sample = shuffle(rows).slice(0, args.samples);
    console.log(`\n=== ${b} (${rows.length} total, showing ${sample.length}) ===`);
    for (const m of sample) {
      const tag = b.includes("token_overlap")
        ? `tok(${m.match_score.toFixed(2)})`
        : m.match_type.slice(0, 8);
      console.log(
        `  [${tag.padEnd(10)}]  "${m.gng_name.slice(0, 45).padEnd(45)}"  →  ${m.catalog_canonical_name.slice(0, 45)}`,
      );
    }
  }

  if (args.html) {
    const rowsHtml = ORDER.flatMap((b) => {
      const rows = buckets.get(b);
      if (!rows) return [];
      const sample = shuffle(rows).slice(0, args.samples);
      return sample.map(
        (m) => `
      <tr class="bucket-${b.replace(/[^a-z0-9]/gi, "-")}">
        <td><span class="bucket-tag">${b}</span></td>
        <td class="num">${m.match_score.toFixed(2)}</td>
        <td>${escape(m.gng_name)}</td>
        <td>${escape(m.catalog_canonical_name)}</td>
        <td><a href="${m.gng_image_url}" target="_blank"><img src="${m.gng_image_url}" alt="" loading="lazy" /></a></td>
      </tr>`,
      );
    }).join("");

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>G&amp;G match review</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; padding: 24px; max-width: 1400px; margin: auto; }
  h1 { color: #C8984E; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: top; text-align: left; }
  th { background: #fafafa; position: sticky; top: 0; }
  img { max-height: 80px; max-width: 80px; border: 1px solid #eee; border-radius: 4px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .bucket-tag { font-size: 11px; padding: 2px 6px; border-radius: 3px; background: #eee; }
  tr.bucket-token-overlap-0-50-0-60 { background: #fff5f5; }
  tr.bucket-token-overlap-0-60-0-75 { background: #fffaf0; }
  tr.bucket-fingerprint { background: #f0fff4; }
  .summary { display: inline-block; margin-right: 24px; padding: 8px 12px; border-radius: 4px; background: #f7f7f7; }
</style>
</head>
<body>
  <h1>Grapes &amp; Grains match review</h1>
  <p>${matches.length} total matches. Review the lowest-confidence bucket first — that's where false positives hide.</p>
  <p>${summary.map((s) => `<span class="summary"><strong>${s.bucket}</strong>: ${s.count} (${s.pct})</span>`).join("")}</p>
  <table>
    <thead>
      <tr><th>Bucket</th><th>Score</th><th>Scraped (G&amp;G)</th><th>Catalog canonical_name</th><th>Image</th></tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    writeFileSync(REPORT_PATH, html);
    console.log(`\n[review] wrote ${REPORT_PATH} — open it in a browser to eyeball samples.`);
  }
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main();
