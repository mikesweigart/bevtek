// Auto-detect mapping from messy user spreadsheet headers to our inventory schema.

export type InventoryRowInput = {
  sku: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  size_ml: number | null;
  price: number | null;
  cost: number | null;
  stock_qty: number;
  description: string | null;
};

type FieldKey = keyof InventoryRowInput;

// Ordered: first matching synonym wins.
const SYNONYMS: Record<FieldKey, string[]> = {
  name: ["item name", "product name", "name", "description (short)"],
  sku: ["sku", "barcode", "gtin", "upc", "reference handle", "token"],
  brand: ["brand", "default vendor name", "vendor", "manufacturer"],
  category: [
    "category",
    "categories",
    "reporting category",
    "booze",
    "department",
    "subcategory",
  ],
  size_ml: ["ml", "size_ml", "size", "volume"],
  price: ["price", "rprice", "retail price", "sale price"],
  cost: ["cost", "default unit cost", "unit cost", "wholesale"],
  stock_qty: [
    "stock",
    "stock_qty",
    "qty",
    "quantity",
    "current quantity",
    "on hand",
  ],
  description: ["description", "notes", "tasting notes"],
};

function normalize(h: string): string {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}

export type ColumnMapping = Partial<Record<FieldKey, string>>; // FieldKey → original header

export function detectMapping(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  const normalized = headers.map((h) => ({ original: h, norm: normalize(h) }));

  for (const field of Object.keys(SYNONYMS) as FieldKey[]) {
    const candidates = SYNONYMS[field];
    const hit = normalized.find((h) =>
      candidates.some((c) => h.norm === c || h.norm.startsWith(c)),
    );
    if (hit) map[field] = hit.original;
  }

  // For stock, prefer summing across "current quantity ..." columns when present.
  // Mark the first one; the parser will aggregate.
  return map;
}

export function parseNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/[$,]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseInteger(v: unknown): number | null {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n);
}

export function mapRow(
  row: Record<string, unknown>,
  headers: string[],
  mapping: ColumnMapping,
): InventoryRowInput | null {
  const name = mapping.name ? String(row[mapping.name] ?? "").trim() : "";
  if (!name) return null;

  // Aggregate stock across any "current quantity ..." columns (Square export).
  let stock = 0;
  const stockCols = headers.filter((h) =>
    normalize(h).startsWith("current quantity"),
  );
  if (stockCols.length > 0) {
    for (const h of stockCols) stock += parseInteger(row[h]) ?? 0;
  } else if (mapping.stock_qty) {
    stock = parseInteger(row[mapping.stock_qty]) ?? 0;
  }

  return {
    sku: mapping.sku
      ? String(row[mapping.sku] ?? "").trim() || null
      : null,
    name,
    brand: mapping.brand
      ? String(row[mapping.brand] ?? "").trim() || null
      : null,
    category: mapping.category
      ? String(row[mapping.category] ?? "").trim() || null
      : null,
    size_ml: mapping.size_ml ? parseInteger(row[mapping.size_ml]) : null,
    price: mapping.price ? parseNumber(row[mapping.price]) : null,
    cost: mapping.cost ? parseNumber(row[mapping.cost]) : null,
    stock_qty: stock,
    description: mapping.description
      ? String(row[mapping.description] ?? "").trim() || null
      : null,
  };
}
