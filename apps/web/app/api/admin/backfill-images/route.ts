import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Per-module Unsplash search query. Tuned for accurate subject matching —
// generic queries like "bourbon" sometimes return Scotch, so we use
// specific product phrases like "bourbon bottle kentucky".
const MODULE_QUERIES: Record<string, string> = {
  // Wine — France
  "Bordeaux Reds": "bordeaux red wine bottle",
  "Burgundy — Pinot Noir": "burgundy pinot noir wine",
  "French Chardonnay": "chardonnay white wine bottle",
  "Champagne & Sparkling": "champagne bottle celebration",
  "Rhône Valley": "rhone valley wine vineyard",
  "Sancerre & Loire": "sancerre sauvignon blanc wine",

  // Wine — USA
  "Napa Cabernet": "napa valley cabernet sauvignon",
  "California Chardonnay": "california chardonnay white wine",
  "Oregon Pinot Noir": "oregon pinot noir wine",
  "Washington Reds": "washington state red wine",
  "Sonoma Whites": "sonoma white wine vineyard",
  "California Rosé": "rose wine pink bottle",

  // Wine — World
  "Australian Shiraz": "australian shiraz syrah red wine",
  "Argentine Malbec": "argentinian malbec red wine",
  "Barolo — Italy": "barolo italian red wine nebbiolo",
  "Spanish Rioja": "rioja spanish red wine",
  "Australian Chardonnay": "australian chardonnay white wine",
  "New Zealand Sauvignon Blanc": "new zealand sauvignon blanc",
  "South African Wine": "south african wine vineyard",
  "California Reds Deep-Dive": "california red wine cabernet",
  "California Whites Deep-Dive": "california white wine chardonnay",
  "Oregon Whites": "oregon white wine",
  "Italian Reds — Chianti to Amarone": "chianti italian red wine",
  "Italian Whites — Pinot Grigio to Vermentino": "pinot grigio italian white wine",
  "How to Read a Wine Label": "wine bottle label closeup",
  "Wine Storage & Serving Temperature": "wine cellar bottles storage",
  "Wine for Beginners": "wine glass pour red",
  "Dessert Wines — Port, Sauternes & Ice Wine": "port wine dessert",
  "Pinot Noir — A Global Tour": "pinot noir red wine glass",
  "Sauvignon Blanc Around the World": "sauvignon blanc white wine",
  "Cabernet Sauvignon — A Global Tour": "cabernet sauvignon red wine",
  "Merlot — The Comeback": "merlot red wine bottle",
  "Rosé — Year-Round, Not Just Summer": "rose wine pink",
  "German & Alsatian Riesling": "riesling german white wine",
  "Wine Regions of Spain Beyond Rioja": "spanish wine vineyard",
  "Wine & Cheese Pairing": "wine cheese pairing board",

  // Spirits — Whiskey
  "Bourbon 101": "bourbon bottle kentucky whiskey",
  "Bourbon Deep-Dive — Mash Bills & Flavor": "bourbon whiskey glass neat",
  "American Rye Whiskey": "rye whiskey bottle american",
  "Scotch — Single Malt": "single malt scotch whisky",
  "Scotch — Blended": "blended scotch whisky bottle",
  "Scotch — Peated vs. Unpeated": "islay peated scotch whisky",
  "Tequila & Mezcal": "tequila bottle agave",
  "Gin Essentials": "gin bottle botanical",
  "Rum — Light & Dark": "rum bottle caribbean",
  "Cognac & Brandy": "cognac brandy snifter",
  "Japanese Whisky": "japanese whisky bottle",
  "Irish Whiskey": "irish whiskey jameson bottle",
  "Vodka Basics": "vodka bottle clear",
  "Liqueurs & Amaro": "amaro italian liqueur bottle",
  "Tennessee Whiskey": "tennessee whiskey jack daniels",
  "Wheat Whiskey & Specialty Grains": "wheat whiskey bottle",
  "Whiskey Blends & Budget Guide": "whiskey bottle bar",
  "Whiskey Cocktails at Home": "whiskey cocktail amber glass",
  "Non-Alcoholic Spirits": "non alcoholic spirits bottle",
  "Ready-to-Drink (RTD) Guide": "canned cocktail drink",
  "Agave Beyond Tequila": "mezcal agave spirit bottle",
  "World Whiskey — Canada, India, Taiwan": "world whisky bottles collection",

  // Beer
  "IPA Styles Guide": "ipa craft beer glass hoppy",
  "Local Craft IPAs — Southeast": "craft ipa beer can",
  "Belgian Ales": "belgian ale beer glass",
  "Lagers & Pilsners": "lager pilsner beer glass golden",
  "Stouts & Porters": "stout dark beer glass",
  "Sours & Goses": "sour beer pink glass",
  "Wheat Beers": "wheat beer hefeweizen glass",
  "Reading a Beer Label": "beer bottle label closeup",
  "Craft Beer for Beginners": "craft beer flight tasting",
  "Beer & Food Pairing": "beer food pairing cheese",
  "Non-Alcoholic Beer & Beverages": "non alcoholic beer bottle",

  // Cocktails — Categories
  "Old Fashioned": "old fashioned cocktail amber rocks orange peel",
  "Negroni & Variations": "negroni cocktail red orange garnish",
  "Whiskey Sour Family": "whiskey sour cocktail foam",
  "Martini & Variations": "martini cocktail olive glass",
  "Margarita Family": "margarita cocktail salt rim lime",
  "Aperitivo & Spritzes": "aperol spritz cocktail orange",
  "Classic Highballs": "highball cocktail tall glass",
  "Food & Drink Pairings": "cocktail food pairing",
  "Home Bar Essentials": "home bar setup cocktail tools",
  "Bourbon Cocktails — Beyond the Old Fashioned": "bourbon cocktail glass amber",

  // Cocktail recipes (15)
  "Margarita": "margarita cocktail salt rim lime",
  "Espresso Martini": "espresso martini coffee beans foam",
  "Moscow Mule": "moscow mule copper mug lime ginger",
  "Mojito": "mojito cocktail mint lime highball",
  "Daiquiri": "daiquiri cocktail coupe lime",
  "Manhattan": "manhattan cocktail coupe cherry amber",
  "Cosmopolitan": "cosmopolitan cocktail pink martini",
  "French 75": "french 75 champagne cocktail",
  "Mai Tai": "mai tai tiki cocktail orange",
  "Paloma": "paloma cocktail grapefruit tequila",
  "Piña Colada": "pina colada coconut tropical",
  "Negroni": "negroni cocktail red orange garnish",
  "Aperol Spritz": "aperol spritz orange",
  "Whiskey Sour": "whiskey sour cocktail foam lemon",
  "Tom Collins": "tom collins gin cocktail tall",

  // Sales & Service — use retail scenes
  "Upselling Without Being Pushy": "wine shop retail store",
  "Reading the Customer": "liquor store customer retail",
  "Gift Recommendations by Budget": "wine gift box wrap",
  "Holiday Season Playbook": "holiday wine champagne christmas",
  "Wine Club & Loyalty Programs": "wine tasting club members",
  "Handling Difficult Customers": "retail customer service",
  "Merchandising & Shelf Placement": "wine shop shelves display",
  "Inventory Basics for Staff": "wine store inventory shelves",
  "Legal: Age Verification & Compliance": "id check liquor store",
  "Store Safety & Loss Prevention": "liquor store interior",
};

