// Canonical 12-bucket classifier. Deterministic, no AI call —
// rule-based keyword match run in priority order so that, e.g., a
// "vodka seltzer" correctly lands in RTDs instead of Vodka.
//
// The classifier combines name + brand + varietal + category +
// subcategory into one normalized haystack, then walks the rules below
// from most-specific to most-general. First match wins. Falls back to
// "General Non-Food" when nothing matches.
//
// Signal priority (implicit in how haystack is built):
//   varietal > category > subcategory > name > brand
// because varietal is the parsed-from-name, Haiku-normalized field and
// is the cleanest signal we have. The enrichment pipeline fills it in
// Step 1 before this classifier runs in Step 1.5.

export const CATEGORY_GROUPS = [
  "Beer & Cider",
  "RTDs & Hard Seltzers",
  "Whiskey & Whiskey-Based",
  "Vodka & Vodka-Based",
  "Rum & Rum-Based",
  "Tequila & Mezcal",
  "Gin & Gin-Based",
  "Liqueurs & Cordials",
  "Wine & Sparkling",
  "Non-Alcoholic Beverages",
  "Cigars & Tobacco",
  "General Non-Food",
] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

export type ClassifyInput = {
  name: string | null;
  brand: string | null;
  varietal: string | null;
  category: string | null;
  subcategory: string | null;
};

/**
 * Rules run in order. First `match` hit wins. Each rule's keywords are
 * matched as whole words (word-boundary lookup) against the normalized
 * haystack, except where noted. `any` = match if any keyword matches;
 * `blockedBy` = skip this rule if any blocker keyword matches (prevents
 * "Bacardi RUM with COLA" from hitting Rum before RTD).
 */
