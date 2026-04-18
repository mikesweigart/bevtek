// Structured query parser for the /inventory search box.
//
// Owners type things like:
//   "rum under $30 with stock > 5"
//   "out of stock wine"
//   "pinot under 25"
//   "whiskey in stock"
//
// We parse those predicates out of the raw string, leaving the
// remainder as a free-text search over name/brand/SKU. Nothing in the
// grammar is required — if the query looks nothing like a structured
// phrase, every predicate ends up `null` and the remaining text is the
// whole original input, so callers fall through to the current search.
//
// Parsing is deliberately permissive: "$", dollar signs optional,
// `stock` tolerates `qty`/`inventory`, category aliases cover the
// shopper-facing words ("rum", "pinot") rather than the formal
// category_group labels.

import { CATEGORY_GROUPS, type CategoryGroup } from "./categoryGroup";

export type ParsedQuery = {
  text: string; // free-text remainder for name/brand/SKU ilike
  priceMin: number | null;
  priceMax: number | null;
  stockMin: number | null;
  stockMax: number | null;
  group: CategoryGroup | null;
  // For the UI — each removable chip the user sees above results.
  chips: Array<{ label: string; removes: "price" | "stock" | "group" }>;
};

// Group aliases the owner is likely to type.
const GROUP_ALIASES: Array<{ rx: RegExp; group: CategoryGroup }> = [
  { rx: /\b(rum)s?\b/i, group: "Rum & Rum-Based" },
  {
    rx: /\b(whisk(e)?y|bourbon|scotch|rye)s?\b/i,
    group: "Whiskey & Whiskey-Based",
  },
  { rx: /\b(vodkas?)\b/i, group: "Vodka & Vodka-Based" },
  { rx: /\b(gins?)\b/i, group: "Gin & Gin-Based" },
  { rx: /\b(tequilas?|mezcal)\b/i, group: "Tequila & Mezcal" },
  {
    rx: /\b(beers?|ciders?|lagers?|ales?|ipas?|stouts?|porters?)\b/i,
    group: "Beer & Cider",
  },
  {
    rx: /\b(wines?|champagnes?|proseccos?|rosés?|roses?|sparkling|reds?|whites?)\b/i,
    group: "Wine & Sparkling",
  },
  {
    rx: /\b(seltzers?|rtds?|hard\s+seltzer)\b/i,
    group: "RTDs & Hard Seltzers",
  },
  {
    rx: /\b(liqueurs?|cordials?|cognacs?|brandys?|brandies)\b/i,
    group: "Liqueurs & Cordials",
  },
  {
    rx: /\b(non-?alcoholic|zero-?proof|n\/a|sodas?|mixers?)\b/i,
    group: "Non-Alcoholic Beverages",
  },
  { rx: /\b(cigars?|tobacco|vapes?)\b/i, group: "Cigars & Tobacco" },
];

function fmtMoney(n: number): string {
  return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)}`;
}

export function parseInventoryQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = {
    text: raw,
    priceMin: null,
    priceMax: null,
    stockMin: null,
    stockMax: null,
    group: null,
    chips: [],
  };
  let working = ` ${raw.trim()} `;

  // --- Stock predicates ----------------------------------------------
  // "out of stock" / "in stock" / "stock > 5" / "qty < 3" / "stock between 2 and 10"
  if (/\bout\s+of\s+stock\b/i.test(working)) {
    out.stockMax = 0;
    out.stockMin = 0;
    working = working.replace(/\bout\s+of\s+stock\b/i, " ");
    out.chips.push({ label: "Out of stock", removes: "stock" });
  } else if (/\bin\s+stock\b/i.test(working)) {
    out.stockMin = 1;
    working = working.replace(/\bin\s+stock\b/i, " ");
    out.chips.push({ label: "In stock", removes: "stock" });
  } else {
    const gt = working.match(
      /\b(?:stock|qty|quantity|inventory)\s*(?:>=|>|at\s*least|over|above|more\s*than)\s*(\d+)/i,
    );
    const lt = working.match(
      /\b(?:stock|qty|quantity|inventory)\s*(?:<=|<|at\s*most|under|below|less\s*than)\s*(\d+)/i,
    );
    if (gt) {
      out.stockMin = parseInt(gt[1], 10) + (/>=|at\s*least/i.test(gt[0]) ? 0 : 1);
      working = working.replace(gt[0], " ");
      out.chips.push({
        label: `Stock ≥ ${out.stockMin}`,
        removes: "stock",
      });
    }
    if (lt) {
      out.stockMax = parseInt(lt[1], 10) - (/<=|at\s*most/i.test(lt[0]) ? 0 : 1);
      working = working.replace(lt[0], " ");
      out.chips.push({
        label: `Stock ≤ ${out.stockMax}`,
        removes: "stock",
      });
    }
  }

  // --- Price predicates ----------------------------------------------
  // "$15-40" / "between $20 and $50"
  const range = working.match(
    /\$?\s*(\d+(?:\.\d+)?)\s*(?:-|to|and)\s*\$?\s*(\d+(?:\.\d+)?)/i,
  );
  if (range) {
    // Only treat as price range if the phrase mentions money or the
    // numbers are plausibly prices (>= 5, to avoid eating quantity ranges).
    const mentionsMoney = /\$/.test(range[0]) || /\bbetween\b/i.test(range[0]);
    const a = parseFloat(range[1]);
    const b = parseFloat(range[2]);
    if (mentionsMoney && a < b && b <= 10000) {
      out.priceMin = a;
      out.priceMax = b;
      working = working.replace(range[0], " ");
      out.chips.push({
        label: `${fmtMoney(a)}–${fmtMoney(b)}`,
        removes: "price",
      });
    }
  }
  if (out.priceMax === null) {
    const under = working.match(
      /\b(?:under|below|less\s*than|max|up\s*to|<=|<)\s*\$?\s*(\d+(?:\.\d+)?)/i,
    );
    if (under) {
      out.priceMax = parseFloat(under[1]);
      working = working.replace(under[0], " ");
      out.chips.push({
        label: `under ${fmtMoney(out.priceMax)}`,
        removes: "price",
      });
    }
  }
  if (out.priceMin === null) {
    const over = working.match(
      /\b(?:over|above|more\s*than|min|at\s*least|>=|>)\s*\$?\s*(\d+(?:\.\d+)?)/i,
    );
    if (over) {
      out.priceMin = parseFloat(over[1]);
      working = working.replace(over[0], " ");
      out.chips.push({
        label: `over ${fmtMoney(out.priceMin)}`,
        removes: "price",
      });
    }
  }

  // --- Category group -------------------------------------------------
  for (const alias of GROUP_ALIASES) {
    if (alias.rx.test(working)) {
      out.group = alias.group;
      working = working.replace(alias.rx, " ");
      out.chips.push({ label: out.group, removes: "group" });
      break;
    }
  }

  // Filler words that don't belong in the text query after extraction.
  working = working
    .replace(
      /\b(with|and|&|that|have|having|which|where|all|the|for|items?|products?)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  out.text = working;
  return out;
}

// Re-export so callers don't need two imports.
export { CATEGORY_GROUPS };
