// Check whether null-sku DB items are findable in the XLSX by name.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";

const wb = XLSX.read(
  readFileSync(resolve(process.cwd(), "G&G Chamblee Inventory List.xlsx")),
  { type: "buffer" },
);
const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
if (!sheet) process.exit(1);
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

const needles = [
  "HAKUSHU 12 YEAR",
  "FIREBALL BLAZIN APPLE",
  "LANDSHARK ISLAND LAGER",
  "MUGA RIOJA ROSE",
  "PERDOMO 10TH ANNIVERSARY",
];

for (const needle of needles) {
  const hits = rows.filter((r) => {
    const n = (r["Product Name "] as string | null) ?? "";
    return n.toUpperCase().includes(needle.toUpperCase());
  });
  console.log(`"${needle}" → ${hits.length} hit(s)`);
  for (const h of hits.slice(0, 3)) {
    console.log(
      `  sku=${h["Product Number"]}  name="${h["Product Name "]}"  price=${h["Product Retail Price (Date)"]}`,
    );
  }
}
