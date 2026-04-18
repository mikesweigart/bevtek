/**
 * check-rls — refuses to pass if any public table is missing RLS.
 *
 * Multi-tenant isolation in BevTek is enforced by row-level security on
 * every user-data table. Forgetting to enable RLS on a new table is the
 * easiest way to leak data between stores. This script runs against
 * staging/prod and asserts:
 *
 *   1. Every table in the `public` schema has rowsecurity = true.
 *   2. Every table with RLS has at least one policy (RLS without a
 *      policy blocks all reads including the store's own — catches
 *      the "enabled but forgotten" case too).
 *
 * Exceptions are tables that legitimately have no tenant (static lookups,
 * the migration ledger itself). Add them to the ALLOWLIST below with a
 * reason comment.
 *
 * Usage:
 *   SUPABASE_DB_URL=... pnpm db:rls-check
 *
 * Exit codes:
 *   0 — all good
 *   1 — bad config (no DB URL)
 *   2 — one or more tables violate the policy
 */

import process from "node:process";
import { Client } from "pg";

// Tables that intentionally have no tenant scoping. Keep this list SHORT
// and annotated. Every entry is a deliberate trade-off.
const ALLOWLIST: Record<string, string> = {
  _migrations: "Migration ledger — service-role only, no user access needed.",
  // Add more here with a reason. No entry = must have RLS + at least one policy.
};

type TableRow = { tablename: string; rowsecurity: boolean };
type PolicyRow = { tablename: string };

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const tables = await client.query<TableRow>(
      `select tablename, rowsecurity
         from pg_tables
        where schemaname = 'public'
        order by tablename`,
    );
    const policies = await client.query<PolicyRow>(
      `select distinct tablename
         from pg_policies
        where schemaname = 'public'`,
    );
    const withPolicy = new Set(policies.rows.map((r) => r.tablename));

    const missingRls: string[] = [];
    const noPolicy: string[] = [];

    for (const t of tables.rows) {
      if (ALLOWLIST[t.tablename]) continue;
      if (!t.rowsecurity) {
        missingRls.push(t.tablename);
        continue;
      }
      if (!withPolicy.has(t.tablename)) {
        noPolicy.push(t.tablename);
      }
    }

    if (missingRls.length === 0 && noPolicy.length === 0) {
      console.log(
        `✓ RLS check passed (${tables.rows.length} tables, ${Object.keys(ALLOWLIST).length} allowlisted).`,
      );
      return;
    }

    if (missingRls.length > 0) {
      console.error("\n✗ RLS NOT ENABLED on these tables:");
      for (const t of missingRls) console.error(`    - ${t}`);
      console.error(
        "\n  Fix: add `alter table <name> enable row level security;` to a migration.",
      );
    }
    if (noPolicy.length > 0) {
      console.error("\n✗ RLS enabled but NO POLICY exists on these tables:");
      for (const t of noPolicy) console.error(`    - ${t}`);
      console.error(
        "\n  Fix: add at least one `create policy ... on <name> ...` statement. Without a policy, RLS blocks everything — users can't read their own data either.",
      );
    }
    console.error(
      "\n  If a table is intentionally policy-free (e.g. service-role-only), add it to ALLOWLIST in scripts/check-rls.ts with a reason.",
    );
    process.exit(2);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
