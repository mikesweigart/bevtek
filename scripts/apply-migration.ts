/**
 * apply-migration — safe, auditable SQL runner for BevTek.
 *
 * Replaces "paste into Supabase SQL editor and hope." Every migration:
 *   1. Gets hashed (sha256).
 *   2. Is skipped if the ledger already has that filename.
 *   3. Fails loudly if the hash changed after it was applied (someone
 *      edited a migration file post-hoc).
 *   4. Runs inside a transaction — any error rolls back the entire file.
 *   5. Is recorded in public._migrations on success.
 *
 * Usage:
 *   # Apply one specific file
 *   pnpm exec tsx scripts/apply-migration.ts supabase/migrations/20260418230000_migration_tracking.sql
 *
 *   # Apply every pending migration in order
 *   pnpm exec tsx scripts/apply-migration.ts --all
 *
 *   # Dry run — show what WOULD happen
 *   pnpm exec tsx scripts/apply-migration.ts --all --dry-run
 *
 * Environment:
 *   SUPABASE_DB_URL   Postgres connection string with the service role
 *                     password. Get from Supabase dashboard → Settings →
 *                     Database → Connection string (URI). NEVER commit this.
 *
 * Note: because pre-existing migrations were applied via the editor, the
 * tracking migration (20260418230000) seeds a 'pre-ledger' marker. After
 * that marker lands, every NEW migration flows through this script.
 */

import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { Client } from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");

async function sha256(filepath: string): Promise<string> {
  const buf = await readFile(filepath);
  return createHash("sha256").update(buf).digest("hex");
}

async function listMigrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort(); // lexicographic = chronological given our YYYYMMDDHHMMSS prefix
}

type AppliedRow = { filename: string; sha256: string };

async function fetchApplied(client: Client): Promise<Map<string, string>> {
  // Handle the chicken-and-egg: on a fresh DB the _migrations table may
  // not exist yet. Return empty and the first migration creates it.
  try {
    const res = await client.query<AppliedRow>(
      "select filename, sha256 from public._migrations",
    );
    return new Map(res.rows.map((r) => [r.filename, r.sha256]));
  } catch (e: unknown) {
    const msg = (e as { message?: string })?.message ?? "";
    if (msg.includes("does not exist")) return new Map();
    throw e;
  }
}

async function applyOne(
  client: Client,
  filename: string,
  dryRun: boolean,
): Promise<void> {
  const full = path.join(MIGRATIONS_DIR, filename);
  const sql = await readFile(full, "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");

  if (dryRun) {
    console.log(`  [dry-run] would apply ${filename} (sha256=${hash.slice(0, 12)}…)`);
    return;
  }

  const started = Date.now();
  await client.query("begin");
  try {
    await client.query(sql);
    // Best-effort: once the tracking table exists, record this run.
    await client.query(
      `insert into public._migrations (filename, sha256, applied_by, duration_ms)
       values ($1, $2, 'script', $3)
       on conflict (filename) do nothing`,
      [filename, hash, Date.now() - started],
    );
    await client.query("commit");
    console.log(
      `  ✓ applied ${filename} (${Date.now() - started}ms, sha256=${hash.slice(0, 12)}…)`,
    );
  } catch (e) {
    await client.query("rollback");
    throw new Error(`Failed on ${filename}: ${(e as Error).message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const explicit = args.find((a) => !a.startsWith("--"));

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error(
      "SUPABASE_DB_URL not set. Get it from Supabase → Settings → Database → Connection string (URI).",
    );
    process.exit(1);
  }
  if (!all && !explicit) {
    console.error("Usage: apply-migration.ts <file.sql> | --all [--dry-run]");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const applied = await fetchApplied(client);
    const files = all
      ? await listMigrationFiles()
      : [path.basename(explicit as string)];

    const pending: string[] = [];
    let hashMismatches = 0;
    for (const f of files) {
      const full = path.join(MIGRATIONS_DIR, f);
      const diskHash = await sha256(full);
      const dbHash = applied.get(f);
      if (!dbHash) {
        pending.push(f);
      } else if (dbHash !== diskHash && dbHash !== "n/a") {
        console.warn(
          `  ⚠  HASH MISMATCH: ${f}\n     on-disk: ${diskHash.slice(0, 12)}…\n     in DB:   ${dbHash.slice(0, 12)}…\n     Someone edited this file after it ran. Do NOT re-apply.`,
        );
        hashMismatches++;
      } else {
        if (all) console.log(`  · skip ${f} (already applied)`);
      }
    }

    if (hashMismatches > 0) {
      console.error(
        `\n${hashMismatches} hash mismatch(es). Refusing to continue. Investigate before re-running.`,
      );
      process.exit(2);
    }

    if (pending.length === 0) {
      console.log("Nothing to apply. DB is up to date.");
      return;
    }

    console.log(`\n${dryRun ? "Would apply" : "Applying"} ${pending.length} migration(s):`);
    for (const f of pending) {
      await applyOne(client, f, dryRun);
    }
    console.log(`\n${dryRun ? "Dry run complete." : "Done."}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
