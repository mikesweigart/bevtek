-- Gold-standard rewrites batch 10: Wheat Beers, Beer Labels, Wheat Whiskey, Whiskey Blends, Whiskey Cocktails

-- Wheat Beers
update public.modules set content = $md$
**THE STORY**

Wheat beer has been brewed in Bavaria for over 500 years. In 1516, the German Beer Purity Law (Reinheitsgebot) actually BANNED wheat in beer — reserving it for bakers. Only Bavarian royalty held the exclusive right to brew wheat beer (Weissbier). When the royal monopoly ended in the 1800s, wheat beer became the people's drink — and today it's one of Germany's most beloved styles.

The magic of wheat beer isn't the wheat itself — it's the YEAST. Hefeweizen yeast (Saccharomyces cerevisiae var. bayanus) produces distinctive banana (isoamyl acetate) and clove (4-vinyl guaiacol) flavors at warm fermentation temperatures. No other beer style has this combination.

**THE STYLES**

• **Hefeweizen** — Bavarian classic. Cloudy (hefe = yeast, weizen = wheat). Banana, clove, bread. 5-5.5% ABV. THE wheat beer.
• **Witbier (Belgian White)** — unfiltered with coriander + orange peel. Lighter than Hefeweizen, more citrus. Hoegaarden, Allagash White.
• **Dunkelweizen** — dark wheat beer. Hefeweizen + Munich malt. Banana + caramel.
• **Weizenbock** — strong wheat. 7-9% ABV. Schneider Aventinus is the icon.
• **American Wheat** — clean, no banana/clove (different yeast). Boulevard, Gumballhead.

**TOP SELLERS YOUR STAFF MUST KNOW**

1. **Weihenstephaner Hefeweissbier** — $12/6-pack. The world's oldest brewery (founded 1040 AD). THE benchmark Hefeweizen. "The greatest wheat beer ever made. Period."

2. **Allagash White** — $12/4-pack. Belgian Witbier from Maine. Coriander, orange peel, refreshing. "Blue Moon drinkers: upgrade here."

3. **Paulaner Hefe-Weissbier** — $11/6-pack. Bavarian classic. Banana, clove, perfect balance. "The Oktoberfest Hefeweizen."

4. **Blue Moon Belgian White** — $10/6-pack. The mass-market Witbier. "Don't snob it — it's someone's gateway to craft."

5. **Hoegaarden** — $10/6-pack. The original Belgian Witbier (revived in 1966 by Pierre Celis). "Where the style was reborn."

**WHAT TO SAY ON THE FLOOR**

"Hot day, want something refreshing but not hoppy? Wheat beer. Banana, clove, sunshine."

"Drinks Blue Moon? 'Try Allagash White — same family, more craft.' Life-changing upgrade."

"Brunch beer? Hefeweizen or Witbier with eggs Benedict. Trust it."
$md$
where title = 'Wheat Beers' and is_seed = true;

-- Reading a Beer Label
update public.modules set content = $md$
**WHY LABELS MATTER IN BEER**

Beer labels pack information that directly affects whether a customer enjoys the product. ABV tells you how strong it is. IBU tells you how bitter. The date tells you if it's fresh. Staff who can decode a beer label become trusted advisors.

**THE KEY NUMBERS**

**ABV (Alcohol By Volume):**
• 3-5% = session (easy drinking, multiple beers territory)
• 5-6.5% = standard (most craft beers)
• 7-10% = strong (sip slowly, pair with food)
• 10%+ = imperial/extreme (treat like wine — small pours)

**IBU (International Bitterness Units):**
• 10-25 = mild (wheat beers, lagers, witbier)
• 25-40 = moderate (pale ales, ambers)
• 40-70 = hoppy (most IPAs)
• 70-100+ = very bitter (double IPAs, barleywines)

**Important:** IBU perception depends on MALT sweetness. A 70 IBU sweet barleywine feels LESS bitter than a 40 IBU bone-dry IPA. Numbers alone don't tell the whole story.

**THE FRESHNESS FACTOR**

This is the SINGLE MOST IMPORTANT thing on a beer label for hop-forward beers:

**"Packaged on" or "Canned on" date:** IPAs should be consumed within 90 days of this date. After that, hop aromatics oxidize — the beer tastes flat, cardboardy, and dull.

**Stouts, Belgian ales, barleywines?** These can improve with age. A year-old Imperial Stout is often BETTER. A year-old IPA is significantly worse.

**"Best by" date:** some breweries use this instead. Count backwards — if it's "best by June" and it's April, you have 2 months of freshness left.

