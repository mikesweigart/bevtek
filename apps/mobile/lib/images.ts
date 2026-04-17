// High-quality Unsplash beverage photography, mapped per module.
// Free to use under Unsplash license. ?w=400&q=80 for optimized mobile size.

const U = "https://images.unsplash.com";

// Category hero images (used in Featured Modules carousel)
export const CATEGORY_IMAGES: Record<string, string> = {
  wine_france: `${U}/photo-1510812431401-41d2bd2722f3?w=600&q=80`,
  wine_usa: `${U}/photo-1506377247377-2a5b3b417ebb?w=600&q=80`,
  wine_world: `${U}/photo-1553361371-9b22f78e8b1d?w=600&q=80`,
  spirits: `${U}/photo-1569529465841-dfecdab7503b?w=600&q=80`,
  beer: `${U}/photo-1535958636474-b021ee887b13?w=600&q=80`,
  cocktails: `${U}/photo-1514362545857-3bc16c4c7d1b?w=600&q=80`,
  cocktail_recipes: `${U}/photo-1514362545857-3bc16c4c7d1b?w=600&q=80`,
  sales_service: `${U}/photo-1556742049-0cfed4f6a45d?w=600&q=80`,
};

// Per-module images (circular thumbnails on Explore)
export const MODULE_IMAGES: Record<string, string> = {
  // Wine — France
  "Bordeaux Reds": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,
  "Burgundy — Pinot Noir": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "French Chardonnay": `${U}/photo-1566754966849-fa5bffacb97b?w=200&q=80`,
  "Champagne & Sparkling": `${U}/photo-1549439602-43ebca2327af?w=200&q=80`,
  "Rhône Valley": `${U}/photo-1566995541428-f05db4c4f829?w=200&q=80`,
  "Sancerre & Loire": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,

  // Wine — USA
  "Napa Cabernet": `${U}/photo-1506377247377-2a5b3b417ebb?w=200&q=80`,
  "California Chardonnay": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "Oregon Pinot Noir": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "Washington Reds": `${U}/photo-1553361371-9b22f78e8b1d?w=200&q=80`,
  "Sonoma Whites": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "California Rosé": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,

  // Wine — World
  "Australian Shiraz": `${U}/photo-1553361371-9b22f78e8b1d?w=200&q=80`,
  "Argentine Malbec": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,
  "Barolo — Italy": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "Spanish Rioja": `${U}/photo-1566995541428-f05db4c4f829?w=200&q=80`,

  // Spirits
  "Bourbon 101": `${U}/photo-1569529465841-dfecdab7503b?w=200&q=80`,
  "American Rye Whiskey": `${U}/photo-1527281400683-1aae777175f8?w=200&q=80`,
  "Scotch — Single Malt": `${U}/photo-1602076712092-60e16b0b3e09?w=200&q=80`,
  "Scotch — Blended": `${U}/photo-1602076712092-60e16b0b3e09?w=200&q=80`,
  "Tequila & Mezcal": `${U}/photo-1516535794938-6063878f08cc?w=200&q=80`,
  "Gin Essentials": `${U}/photo-1550391327-1f4ff5c42e81?w=200&q=80`,
  "Rum — Light & Dark": `${U}/photo-1548236788-6247c8cfa17c?w=200&q=80`,
  "Cognac & Brandy": `${U}/photo-1569529465841-dfecdab7503b?w=200&q=80`,
  "Japanese Whisky": `${U}/photo-1527281400683-1aae777175f8?w=200&q=80`,
  "Irish Whiskey": `${U}/photo-1527281400683-1aae777175f8?w=200&q=80`,
  "Vodka Basics": `${U}/photo-1550391327-1f4ff5c42e81?w=200&q=80`,
  "Liqueurs & Amaro": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,

  // Beer
  "IPA Styles Guide": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,
  "Local Craft IPAs — Southeast": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,
  "Belgian Ales": `${U}/photo-1558642452-9d2a7deb7f62?w=200&q=80`,
  "Lagers & Pilsners": `${U}/photo-1558642452-9d2a7deb7f62?w=200&q=80`,
  "Stouts & Porters": `${U}/photo-1532634922-8fe0b757fb13?w=200&q=80`,
  "Sours & Goses": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,
  "Wheat Beers": `${U}/photo-1558642452-9d2a7deb7f62?w=200&q=80`,
  "Reading a Beer Label": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,

  // Cocktails
  "Old Fashioned": `${U}/photo-1536935338788-846bb9981813?w=200&q=80`,
  "Negroni & Variations": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Whiskey Sour Family": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Martini & Variations": `${U}/photo-1550391327-1f4ff5c42e81?w=200&q=80`,
  "Margarita Family": `${U}/photo-1516535794938-6063878f08cc?w=200&q=80`,
  "Aperitivo & Spritzes": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "Classic Highballs": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Food & Drink Pairings": `${U}/photo-1414235077428-338989a2e8c0?w=200&q=80`,

  // Cocktail recipes (15)
  "Margarita": `${U}/photo-1516535794938-6063878f08cc?w=200&q=80`,
  "Espresso Martini": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Moscow Mule": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Mojito": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "Daiquiri": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Manhattan": `${U}/photo-1536935338788-846bb9981813?w=200&q=80`,
  "Cosmopolitan": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "French 75": `${U}/photo-1549439602-43ebca2327af?w=200&q=80`,
  "Mai Tai": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Paloma": `${U}/photo-1516535794938-6063878f08cc?w=200&q=80`,
  "Piña Colada": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "Negroni": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Aperol Spritz": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "Whiskey Sour": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "Tom Collins": `${U}/photo-1550391327-1f4ff5c42e81?w=200&q=80`,

  // Wine expanded
  "Australian Chardonnay": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "New Zealand Sauvignon Blanc": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "South African Wine": `${U}/photo-1553361371-9b22f78e8b1d?w=200&q=80`,
  "California Reds Deep-Dive": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,
  "California Whites Deep-Dive": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "Oregon Whites": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "Italian Reds — Chianti to Amarone": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "Italian Whites — Pinot Grigio to Vermentino": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "How to Read a Wine Label": `${U}/photo-1553361371-9b22f78e8b1d?w=200&q=80`,
  "Wine Storage & Serving Temperature": `${U}/photo-1553361371-9b22f78e8b1d?w=200&q=80`,
  "Wine for Beginners": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,
  "Dessert Wines — Port, Sauternes & Ice Wine": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,

  // Whiskey expanded
  "Tennessee Whiskey": `${U}/photo-1569529465841-dfecdab7503b?w=200&q=80`,
  "Wheat Whiskey & Specialty Grains": `${U}/photo-1527281400683-1aae777175f8?w=200&q=80`,
  "Whiskey Blends & Budget Guide": `${U}/photo-1569529465841-dfecdab7503b?w=200&q=80`,
  "Whiskey Cocktails at Home": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,

  // Beer expanded
  "Craft Beer for Beginners": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,
  "Beer & Food Pairing": `${U}/photo-1414235077428-338989a2e8c0?w=200&q=80`,
  "Non-Alcoholic Beer & Beverages": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,

  // Spirits expanded
  "Non-Alcoholic Spirits": `${U}/photo-1550391327-1f4ff5c42e81?w=200&q=80`,
  "Ready-to-Drink (RTD) Guide": `${U}/photo-1535958636474-b021ee887b13?w=200&q=80`,
  "Agave Beyond Tequila": `${U}/photo-1516535794938-6063878f08cc?w=200&q=80`,

  // Sales & Service
  "Upselling Without Being Pushy": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Reading the Customer": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Gift Recommendations by Budget": `${U}/photo-1549465220-1a8b9238f7e7?w=200&q=80`,
  "Holiday Season Playbook": `${U}/photo-1549465220-1a8b9238f7e7?w=200&q=80`,
  "Wine Club & Loyalty Programs": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Handling Difficult Customers": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Merchandising & Shelf Placement": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Inventory Basics for Staff": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Legal: Age Verification & Compliance": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,
  "Store Safety & Loss Prevention": `${U}/photo-1556742049-0cfed4f6a45d?w=200&q=80`,

  // Final 15 modules
  "Pinot Noir — A Global Tour": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "Sauvignon Blanc Around the World": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "Cabernet Sauvignon — A Global Tour": `${U}/photo-1510812431401-41d2bd2722f3?w=200&q=80`,
  "Merlot — The Comeback": `${U}/photo-1474722883778-792e7990302f?w=200&q=80`,
  "Rosé — Year-Round, Not Just Summer": `${U}/photo-1560148218-1a83060f7b32?w=200&q=80`,
  "German & Alsatian Riesling": `${U}/photo-1558001373-7b93ee48ffa0?w=200&q=80`,
  "Wine Regions of Spain Beyond Rioja": `${U}/photo-1566995541428-f05db4c4f829?w=200&q=80`,
  "Wine & Cheese Pairing": `${U}/photo-1414235077428-338989a2e8c0?w=200&q=80`,
  "Bourbon Deep-Dive — Mash Bills & Flavor": `${U}/photo-1569529465841-dfecdab7503b?w=200&q=80`,
  "Scotch — Peated vs. Unpeated": `${U}/photo-1602076712092-60e16b0b3e09?w=200&q=80`,
  "Bourbon Cocktails — Beyond the Old Fashioned": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
  "World Whiskey — Canada, India, Taiwan": `${U}/photo-1527281400683-1aae777175f8?w=200&q=80`,
  "Home Bar Essentials": `${U}/photo-1514362545857-3bc16c4c7d1b?w=200&q=80`,
};

// Fallback per category group
export function getModuleImage(title: string, categoryGroup: string | null): string {
  return (
    MODULE_IMAGES[title] ??
    CATEGORY_IMAGES[categoryGroup ?? "spirits"] ??
    CATEGORY_IMAGES.spirits
  );
}
