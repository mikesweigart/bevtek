// Quick sanity check for the RETELL_API_KEY in apps/web/.env.local.
// Reads the env file directly (dotenv-free, no deps), makes one API call
// to Retell's list-agents endpoint, and reports pass/fail. Key never leaves
// the process.
//
// Usage:
//   pnpm tsx scripts/test-retell-key.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadKey(): string | null {
  const path = resolve(process.cwd(), "apps/web/.env.local");
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    console.error(`✗ Couldn't read ${path}: ${(e as Error).message}`);
    return null;
  }
  const line = text.split(/\r?\n/).find((l) => l.startsWith("RETELL_API_KEY="));
  if (!line) {
    console.error("✗ No RETELL_API_KEY line in apps/web/.env.local.");
    return null;
  }
  const value = line.slice("RETELL_API_KEY=".length).trim();
  // Strip surrounding quotes if user wrapped it
  return value.replace(/^['"]|['"]$/g, "");
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.error("Open apps/web/.env.local in Notepad and add:");
    console.error("  RETELL_API_KEY=<paste your key here>");
    process.exit(1);
  }

  console.log(`Key loaded — starts with: ${key.slice(0, 10)}...  length: ${key.length}`);

  const res = await fetch("https://api.retellai.com/list-agents", {
    headers: { Authorization: `Bearer ${key}` },
  });

  const body = await res.text();

  if (res.status === 200) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = body;
    }
    const count = Array.isArray(parsed) ? parsed.length : "unknown";
    console.log(`✓ AUTHENTICATED — Retell says you have ${count} existing agent(s).`);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log("Existing agents:");
      for (const a of parsed as Array<{ agent_id?: string; agent_name?: string }>) {
        console.log(`   • ${a.agent_id ?? "?"}   ${a.agent_name ?? ""}`);
      }
    }
    process.exit(0);
  }

  console.error(`✗ Retell rejected the key (HTTP ${res.status}).`);
  console.error(`Response: ${body.slice(0, 300)}`);
  console.error("");
  console.error("Most common causes:");
  console.error("  • Extra whitespace / quotes around the key in .env.local");
  console.error("  • Copied only part of the key (truncated)");
  console.error("  • Used a public/client key instead of the server key");
  console.error("");
  console.error("Open apps/web/.env.local in Notepad and verify the line looks like:");
  console.error("  RETELL_API_KEY=key_abc123...   (no spaces, no quotes)");
  process.exit(1);
}

main().catch((e) => {
  console.error("✗ Unexpected error:", e);
  process.exit(1);
});