**HOP NAMES ON THE LABEL**

Staff should recognize the major hops by flavor:
• **Citra** — tropical, mango (the king of haze)
• **Mosaic** — blueberry, tropical
• **Galaxy** — passionfruit (Australian)
• **Simcoe** — pine, earthy, dank
• **Cascade** — grapefruit, floral (Sierra Nevada's hop)
• **Amarillo** — orange citrus

**WHAT TO SAY ON THE FLOOR**

"Checking ABV: 'This one's 9% — it's strong. One or two is plenty. Want something sessionable? Here's a 4.5% that still has great flavor.'"

"ALWAYS check dates on IPAs. Rotate older stock to the front. If it's past 90 days, consider pulling it."

"Customer asks 'what's IBU?' → 'It measures bitterness from hops. This IPA is 65 — definitely hoppy. Want less bitter? This Hazy is 45 but tastes less bitter because of the style.'"
$md$
where title = 'Reading a Beer Label' and is_seed = true;

-- Wheat Whiskey & Specialty Grains
update public.modules set content = $md$
**THE STORY**

The American whiskey world is built on corn (bourbon) and rye. But wheat whiskey and American single malt are quietly building passionate followings — and staff who know about them have a secret weapon for the customer who says "I've tried everything."

**Wheat whiskey** uses 51%+ wheat in the mash bill. The result is softer, sweeter, and more delicate than bourbon or rye — think bread dough and honey instead of caramel and spice. It's niche, but the people who love it REALLY love it.

**Wheated bourbon** (different category!) uses corn as the primary grain but replaces rye with wheat as the secondary grain. This is the Maker's Mark / Pappy Van Winkle family. Not to be confused with wheat whiskey.

**American Single Malt** uses 100% malted barley — same rules as Scotch, but made in America. The category was formally defined by the TTB in 2022. It's growing fast.

**TOP SELLERS YOUR STAFF MUST KNOW**

1. **Maker's Mark** — $28. The famous wheated BOURBON. Soft, round, butterscotch. Red wax seal. "Not wheat whiskey — wheated bourbon. The wheat replaces rye, making it smoother."

2. **Weller Special Reserve** — $25 (if findable). Same mash bill as Pappy Van Winkle. "The Pappy you can (sometimes) actually buy. Same recipe, younger age."

3. **Westland American Single Malt** — $55. Seattle. Peat, sherry cask, innovative. "Scotch lover curious about American? This bridges the gap."

4. **Balcones Texas Single Malt** — $40. Bold, roasty, Texas character. "Single malt with Texas attitude."

5. **Bernheim Original Wheat Whiskey** — $30. Heaven Hill's actual wheat whiskey (51%+ wheat). Toffee, vanilla, honey. "The rare true wheat whiskey."

**THE PAPPY CONVERSATION**

Every whiskey customer eventually asks about Pappy Van Winkle. Here's what staff need to know:
• Pappy is a wheated bourbon from Buffalo Trace
• Weller uses the SAME mash bill (same recipe, different age/barrel selection)
• Pappy 15-year retails at ~$100 but sells for $1,000+ secondary
• You probably won't have it. If you do, it goes to your best customers.
• "Can't find Pappy? Weller Antique 107 is the same recipe and genuinely excellent."

**WHAT TO SAY ON THE FLOOR**

"Want bourbon but smoother? Maker's Mark — wheat instead of rye makes it softer."

"Scotch drinker exploring American whiskey? Westland or Balcones — they're American single malts."
$md$
where title = 'Wheat Whiskey & Specialty Grains' and is_seed = true;

-- Whiskey Blends & Budget Guide
update public.modules set content = $md$
**WHY THIS MODULE EXISTS**

Not every customer wants a $50 single barrel. Most want something reliable for $20-30 that works neat, on the rocks, or in cocktails. Staff who can confidently recommend in this range — without condescension — build the most loyal customers.

**BEST BOURBONS UNDER $30**

1. **Buffalo Trace** — $25. The universal recommendation. Vanilla, caramel, orange peel. "If you can only stock one bourbon under $30, this is it."
2. **Wild Turkey 101** — $23. 101 proof, high-rye, bold. Bartender's workhorse. "Stands up in any cocktail."
3. **Evan Williams Single Barrel** — $28. VINTAGE-DATED. Incredibly overdelivers. "The best-kept secret on the bourbon shelf."
4. **Old Grand-Dad Bonded** — $25. High-rye, 100 proof. "The hipster bourbon — it was underrated for decades."
5. **Maker's Mark** — $28. Wheated, smooth. "The easy recommendation for non-spicy preferences."

**BEST RYES UNDER $30**

1. **Rittenhouse Bottled-in-Bond** — $28. THE bartender's rye.
2. **Old Overholt Bonded** — $20. Budget bonded rye. Solid.
3. **Bulleit Rye** — $28. 95% rye, big spice.

**BEST WORLD WHISKEYS UNDER $35**

1. **Suntory Toki** — $28. Japanese blend. Highball heaven.
2. **Monkey Shoulder** — $30. Speyside Scotch blend. Cocktail-friendly.
3. **Johnnie Walker Black** — $33. 12-year benchmark blended Scotch.
4. **Jameson** — $30. Universal Irish whiskey.
5. **Crown Royal** — $25. Canadian. Sweet, smooth, approachable.

**THE "WELL" CONCEPT**

Every home bar needs a "well" — the default bottle you pour without thinking. Cover four styles under $35 each:
• Bourbon well: Buffalo Trace ($25)
• Rye well: Rittenhouse ($28)
• Irish well: Jameson ($30)
• Scotch well: JW Black ($33)

Total: ~$116 for a complete whiskey bar.

**WHAT TO SAY ON THE FLOOR**

"Best bourbon under $25? Buffalo Trace. Best under $20? Evan Williams BiB."

"Cocktail whiskey? Wild Turkey 101 or Rittenhouse — they're designed for mixing."

"Building a home bar from scratch? I can set you up with 4 whiskeys for $116 that cover every base."
$md$
where title = 'Whiskey Blends & Budget Guide' and is_seed = true;

-- Whiskey Cocktails at Home
update public.modules set content = $md$
**THE UPSELL GOLDMINE**

Every whiskey purchase has a 2-3 item add-on opportunity. When a customer buys a bottle of bourbon, they're not just buying a drink — they're buying an EXPERIENCE. Staff who can say "Making Old Fashioneds? Grab these two things" turn a $25 sale into a $50 sale. And the customer THANKS you for it.

**THE 5 WHISKEY COCKTAILS EVERY HOME BARTENDER SHOULD MASTER**

**1. OLD FASHIONED** (the foundation)
• 2 oz bourbon or rye + 1 sugar cube or ¼ oz demerara syrup + 2-3 dashes Angostura bitters + orange twist
• Customer needs to buy: bitters ($10), sugar or demerara syrup ($5)
• Upsell: Luxardo cherries ($22). "These are the real cocktail cherries — not the neon-red kind."

**2. MANHATTAN** (the elegant one)
• 2 oz rye + 1 oz sweet vermouth + 2 dashes Angostura + Luxardo cherry
• Customer needs: sweet vermouth (Carpano Antica $35 or Cocchi $22) + Luxardo cherries
• "REFRIGERATE THE VERMOUTH. It's wine — goes bad in 4-6 weeks at room temp."

**3. WHISKEY SOUR** (the crowd-pleaser)
• 2 oz bourbon + ¾ oz lemon + ¾ oz simple + optional egg white
• Customer needs: fresh lemons, simple syrup (or make at home)
• "The egg white makes the foam. No egg taste — lemon acid neutralizes it."

**4. MINT JULEP** (the Derby Day classic)
• 2½ oz bourbon + ½ oz simple + 8 mint leaves + crushed ice
• Customer needs: fresh mint, crushed ice (or zip bag + rolling pin method)
• Best bourbon for juleps: Woodford Reserve ($35) — the official bourbon of the Kentucky Derby

**5. IRISH COFFEE** (the after-dinner)
• 1½ oz Irish whiskey + hot coffee + 1 tsp brown sugar + lightly-whipped heavy cream float
• Customer needs: Irish whiskey (Jameson $30), good coffee, heavy cream
• "The cream should FLOAT, not mix. Lightly whip it — just barely thickened."

**THE UPSELL SCRIPT**

Customer buys bourbon → "Making Old Fashioneds? You'll need Angostura bitters — right over here — and if you want the real deal, these Luxardo cherries change everything."

Customer buys rye → "That's great Manhattan rye. Do you have sweet vermouth? Carpano Antica will transform the drink."

Customer buys Jameson → "Irish Coffee season — just needs hot coffee and a float of cream. Try it this weekend."

**WHAT TO SAY ON THE FLOOR**

"Every whiskey sale is a cocktail kit sale. The bottle is step one — the accessories are where the magic (and the margin) lives."
$md$
where title = 'Whiskey Cocktails at Home' and is_seed = true;