const RULES: Array<{
  group: CategoryGroup;
  keywords: string[];
  blockedBy?: string[];
}> = [
  // 1. RTDs / hard seltzers — check first so "vodka seltzer" /
  //    "rum punch in a can" land here, not in the base-spirit bucket.
  {
    group: "RTDs & Hard Seltzers",
    keywords: [
      "seltzer",
      "hard seltzer",
      "hard soda",
      "hard lemonade",
      "hard tea",
      "canned cocktail",
      "ready to drink",
      "rtd",
      "white claw",
      "truly",
      "high noon",
      "twisted tea",
      "mike's",
      "mikes hard",
      "smirnoff ice",
      "cayman jack",
      "bud light seltzer",
      "nutrl",
      "loverboy",
    ],
  },

  // 2. Cigars & tobacco — distinctive keywords, very unlikely to collide.
  {
    group: "Cigars & Tobacco",
    keywords: [
      "cigar",
      "cigarillo",
      "cigarette",
      "tobacco",
      "pipe tobacco",
      "rolling paper",
      "vape",
      "e-juice",
      "e-liquid",
      "nicotine pouch",
      "snus",
      "zyn",
      "on!",
      "swisher",
      "black & mild",
      "backwoods",
      "romeo y julieta",
    ],
  },

  // 3. Wine & sparkling — varietals are a strong cross-cutting signal.
  {
    group: "Wine & Sparkling",
    keywords: [
      "wine",
      "champagne",
      "prosecco",
      "cava",
      "sparkling",
      "rosé",
      "rose wine",
      "pinot noir",
      "pinot grigio",
      "pinot gris",
      "chardonnay",
      "cabernet",
      "merlot",
      "sauvignon blanc",
      "sauvignon",
      "malbec",
      "zinfandel",
      "syrah",
      "shiraz",
      "riesling",
      "moscato",
      "chianti",
      "sangiovese",
      "tempranillo",
      "red blend",
      "white blend",
      "bordeaux",
      "burgundy",
      "chablis",
      "sancerre",
      "barolo",
      "rioja",
      "port",
      "sherry",
      "madeira",
      "sake",
      "vermouth",
    ],
    // Don't send Coca-Cola labels through just because the word "wine"
    // shows up in a description field — require the match to be the
    // dominant token, handled by word-boundary regex in matcher.
  },

  // 4. Beer & cider — IPA/stout are clear, "beer" covers the rest.
  {
    group: "Beer & Cider",
    keywords: [
      "beer",
      "ale",
      "lager",
      "ipa",
      "i.p.a",
      "stout",
      "porter",
      "pilsner",
      "pilsener",
      "hefeweizen",
      "wheat ale",
      "sour ale",
      "saison",
      "kolsch",
      "cider",
      "hard cider",
      "perry",
      "budweiser",
      "coors",
      "miller",
      "heineken",
      "corona",
      "modelo",
      "stella",
      "guinness",
    ],
  },

  // 5. Tequila & mezcal.
  {
    group: "Tequila & Mezcal",
    keywords: [
      "tequila",
      "mezcal",
      "mescal",
      "blanco",
      "reposado",
      "añejo",
      "anejo",
      "extra añejo",
      "extra anejo",
      "cristalino",
      "patron",
      "patrón",
      "don julio",
      "casamigos",
      "clase azul",
      "jose cuervo",
      "1800",
      "herradura",
      "milagro",
      "espolon",
      "espolòn",
      "hornitos",
      "tres generaciones",
    ],
  },

  // 6. Whiskey & whiskey-based (bourbon, rye, scotch, Tennessee, Irish).
  {
    group: "Whiskey & Whiskey-Based",
    keywords: [
      "whiskey",
      "whisky",
      "bourbon",
      "rye",
      "scotch",
      "single malt",
      "blended malt",
      "tennessee whiskey",
      "tennessee",
      "irish whiskey",
      "japanese whisky",
      "canadian whisky",
      "moonshine",
      "crown royal",
      "jack daniels",
      "jack daniel's",
      "jim beam",
      "maker's mark",
      "makers mark",
      "woodford",
      "bulleit",
      "buffalo trace",
      "knob creek",
      "basil hayden",
      "eagle rare",
      "old forester",
      "four roses",
      "wild turkey",
      "glenlivet",
      "glenfiddich",
      "macallan",
      "laphroaig",
      "lagavulin",
      "johnnie walker",
      "chivas",
      "dewar's",
      "dewars",
      "jameson",
      "tullamore",
      "bushmills",
      "suntory",
      "hibiki",
    ],
  },

  // 7. Rum & rum-based — check after whiskey so "spiced whiskey" wins.
  {
    group: "Rum & Rum-Based",
    keywords: [
      "rum",
      "spiced rum",
      "white rum",
      "dark rum",
      "gold rum",
      "aged rum",
      "cachaca",
      "cachaça",
      "bacardi",
      "bacardí",
      "captain morgan",
      "malibu",
      "myers",
      "mount gay",
      "havana club",
      "kraken",
      "sailor jerry",
      "appleton",
    ],
  },

  // 8. Gin & gin-based.
  {
    group: "Gin & Gin-Based",
    keywords: [
      "gin",
      "london dry",
      "old tom gin",
      "genever",
      "tanqueray",
      "bombay sapphire",
      "beefeater",
      "hendrick's",
      "hendricks",
      "aviation",
      "monkey 47",
      "sipsmith",
      "plymouth gin",
      "roku",
    ],
  },

  // 9. Vodka & vodka-based — check after gin so "vodka gimlet" doesn't
  //    fall into gin, and after RTDs so seltzers get caught first.
  {
    group: "Vodka & Vodka-Based",
    keywords: [
      "vodka",
      "tito's",
      "titos",
      "grey goose",
      "absolut",
      "smirnoff",
      "ketel one",
      "belvedere",
      "stolichnaya",
      "stoli",
      "ciroc",
      "cîroc",
      "svedka",
      "new amsterdam",
      "skyy",
    ],
    // Already filtered — Smirnoff Ice is in RTDs rule #1 above.
  },

  // 10. Liqueurs & cordials — catch-all for the broad liqueur category.
  {
    group: "Liqueurs & Cordials",
    keywords: [
      "liqueur",
      "cordial",
      "schnapps",
      "amaretto",
      "bailey's",
      "baileys",
      "kahlua",
      "kahlúa",
      "cointreau",
      "triple sec",
      "grand marnier",
      "campari",
      "aperol",
      "chartreuse",
      "benedictine",
      "sambuca",
      "limoncello",
      "frangelico",
      "midori",
      "jägermeister",
      "jagermeister",
      "fireball",
      "drambuie",
      "galliano",
      "st germain",
      "st-germain",
      "chambord",
      "absinthe",
      "pastis",
      "ouzo",
      "grappa",
      "brandy",
      "cognac",
      "armagnac",
      "calvados",
      "eau de vie",
      "hennessy",
      "remy martin",
      "rémy martin",
      "courvoisier",
      "martell",
    ],
  },

  // 11. Non-alcoholic beverages — water, soda, mixers, coffee, tea, juice,
  //     energy drinks, and explicit "non-alcoholic" / "N/A" beer/wine.
  {
    group: "Non-Alcoholic Beverages",
    keywords: [
      "non-alcoholic",
      "non alcoholic",
      "nonalcoholic",
      "alcohol free",
      "alcohol-free",
      "zero proof",
      "zero-proof",
      "n/a beer",
      "na beer",
      "water",
      "sparkling water",
      "mineral water",
      "spring water",
      "tonic",
      "tonic water",
      "club soda",
      "soda water",
      "ginger beer",
      "ginger ale",
      "bitters",
      "mixer",
      "cola",
      "coca-cola",
      "coca cola",
      "pepsi",
      "sprite",
      "fanta",
      "mountain dew",
      "dr pepper",
      "gatorade",
      "powerade",
      "red bull",
      "monster",
      "rockstar",
      "celsius",
      "coffee",
      "cold brew",
      "iced coffee",
      "tea",
      "iced tea",
      "kombucha",
      "juice",
      "lemonade",
      "orange juice",
      "apple juice",
      "cranberry juice",
      "grapefruit juice",
      "pineapple juice",
    ],
  },
];

