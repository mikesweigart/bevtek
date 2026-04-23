/**
 * backfill-brand — parse `brand` from `name` using deterministic rules.
 *
 * Gabby's whiskey wizard ends with a "pick a brand you like" step that
 * filters on `inventory.brand` via ilike-or. But the enrichment pipeline
 * deliberately doesn't touch `brand` — it's considered a POS-owned column.
 * That's fine in theory. In practice, most CSV imports leave `brand` NULL
 * and rely on the POS to have parsed it upstream, which most don't.
 *
 * Result: shopper picks "Maker's Mark" in the wizard, gets zero matches,
 * relaxation cascade drops brand, widens back out — worse UX than it
 * should be.
 *
 * Fix: parse brand from the `name` column using a known-brand dictionary
 * plus a small heuristic fallback. No LLM, no API costs, pure string work.
 * Safe by default (dry-run); --write required to commit; COALESCE means
 * existing non-null brand values are never overwritten.
 *
 * SAFE TO RUN WHILE ENRICHMENT IS RUNNING (different column, no conflict).
 *
 * USAGE:
 *   # Dry-run against all stores (default):
 *   SUPABASE_DB_URL=... pnpm backfill:brand
 *
 *   # Write to DB:
 *   SUPABASE_DB_URL=... pnpm backfill:brand -- --write
 *
 *   # Scope to one store, small sample:
 *   SUPABASE_DB_URL=... pnpm backfill:brand -- --store-id=<uuid> --limit=50
 *
 *   # See every row's before/after:
 *   SUPABASE_DB_URL=... pnpm backfill:brand -- --verbose
 */

import { existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";
import { Client } from "pg";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

type Args = {
  write: boolean;
  storeId: string | null;
  limit: number | null;
  output: string;
  verbose: boolean;
};

function parseArgs(): Args {
  const raw = process.argv.slice(2);
  const args: Args = {
    write: false,
    storeId: null,
    limit: null,
    output: `scripts/eval-results/backfill-brand-${new Date().toISOString().slice(0, 10)}.json`,
    verbose: false,
  };
  for (const a of raw) {
    if (a === "--write") args.write = true;
    else if (a === "--verbose" || a === "-v") args.verbose = true;
    else if (a.startsWith("--store-id=")) args.storeId = a.split("=")[1];
    else if (a.startsWith("--limit=")) args.limit = Number(a.split("=")[1]) || null;
    else if (a.startsWith("--output=")) args.output = a.split("=")[1];
    else if (a === "--help" || a === "-h") {
      console.log(
        "backfill-brand — parse brand from name\n" +
          "  --write             Commit to DB (default: dry-run)\n" +
          "  --store-id=<uuid>   Restrict to one store\n" +
          "  --limit=<n>         Max rows to process\n" +
          "  --verbose           Print every before/after\n",
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Brand dictionary — the top ~200 brands by liquor-store frequency.
//
// Each entry: a regex that matches the brand token(s) at the start of a
// cleaned name, plus the canonical display form. Longest patterns first
// (so "Angel's Envy" matches before "Angel" would).
//
// Add brands here when you notice misses in the dry-run output. The
// dictionary always wins over the heuristic fallback.
// ---------------------------------------------------------------------------

type BrandEntry = { pattern: RegExp; canonical: string };

const BRAND_DICT: BrandEntry[] = [
  // Multi-word brands first so they match before their first token
  { pattern: /^angel'?s?\s+envy\b/i, canonical: "Angel's Envy" },
  { pattern: /^buzzard'?s?\s+roost\b/i, canonical: "Buzzard's Roost" },
  { pattern: /^den\s+of\s+thieves\b/i, canonical: "Den of Thieves" },
  { pattern: /^13th\s+colony\b/i, canonical: "13th Colony" },
  { pattern: /^four\s+roses\b/i, canonical: "Four Roses" },
  { pattern: /^wild\s+turkey\b/i, canonical: "Wild Turkey" },
  { pattern: /^jim\s+beam\b/i, canonical: "Jim Beam" },
  { pattern: /^jack\s+daniel'?s?\b/i, canonical: "Jack Daniel's" },
  { pattern: /^maker'?s?\s+mark\b/i, canonical: "Maker's Mark" },
  { pattern: /^buffalo\s+trace\b/i, canonical: "Buffalo Trace" },
  { pattern: /^knob\s+creek\b/i, canonical: "Knob Creek" },
  { pattern: /^woodford\s+reserve\b/i, canonical: "Woodford Reserve" },
  { pattern: /^basil\s+hayden\b/i, canonical: "Basil Hayden" },
  { pattern: /^elijah\s+craig\b/i, canonical: "Elijah Craig" },
  { pattern: /^eagle\s+rare\b/i, canonical: "Eagle Rare" },
  { pattern: /^evan\s+williams\b/i, canonical: "Evan Williams" },
  { pattern: /^old\s+forester\b/i, canonical: "Old Forester" },
  { pattern: /^old\s+grand[-\s]?dad\b/i, canonical: "Old Grand-Dad" },
  { pattern: /^old\s+fitzgerald\b/i, canonical: "Old Fitzgerald" },
  { pattern: /^heaven\s+hill\b/i, canonical: "Heaven Hill" },
  { pattern: /^henry\s+mc\s?kenna\b/i, canonical: "Henry McKenna" },
  { pattern: /^pappy\s+van\s+winkle\b/i, canonical: "Pappy Van Winkle" },
  { pattern: /^van\s+winkle\b/i, canonical: "Van Winkle" },
  { pattern: /^george\s+t\.?\s+stagg\b/i, canonical: "George T. Stagg" },
  { pattern: /^colonel\s+e\.?\s+h\.?\s+taylor\b/i, canonical: "E.H. Taylor" },
  { pattern: /^e\.?\s+h\.?\s+taylor\b/i, canonical: "E.H. Taylor" },
  { pattern: /^rabbit\s+hole\b/i, canonical: "Rabbit Hole" },
  { pattern: /^little\s+book\b/i, canonical: "Little Book" },
  { pattern: /^blade\s+&?\s*bow\b/i, canonical: "Blade and Bow" },
  { pattern: /^high\s+west\b/i, canonical: "High West" },
  { pattern: /^sazerac\b/i, canonical: "Sazerac" },
  { pattern: /^southern\s+comfort\b/i, canonical: "Southern Comfort" },
  { pattern: /^crown\s+royal\b/i, canonical: "Crown Royal" },
  { pattern: /^seagram'?s?\s+7\b/i, canonical: "Seagram's 7" },
  { pattern: /^canadian\s+club\b/i, canonical: "Canadian Club" },
  { pattern: /^jameson\b/i, canonical: "Jameson" },
  { pattern: /^tullamore\s+dew\b/i, canonical: "Tullamore Dew" },
  { pattern: /^bushmills\b/i, canonical: "Bushmills" },
  { pattern: /^redbreast\b/i, canonical: "Redbreast" },
  { pattern: /^green\s+spot\b/i, canonical: "Green Spot" },
  { pattern: /^johnnie\s+walker\b/i, canonical: "Johnnie Walker" },
  { pattern: /^chivas\s+regal\b/i, canonical: "Chivas Regal" },
  { pattern: /^dewar'?s?\b/i, canonical: "Dewar's" },
  { pattern: /^famous\s+grouse\b/i, canonical: "Famous Grouse" },
  { pattern: /^monkey\s+shoulder\b/i, canonical: "Monkey Shoulder" },
  { pattern: /^glen(?:fiddich|livet|morangie|dronach|rothes|kinchie)\b/i, canonical: "" /* per-row */ },
  { pattern: /^the\s+glenlivet\b/i, canonical: "Glenlivet" },
  { pattern: /^the\s+macallan\b/i, canonical: "Macallan" },
  { pattern: /^macallan\b/i, canonical: "Macallan" },
  { pattern: /^laphroaig\b/i, canonical: "Laphroaig" },
  { pattern: /^lagavulin\b/i, canonical: "Lagavulin" },
  { pattern: /^ardbeg\b/i, canonical: "Ardbeg" },
  { pattern: /^talisker\b/i, canonical: "Talisker" },
  { pattern: /^balvenie\b/i, canonical: "Balvenie" },
  { pattern: /^oban\b/i, canonical: "Oban" },
  { pattern: /^aberlour\b/i, canonical: "Aberlour" },
  { pattern: /^auchentoshan\b/i, canonical: "Auchentoshan" },
  { pattern: /^highland\s+park\b/i, canonical: "Highland Park" },
  { pattern: /^dalmore\b/i, canonical: "Dalmore" },
  { pattern: /^bowmore\b/i, canonical: "Bowmore" },
  { pattern: /^caol\s+ila\b/i, canonical: "Caol Ila" },
  { pattern: /^kilchoman\b/i, canonical: "Kilchoman" },
  { pattern: /^compass\s+box\b/i, canonical: "Compass Box" },

  // Tequila / mezcal
  { pattern: /^clase\s+azul\b/i, canonical: "Clase Azul" },
  { pattern: /^don\s+julio\b/i, canonical: "Don Julio" },
  { pattern: /^jose\s+cuervo\b/i, canonical: "Jose Cuervo" },
  { pattern: /^casa\s+noble\b/i, canonical: "Casa Noble" },
  { pattern: /^casa\s+dragones\b/i, canonical: "Casa Dragones" },
  { pattern: /^casamigos\b/i, canonical: "Casamigos" },
  { pattern: /^patron\b/i, canonical: "Patrón" },
  { pattern: /^patrón\b/i, canonical: "Patrón" },
  { pattern: /^herradura\b/i, canonical: "Herradura" },
  { pattern: /^el\s+tesoro\b/i, canonical: "El Tesoro" },
  { pattern: /^espolon\b/i, canonical: "Espolón" },
  { pattern: /^milagro\b/i, canonical: "Milagro" },
  { pattern: /^avion\b/i, canonical: "Avión" },
  { pattern: /^fortaleza\b/i, canonical: "Fortaleza" },
  { pattern: /^siete\s+leguas\b/i, canonical: "Siete Leguas" },
  { pattern: /^tres\s+agaves\b/i, canonical: "Tres Agaves" },
  { pattern: /^lunazul\b/i, canonical: "Lunazul" },
  { pattern: /^olmeca\s+altos\b/i, canonical: "Olmeca Altos" },
  { pattern: /^olmeca\b/i, canonical: "Olmeca" },
  { pattern: /^teremana\b/i, canonical: "Teremana" },
  { pattern: /^hornitos\b/i, canonical: "Hornitos" },
  { pattern: /^sauza\b/i, canonical: "Sauza" },
  { pattern: /^1800\b/i, canonical: "1800" },
  { pattern: /^cazadores\b/i, canonical: "Cazadores" },
  { pattern: /^anteel\b/i, canonical: "Anteel" },
  { pattern: /^adictivo\b/i, canonical: "Adictivo" },
  { pattern: /^bellagave\b/i, canonical: "Bellagave" },
  { pattern: /^del\s+maguey\b/i, canonical: "Del Maguey" },
  { pattern: /^montelobos\b/i, canonical: "Montelobos" },
  { pattern: /^vida\b/i, canonical: "Vida" },
  { pattern: /^ilegal\b/i, canonical: "Ilegal" },

  // Vodka
  { pattern: /^grey\s+goose\b/i, canonical: "Grey Goose" },
  { pattern: /^tito'?s?\b/i, canonical: "Tito's" },
  { pattern: /^ketel\s+one\b/i, canonical: "Ketel One" },
  { pattern: /^absolut\b/i, canonical: "Absolut" },
  { pattern: /^smirnoff\b/i, canonical: "Smirnoff" },
  { pattern: /^stolichnaya\b/i, canonical: "Stolichnaya" },
  { pattern: /^belvedere\b/i, canonical: "Belvedere" },
  { pattern: /^chopin\b/i, canonical: "Chopin" },
  { pattern: /^reyka\b/i, canonical: "Reyka" },
  { pattern: /^russian\s+standard\b/i, canonical: "Russian Standard" },
  { pattern: /^skyy\b/i, canonical: "Skyy" },
  { pattern: /^svedka\b/i, canonical: "Svedka" },
  { pattern: /^pinnacle\b/i, canonical: "Pinnacle" },
  { pattern: /^new\s+amsterdam\b/i, canonical: "New Amsterdam" },
  { pattern: /^deep\s+eddy\b/i, canonical: "Deep Eddy" },
  { pattern: /^western\s+son\b/i, canonical: "Western Son" },
  { pattern: /^three\s+olives\b/i, canonical: "Three Olives" },

  // Gin
  { pattern: /^hendrick'?s?\b/i, canonical: "Hendrick's" },
  { pattern: /^tanqueray\b/i, canonical: "Tanqueray" },
  { pattern: /^bombay\s+sapphire\b/i, canonical: "Bombay Sapphire" },
  { pattern: /^beefeater\b/i, canonical: "Beefeater" },
  { pattern: /^plymouth\b/i, canonical: "Plymouth" },
  { pattern: /^aviation\b/i, canonical: "Aviation" },
  { pattern: /^the\s+botanist\b/i, canonical: "The Botanist" },
  { pattern: /^monkey\s+47\b/i, canonical: "Monkey 47" },
  { pattern: /^roku\b/i, canonical: "Roku" },
  { pattern: /^nolet'?s?\b/i, canonical: "Nolet's" },
  { pattern: /^st\.?\s+george\b/i, canonical: "St. George" },

  // Rum
  { pattern: /^bacardi\b/i, canonical: "Bacardi" },
  { pattern: /^captain\s+morgan\b/i, canonical: "Captain Morgan" },
  { pattern: /^mount\s+gay\b/i, canonical: "Mount Gay" },
  { pattern: /^mt\.?\s+gay\b/i, canonical: "Mount Gay" },
  { pattern: /^kraken\b/i, canonical: "Kraken" },
  { pattern: /^myers'?s?\b/i, canonical: "Myers's" },
  { pattern: /^malibu\b/i, canonical: "Malibu" },
  { pattern: /^diplomatico\b/i, canonical: "Diplomatico" },
  { pattern: /^ron\s+zacapa\b/i, canonical: "Ron Zacapa" },
  { pattern: /^zacapa\b/i, canonical: "Zacapa" },
  { pattern: /^appleton\s+estate\b/i, canonical: "Appleton Estate" },
  { pattern: /^flor\s+de\s+cana\b/i, canonical: "Flor de Caña" },
  { pattern: /^flor\s+de\s+caña\b/i, canonical: "Flor de Caña" },
  { pattern: /^gosling'?s?\b/i, canonical: "Gosling's" },

  // Cognac / Brandy
  { pattern: /^hennessy\b/i, canonical: "Hennessy" },
  { pattern: /^remy\s+martin\b/i, canonical: "Rémy Martin" },
  { pattern: /^rémy\s+martin\b/i, canonical: "Rémy Martin" },
  { pattern: /^courvoisier\b/i, canonical: "Courvoisier" },
  { pattern: /^martell\b/i, canonical: "Martell" },
  { pattern: /^camus\b/i, canonical: "Camus" },
  { pattern: /^pierre\s+ferrand\b/i, canonical: "Pierre Ferrand" },
  { pattern: /^christian\s+brothers\b/i, canonical: "Christian Brothers" },
  { pattern: /^e\s*&\s*j\b/i, canonical: "E&J" },
  { pattern: /^paul\s+masson\b/i, canonical: "Paul Masson" },

  // Liqueurs
  { pattern: /^aperol\b/i, canonical: "Aperol" },
  { pattern: /^campari\b/i, canonical: "Campari" },
  { pattern: /^cointreau\b/i, canonical: "Cointreau" },
  { pattern: /^grand\s+marnier\b/i, canonical: "Grand Marnier" },
  { pattern: /^baileys\b/i, canonical: "Baileys" },
  { pattern: /^bailey'?s\b/i, canonical: "Baileys" },
  { pattern: /^kahlua\b/i, canonical: "Kahlúa" },
  { pattern: /^kahlúa\b/i, canonical: "Kahlúa" },
  { pattern: /^st[-\s]*germain\b/i, canonical: "St-Germain" },
  { pattern: /^drambuie\b/i, canonical: "Drambuie" },
  { pattern: /^amaretto\s+disaronno\b/i, canonical: "Disaronno" },
  { pattern: /^disaronno\b/i, canonical: "Disaronno" },
  { pattern: /^chambord\b/i, canonical: "Chambord" },
  { pattern: /^fireball\b/i, canonical: "Fireball" },
  { pattern: /^jägermeister\b/i, canonical: "Jägermeister" },
  { pattern: /^jagermeister\b/i, canonical: "Jägermeister" },
  { pattern: /^angostura\b/i, canonical: "Angostura" },

  // Wine (the heavy hitters — wine brands are thousands, so heuristic covers the long tail)
  { pattern: /^caymus\b/i, canonical: "Caymus" },
  { pattern: /^silver\s+oak\b/i, canonical: "Silver Oak" },
  { pattern: /^opus\s+one\b/i, canonical: "Opus One" },
  { pattern: /^kendall[-\s]jackson\b/i, canonical: "Kendall-Jackson" },
  { pattern: /^rombauer\b/i, canonical: "Rombauer" },
  { pattern: /^duckhorn\b/i, canonical: "Duckhorn" },
  { pattern: /^la\s+crema\b/i, canonical: "La Crema" },
  { pattern: /^josh\s+cellars\b/i, canonical: "Josh Cellars" },
  { pattern: /^meiomi\b/i, canonical: "Meiomi" },
  { pattern: /^apothic\b/i, canonical: "Apothic" },
  { pattern: /^menage\s+a\s+trois\b/i, canonical: "Ménage à Trois" },
  { pattern: /^ménage\s+à\s+trois\b/i, canonical: "Ménage à Trois" },
  { pattern: /^19\s+crimes\b/i, canonical: "19 Crimes" },
  { pattern: /^yellow\s+tail\b/i, canonical: "Yellow Tail" },
  { pattern: /^santa\s+margherita\b/i, canonical: "Santa Margherita" },
  { pattern: /^ruffino\b/i, canonical: "Ruffino" },
  { pattern: /^veuve\s+clicquot\b/i, canonical: "Veuve Clicquot" },
  { pattern: /^moet\s+&?\s*chandon\b/i, canonical: "Moët & Chandon" },
  { pattern: /^moët\s+&?\s*chandon\b/i, canonical: "Moët & Chandon" },
  { pattern: /^dom\s+perignon\b/i, canonical: "Dom Pérignon" },
  { pattern: /^chandon\b/i, canonical: "Chandon" },
  { pattern: /^korbel\b/i, canonical: "Korbel" },
  { pattern: /^la\s+marca\b/i, canonical: "La Marca" },

  // Beer (sample — there are thousands of beer brands, so dictionary is illustrative)
  { pattern: /^sierra\s+nevada\b/i, canonical: "Sierra Nevada" },
  { pattern: /^stone\s+brewing\b/i, canonical: "Stone Brewing" },
  { pattern: /^dogfish\s+head\b/i, canonical: "Dogfish Head" },
  { pattern: /^founders\b/i, canonical: "Founders" },
  { pattern: /^lagunitas\b/i, canonical: "Lagunitas" },
  { pattern: /^new\s+belgium\b/i, canonical: "New Belgium" },
  { pattern: /^sweetwater\b/i, canonical: "SweetWater" },
  { pattern: /^terrapin\b/i, canonical: "Terrapin" },
  { pattern: /^creature\s+comforts\b/i, canonical: "Creature Comforts" },
  { pattern: /^samuel\s+adams\b/i, canonical: "Samuel Adams" },
  { pattern: /^sam\s+adams\b/i, canonical: "Samuel Adams" },
  { pattern: /^yuengling\b/i, canonical: "Yuengling" },

  // Commonly-seen single-word spirit brands (bourbon tail)
  { pattern: /^1792\b/i, canonical: "1792" },
  { pattern: /^123\b/i, canonical: "123" },
  { pattern: /^bulleit\b/i, canonical: "Bulleit" },
  { pattern: /^booker'?s?\b/i, canonical: "Booker's" },
  { pattern: /^baker'?s?\b/i, canonical: "Baker's" },
  { pattern: /^bardstown\b/i, canonical: "Bardstown" },
  { pattern: /^calumet\b/i, canonical: "Calumet" },
  { pattern: /^michter'?s?\b/i, canonical: "Michter's" },
  { pattern: /^templeton\b/i, canonical: "Templeton" },
  { pattern: /^whistlepig\b/i, canonical: "WhistlePig" },
  { pattern: /^hudson\b/i, canonical: "Hudson" },
  { pattern: /^koval\b/i, canonical: "Koval" },
  { pattern: /^balcones\b/i, canonical: "Balcones" },
  { pattern: /^westward\b/i, canonical: "Westward" },
  { pattern: /^stranahan'?s?\b/i, canonical: "Stranahan's" },
  { pattern: /^garrison\s+brothers\b/i, canonical: "Garrison Brothers" },
];

// Per-brand override: some dictionary entries leave canonical empty
// because the matched text itself is the brand (e.g. Glenfiddich vs.
// Glenlivet — both match the same regex). For those, capitalize the
// raw token.
function dictLookup(cleaned: string): string | null {
  for (const entry of BRAND_DICT) {
    const m = entry.pattern.exec(cleaned);
    if (!m) continue;
    if (entry.canonical) return entry.canonical;
    // Empty canonical means: use the matched text, title-cased
    return titleCase(m[0]);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cleaning / heuristic fallback
// ---------------------------------------------------------------------------

function cleanName(raw: string): string {
  let s = raw;
  // Strip parenthetical / bracketed flags
  s = s.replace(/\*[^*]{0,20}\*/g, " "); // *DNR*, *NEW*, *SALE*, etc.
  s = s.replace(/\[[^\]]{0,30}\]/g, " ");
  s = s.replace(/\([^)]{0,30}\)/g, " ");
  // Strip trailing size + packaging. Run repeatedly because many names
  // have both size and pack count.
  for (let i = 0; i < 4; i++) {
    const prev = s;
    s = s.replace(
      /\s*\d+(?:\.\d+)?\s*(ml|l|oz|pk|pack|cn|can|btl|bottle|liter|litre)\b\.?/gi,
      " ",
    );
    s = s.replace(/\s+\d+\s*(?:x|pack|pk|count|ct)\b/gi, " ");
    if (s === prev) break;
  }
  // Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

// Type words: reliable markers of "brand + variant ends here, product
// description starts here." Everything before the first type word is
// the brand-plus-variant candidate chunk.
const TYPE_WORDS = new Set([
  "bourbon", "whiskey", "whisky", "scotch", "rye", "vodka", "gin", "tequila",
  "mezcal", "rum", "cognac", "brandy", "liqueur", "aperitivo", "aperitif",
  "amaro", "amaretto", "bitters", "cachaca", "cachaça", "sake", "soju",
  "moonshine", "absinthe", "schnapps", "cordial", "vermouth", "port", "sherry",
  "wine", "champagne", "prosecco", "cava", "riesling", "chardonnay", "merlot",
  "cabernet", "pinot", "sauvignon", "zinfandel", "malbec", "syrah", "shiraz",
  "tempranillo", "sangiovese", "chianti", "rosé", "rose",
  "beer", "ale", "lager", "pilsner", "stout", "porter", "ipa", "saison", "witbier",
  "hefeweizen", "wheat", "cider",
  "margarita", "mojito", "daiquiri",
]);

// Qualifier words that can appear between brand and type word — we
// don't chop the brand at these (e.g. "Maker's Mark STRAIGHT Bourbon"
// should still give brand="Maker's Mark").
// We scan UNTIL a type word, and include qualifiers in the "chunk"
// but strip them before returning the brand.
const QUALIFIER_WORDS = new Set([
  "straight", "kentucky", "tennessee", "canadian", "irish", "scottish",
  "organic", "premium", "reserve", "small", "batch", "single", "barrel",
  "strength", "cask", "proof", "bottled", "in", "bond", "signature",
  "select", "distillers", "distiller", "master", "private", "limited", "edition",
  "aged", "estate", "vineyard", "winery", "brewing", "brewery", "brewer",
  "distillery", "cellars", "cellar", "family", "original", "classic",
  "old", "new", "young", "rare", "gold", "silver", "platinum", "black",
  "red", "white", "blue", "green", "rose",
  "southern", "northern", "highland", "lowland", "island", "islay",
  "speyside", "campbeltown", "japanese",
  "hard", "craft", "traditional", "authentic", "real",
  "de", "la", "el", "los", "las", "the", "of", "and", "&", "y",
]);

// Variant words — flavor/style modifiers that aren't brand. If we see
// one as the second token, the brand is usually just the first token.
const VARIANT_WORDS = new Set([
  "blanco", "silver", "plata", "reposado", "añejo", "anejo", "extra", "cristalino",
  "blanc", "blanche", "citron", "lime", "lemon", "orange", "pepper", "peppar",
  "coconut", "vanilla", "cherry", "apple", "grape", "mango", "pineapple",
  "blackberry", "raspberry", "strawberry", "watermelon",
  "spiced", "flavored", "infused",
  "light", "dark", "smoked", "honey", "salted",
  "classic", "original", "traditional", "premium",
  "gold", "silver", "platinum", "black", "red", "white", "blue",
]);

function heuristicBrand(cleaned: string): string | null {
  if (!cleaned) return null;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // Find the first type-word boundary
  let typeIdx = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    const low = tokens[i].toLowerCase().replace(/[',]/g, "");
    if (TYPE_WORDS.has(low)) {
      typeIdx = i;
      break;
    }
  }
  const chunk = tokens.slice(0, typeIdx);
  if (chunk.length === 0) return null;

  // Working back from the type-word, strip qualifier + variant words
  // that wouldn't be part of the brand itself.
  let end = chunk.length;
  while (end > 1) {
    const low = chunk[end - 1].toLowerCase().replace(/[',]/g, "");
    if (QUALIFIER_WORDS.has(low) || VARIANT_WORDS.has(low)) {
      end--;
      continue;
    }
    break;
  }
  const brandTokens = chunk.slice(0, end);
  if (brandTokens.length === 0) return null;

  // Cap at 3 tokens — anything longer is probably misparsed.
  const finalTokens = brandTokens.slice(0, 3);
  return titleCase(finalTokens.join(" "));
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => {
      if (w.length === 0) return w;
      // Preserve alphanumeric starts (1800, 1792, 13th, etc.)
      if (/^\d/.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

export function parseBrand(rawName: string): string | null {
  const cleaned = cleanName(rawName);
  if (!cleaned) return null;
  const fromDict = dictLookup(cleaned);
  if (fromDict) return fromDict;
  return heuristicBrand(cleaned);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  store_id: string;
  name: string;
  brand: string | null;
};

async function main() {
  const args = parseArgs();
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL not set.");
    process.exit(1);
  }

  console.log("[backfill-brand] starting", {
    write: args.write,
    storeId: args.storeId ?? "(all)",
    limit: args.limit ?? "(unlimited)",
    output: args.output,
  });

  // Prepare audit output file
  const outPath = resolve(args.output);
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        started_at: new Date().toISOString(),
        args,
        entries: "appended below as NDJSON; final summary object at the end",
      },
      null,
      2,
    ) + "\n",
  );

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  let processed = 0;
  let wouldUpdate = 0;
  let written = 0;
  let noParse = 0;
  const byBrandSample = new Map<string, number>();
  const noParseSample: string[] = [];

  try {
    const params: (string | number)[] = [];
    const where: string[] = ["is_active = true", "name is not null", "name != ''"];
    // Only rows missing a brand value
    where.push("(brand is null or brand = '')");
    if (args.storeId) {
      params.push(args.storeId);
      where.push(`store_id = $${params.length}`);
    }
    let sql = `
      select id, store_id::text, name, brand
      from public.inventory
      where ${where.join(" and ")}
      order by id
    `;
    if (args.limit) {
      params.push(args.limit);
      sql += ` limit $${params.length}`;
    }
    const res = await client.query<Row>(sql, params);
    const rows = res.rows;
    console.log(`[backfill-brand] ${rows.length} row(s) have NULL/empty brand.`);

    for (const r of rows) {
      processed++;
      const parsed = parseBrand(r.name);
      if (!parsed) {
        noParse++;
        if (noParseSample.length < 20) noParseSample.push(r.name);
        appendFileSync(
          outPath,
          JSON.stringify({
            id: r.id,
            name: r.name,
            parsed: null,
            written: false,
          }) + "\n",
        );
        continue;
      }
      byBrandSample.set(parsed, (byBrandSample.get(parsed) ?? 0) + 1);
      wouldUpdate++;

      if (args.verbose) {
        console.log(`  ${r.name.slice(0, 60).padEnd(60)} -> ${parsed}`);
      }

      if (args.write) {
        // COALESCE guarantees we never stomp an existing value, even if
        // someone set it between our SELECT and this UPDATE.
        await client.query(
          `update public.inventory
              set brand = coalesce(nullif(brand, ''), $2)
            where id = $1`,
          [r.id, parsed],
        );
        written++;
      }

      appendFileSync(
        outPath,
        JSON.stringify({
          id: r.id,
          name: r.name,
          parsed,
          written: args.write,
        }) + "\n",
      );

      if (processed % 200 === 0) {
        console.log(
          `[backfill-brand] progress: ${processed}/${rows.length} processed, ${written} written, ${noParse} unparseable`,
        );
      }
    }

    // Final summary
    const topBrands = [...byBrandSample.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);
    const summary = {
      finished_at: new Date().toISOString(),
      processed,
      would_update: wouldUpdate,
      written,
      unparseable: noParse,
      unique_brands: byBrandSample.size,
      top_brands: topBrands,
      dry_run: !args.write,
    };
    appendFileSync(outPath, JSON.stringify({ summary }) + "\n");
    console.log("\n[backfill-brand] done", summary);
    if (noParseSample.length > 0) {
      console.log(
        "\n[backfill-brand] sample of unparseable names (first 20):",
      );
      for (const n of noParseSample) console.log(`  ${n}`);
      console.log(
        "\n  If these are high-volume brands, add them to BRAND_DICT in scripts/backfill-brand.ts.",
      );
    }
    if (!args.write) {
      console.log("\n[backfill-brand] DRY RUN — no writes. Re-run with --write to commit.");
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error("[backfill-brand] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
