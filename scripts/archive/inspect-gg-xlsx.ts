// Quick structural inspection of the Grapes & Grains Chamblee XLSX file
// so we can design the price-import script around its real columns.
//
// Usage (from repo root):
//   pnpm tsx scripts/inspect-gg-xlsx.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const FILE = resolve(
  process.cwd(),
  "G&G Chamblee Inventory List.xlsx",
);

const buf = readFileSync(FILE);
const wb = XLSX.read(buf, { type: "buffer" });

console.log("Sheet names:", wb.SheetNames);
console.log();

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  if (!ws) continue;

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
  });

  console.log(`────────── Sheet: "${name}" ──────────`);
  console.log(`  row count: ${rows.length}`);
  if (rows.length === 0) {
    console.log("  (empty)");
    continue;
  }

  const first = rows[0];
  if (!first) continue;
  const headers = Object.keys(first);
  console.log(`  columns (${headers.length}):`);
  for (const h of headers) console.log(`    - ${h}`);

  console.log(`  first 3 rows:`);
  for (const row of rows.slice(0, 3)) {
    console.log("    " + JSON.stringify(row));
  }
  console.log();
}