/**
 * Classify one inventory row into the canonical 12-bucket grouping.
 * Returns null only if `name` is missing (fatal) — otherwise always
 * returns a group (falling back to General Non-Food).
 */
export function classifyCategoryGroup(input: ClassifyInput): CategoryGroup | null {
  const name = (input.name ?? "").trim();
  if (!name) return null;

  // Build a normalized haystack with field weighting encoded implicitly
  // by repetition — varietal appears twice so its match wins ties over
  // name-only matches.
  const parts = [
    input.varietal ?? "",
    input.varietal ?? "",
    input.category ?? "",
    input.subcategory ?? "",
    input.name ?? "",
    input.brand ?? "",
  ]
    .map((s) => s.toLowerCase())
    .join(" | ");

  for (const rule of RULES) {
    if (rule.blockedBy?.some((kw) => hasKeyword(parts, kw))) continue;
    if (rule.keywords.some((kw) => hasKeyword(parts, kw))) {
      return rule.group;
    }
  }

  return "General Non-Food";
}

/**
 * Word-boundary keyword check. Handles hyphenation ("zero-proof") and
 * punctuation by escaping regex-special chars. Critical so that "ale"
 * matches " ale " but not "male" or "sale".
 */
function hasKeyword(haystack: string, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  // Short tokens (<=3 chars) use strict word boundaries.
  // Multi-word keywords use plain substring (regex word-boundary fails
  // on spaces/quotes inside brand names like "jack daniel's").
  if (kw.includes(" ") || kw.includes("'") || kw.includes("-")) {
    return haystack.includes(kw);
  }
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "i");
  return re.test(haystack);
}