type UnsplashPhoto = {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string; username: string };
};

async function searchUnsplash(query: string, accessKey: string): Promise<UnsplashPhoto | null> {
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape&content_filter=high&client_id=${accessKey}`;
  const res = await fetch(url, {
    headers: { "Accept-Version": "v1" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.results?.[0] ?? null;
}

export async function POST(req: Request) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    return NextResponse.json(
      { error: "UNSPLASH_ACCESS_KEY not configured in Vercel env vars." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  // Only allow manager role (adjust policy if needed)
  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "manager" && role !== "owner" && role !== "admin") {
    return NextResponse.json(
      { error: "Only managers can run backfill." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { force?: boolean; only?: string[] };
  const force = body.force === true;
  const only = Array.isArray(body.only) ? new Set(body.only) : null;

  // Fetch modules that need images
  const { data: modules, error: modErr } = await supabase
    .from("modules")
    .select("id, title, category_group, hero_image_url")
    .eq("is_published", true);

  if (modErr) {
    return NextResponse.json({ error: modErr.message }, { status: 500 });
  }

  const results: Array<{ title: string; status: string; url?: string; error?: string }> = [];
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of modules ?? []) {
    const mod = m as { id: string; title: string; category_group: string | null; hero_image_url: string | null };

    if (only && !only.has(mod.title)) {
      continue;
    }
    if (!force && mod.hero_image_url) {
      skipped++;
      results.push({ title: mod.title, status: "skipped (already set)" });
      continue;
    }

    const query = MODULE_QUERIES[mod.title] ?? `${mod.title} beverage`;
    try {
      const photo = await searchUnsplash(query, accessKey);
      if (!photo) {
        failed++;
        results.push({ title: mod.title, status: "no results", error: `no photos for "${query}"` });
        continue;
      }
      const heroUrl = `${photo.urls.regular}&w=800&q=80`;
      const credit = `Photo by ${photo.user.name} on Unsplash`;

      const { error: upErr } = await supabase
        .from("modules")
        .update({ hero_image_url: heroUrl, hero_image_credit: credit })
        .eq("id", mod.id);

      if (upErr) {
        failed++;
        results.push({ title: mod.title, status: "db error", error: upErr.message });
      } else {
        updated++;
        results.push({ title: mod.title, status: "updated", url: heroUrl });
      }
    } catch (e) {
      failed++;
      results.push({ title: mod.title, status: "fetch error", error: (e as Error).message });
    }

    // Respect free-tier rate limit (50/hr → ~72s between calls).
    // We pace at 1s to avoid burst, then rely on the hour budget for total.
    await new Promise((r) => setTimeout(r, 1000));
  }

  return NextResponse.json({
    total: modules?.length ?? 0,
    updated,
    skipped,
    failed,
    results,
  });
}
