// End-to-end test for the deployed /api/retell/tools/search-inventory
// endpoint. Simulates what Retell's Conversation Flow will POST.
//
// Uses the live Vercel URL (not localhost) because that's what Retell
// will actually hit in production. Reads RETELL_TOOL_SECRET from
// apps/web/.env.local so the same secret value is tested in both places.
//
// Usage (from repo root):
//   pnpm tsx scripts/test-search-inventory.ts             # default: "bourbon"
//   pnpm tsx scripts/test-search-inventory.ts "red wine"  # custom query

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://bevtek-web.vercel.app";

function loadEnv(name: string): string | null {
  const path = resolve(process.cwd(), "apps/web/.env.local");
  const text = readFileSync(path, "utf8");
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
  if (!line) return null;
  return line.slice(`${name}=`.length).trim().replace(/^['"]|['"]$/g, "");
}

async function main() {
  const secret = loadEnv("RETELL_TOOL_SECRET");
  if (!secret) {
    console.error("✗ RETELL_TOOL_SECRET missing from apps/web/.env.local");
    process.exit(1);
  }

  const query = process.argv[2] ?? "bourbon";
  const url = `${BASE_URL}/api/retell/tools/search-inventory`;

  console.log(`→ POST ${url}`);
  console.log(`  query: "${query}"\n`);

  // Simulate Retell's function-node body shape.
  const body = {
    name: "search_inventory",
    args: { query },
    call: {
      call_id: "test_call_local",
      from_number: "+15555550123",
      to_number: "",
      agent_id: "agent_test",
      direction: "inbound",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log(`← HTTP ${res.status}`);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("Response was not JSON:");
    console.error(text.slice(0, 500));
    process.exit(1);
  }

  console.log(JSON.stringify(parsed, null, 2));
  console.log();

  // Checks
  if (res.status === 401) {
    console.error("✗ 401 Unauthorized — RETELL_TOOL_SECRET mismatch between local and Vercel.");
    console.error("  Verify the secret on Vercel matches the one in apps/web/.env.local.");
    process.exit(1);
  }
  if (res.status === 500) {
    const p = parsed as { error?: string };
    if (p.error === "server misconfigured") {
      console.error("✗ Server misconfigured — Vercel doesn't have RETELL_TOOL_SECRET set yet.");
      console.error("  Add it under Vercel env vars and REDEPLOY (not just save).");
    } else {
      console.error("✗ Internal server error — check Vercel logs.");
    }
    process.exit(1);
  }
  if (res.status !== 200) {
    console.error(`✗ Unexpected HTTP ${res.status}`);
    process.exit(1);
  }

  const p = parsed as { found?: number; items?: unknown[]; note?: string };
  if (p.note === "store_not_resolved") {
    console.error("✗ Store not resolved — RETELL_PILOT_STORE_ID missing or wrong on Vercel.");
    process.exit(1);
  }
  if (typeof p.found !== "number" || !Array.isArray(p.items)) {
    console.error("✗ Unexpected response shape.");
    process.exit(1);
  }

  if (p.found === 0) {
    console.log(`⚠ Endpoint works but found 0 items for "${query}".`);
    console.log("  Try a different query (e.g. a brand you know the store carries).");
    console.log("  This is NOT a failure — just means the search came up empty.");
  } else {
    console.log(`✓ SUCCESS — endpoint returned ${p.found} item(s) for "${query}".`);
    console.log("  Ready to wire the function node in Retell.");
  }
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
