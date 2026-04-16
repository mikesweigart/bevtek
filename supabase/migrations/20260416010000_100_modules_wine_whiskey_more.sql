-- Modules 60-100: Wine deep-dives, Whiskey specialization, Beer essentials,
-- Spirits additions, Sales & Service. Gets us to 100 total.
--
-- Categories adjusted per user feedback:
-- ✓ More granular wine (by region + style)
-- ✓ Whiskey: bourbon, blends, scotch, Japanese, Tennessee, wheat
-- ✓ Beer: just core styles (IPA, pilsner, lager) + beginner + pairing + NA
-- ✓ Sales & Service (10 modules)
-- ✗ NO seasonal/trending
-- ✗ NO allocated bottles
-- ✗ NO draft beer systems

-- ============================================================================
-- WINE — expanded (12 new)
-- ============================================================================

insert into public.modules (title, description, content, category_group, category, position, star_reward, duration_minutes, is_seed, is_published, store_id)
values

('Australian Chardonnay', 'From Yarra Valley to Margaret River — not just butter and oak anymore.', $md$
Australia's Chardonnay revolution happened quietly. While the world associates Aussie whites with big, oaky Penfolds-style wines, the cool-climate regions now produce some of the most elegant Chardonnays on the planet.

**Two camps:**

**Cool-climate (modern):** Yarra Valley (Victoria), Adelaide Hills, Mornington Peninsula, Tasmania, Margaret River. Tight acid, citrus, stone fruit, mineral. Often partially or entirely unoaked. Think white Burgundy with a Southern Hemisphere twist.

**Warm-climate (classic):** Hunter Valley, Barossa. Richer, more tropical, oak-friendly. The "classic Aussie Chard" that put Australia on the map in the 80s-90s.

**Producers to know:**
- Cool/modern: Leeuwin Estate Art Series ($60), Giant Steps ($25), Shaw + Smith M3 ($30), Tolpuddle ($40)
- Warm/classic: Penfolds Yattarna ($150+), Tyrrell's Vat 47 ($50), McWilliam's

**Sell notes:**
- Customer loves Chablis: point to Yarra Valley or Tasmania Chardonnay
- Customer loves buttery CA Chard: Hunter Valley or aged Barossa
- Customer wants value: Shaw + Smith M3 ($30) punches way above its weight
- Great food wine: Australian cool-climate Chard pairs beautifully with seafood, poultry, Asian cuisine
$md$, 'wine_world', 'Wine', 5, 2, 5, true, true, null),

('New Zealand Sauvignon Blanc', 'Marlborough defined a style the whole world copies.', $md$
New Zealand Sauvignon Blanc — specifically from **Marlborough** — created an entirely new flavor profile that didn't exist before the 1980s. Explosive passionfruit, grapefruit, cut grass, gooseberry. Higher acid than California, more fruit than Loire.

**Marlborough** (90% of NZ Sauv Blanc): the benchmark. Cloudy Bay started it all in 1985. Now dozens of producers at every price point.

**Key producers by tier:**
- Entry ($12-18): Kim Crawford, Oyster Bay, Whitehaven, Matua
- Mid ($18-30): Cloudy Bay ($25), Dog Point, Craggy Range, Villa Maria Reserve
- Premium ($30-50): Greywacke (made by the founder of Cloudy Bay), Te Whare Ra

**Other NZ regions:** Hawke's Bay (warmer, rounder), Martinborough (more restrained), Central Otago (rare for Sauv Blanc — mostly Pinot Noir).

**The "green" controversy:** Some critics find NZ Sauv Blanc too aggressive — too much grass, too much acid, too one-note. They're not wrong that cheaper examples can be shrill. But great Marlborough Sauv Blanc (Greywacke, Dog Point) has complexity, texture, and aging potential.

**Sell notes:**
- Summer sipper, no-brainer: Kim Crawford or Oyster Bay ($14-16)
- Goat cheese pairing: ANY NZ Sauv Blanc — the acid cuts the cream perfectly
- Upgrade from Kim Crawford: Cloudy Bay ($25) — the prestige bottle
- Customer says "I only drink Sauv Blanc": NZ is their home. Also try Sancerre for a French alternative.
$md$, 'wine_world', 'Wine', 6, 2, 5, true, true, null),

('South African Wine', 'Chenin Blanc, Pinotage, and the Cape Winelands.', $md$
South Africa is the world's 8th-largest wine producer with 300+ years of winemaking history. Two grapes define the country: **Chenin Blanc** (white) and **Pinotage** (red).

**Chenin Blanc** — South Africa's signature white. Called "Steen" locally. Ranges from bone-dry to lusciously sweet. Honeydew, green apple, lanolin, hay. Africa's answer to Vouvray. Often extraordinary value.
- Producers: Mullineux, Ken Forrester, Raats, DeMorgenzon

**Pinotage** — a cross between Pinot Noir and Cinsaut, created in South Africa in 1925. Divisive: fans love its smoky, bramble, coffee character; critics find it rustic. Modern versions are much cleaner.
- Producers: Kanonkop (the icon), Beyerskloof, Simonsig

**Cabernet Sauvignon & Bordeaux blends** from Stellenbosch rival Napa at a fraction of the price.
- Producers: Rust en Vrede, Meerlust Rubicon, Vergelegen

**Sell notes:**
- Value white wine: South African Chenin Blanc ($12-20) is the best value in white wine globally
- Customer who likes Malbec: try Pinotage — similar boldness, unique character
- Cab lover on a budget: Stellenbosch Cab at $20 = Napa quality at half the price
- Gift: Meerlust Rubicon ($35) — South Africa's most respected red blend
$md$, 'wine_world', 'Wine', 7, 2, 5, true, true, null),

('California Reds Deep-Dive', 'Beyond Napa Cab — Zinfandel, Syrah, Petite Sirah, and Pinot.', $md$
California makes more than Cabernet. The state produces world-class wines from a dozen red grapes across dozens of AVAs.

**Zinfandel** — California's "heritage grape" (originally Croatian). Jammy, spicy, high-alcohol (often 15%+). Best from Dry Creek Valley (Sonoma), Lodi, Paso Robles, Amador County.
- Producers: Ridge (Geyserville, Lytton Springs), Turley, Seghesio, Michael David

**Syrah / Petite Sirah** — Syrah (=Shiraz) makes peppery, meaty reds. Petite Sirah (a different grape — Durif) is inky, tannic, dark. Both thrive in Paso Robles, Santa Barbara, Sonoma.
- Syrah: Alban, Stolpman, Qupé, Tensley
- Petite Sirah: Stags' Leap Winery (not District), Turley, Concannon

**Pinot Noir** — covered in the Oregon module, but California's Sonoma Coast, Russian River, Santa Rita Hills, and Anderson Valley produce stunning Pinot.
- Producers: Kosta Browne, Williams Selyem, Littorai, Siduri, Au Bon Climat

**Rhône blends** — Central Coast (Paso Robles, Santa Ynez) specializes in GSM blends and Rhône varietals.
- Producers: Tablas Creek, Bonny Doon, Saxum, Denner

**Sell notes:**
- BBQ wine: Zinfandel (Ridge Lytton Springs or Seghesio)
- Napa Cab drinker wants to explore: Paso Robles Syrah or Rhône blend
- Budget powerhouse: Lodi Zinfandel ($12-18) — big fruit, low pretension
$md$, 'wine_usa', 'Wine', 7, 2, 5, true, true, null),

('California Whites Deep-Dive', 'Viognier, Pinot Gris, Albariño, and the "other" whites.', $md$
Beyond Chardonnay and Sauvignon Blanc, California grows dozens of white varieties that most customers have never tried.

**Viognier** — aromatic, honeysuckle, apricot, peach. Full body but dry. Thrives in Paso Robles, Lodi, Central Coast.
- Producers: Cline, Tablas Creek, Alban, Jada

**Pinot Gris / Pinot Grigio** — California versions have more body than Italian, less acid than Alsatian. Pear, apple, slight honey.
- Producers: J Vineyards, King Estate (technically Oregon but distributed as CA), La Crema

**Albariño** — the Spanish coastal grape is gaining ground in California. Crisp, saline, citrus. Perfect seafood wine.
- Producers: Tangent, Verdad, Bokisch

**Grenache Blanc / Roussanne / Marsanne** — Rhône white varieties from Paso Robles and Santa Barbara. Rich, textured, food-friendly.
- Producers: Tablas Creek (the pioneer), Bonny Doon, Herman Story

**Riesling** — small California plantings but excellent in cool spots. Anderson Valley, Monterey.

**Sell notes:**
- Customer is tired of Chardonnay: Viognier (aromatic but not sweet) or Albariño (crisp, mineral)
- Seafood pairing that isn't Sauv Blanc: Albariño or Grenache Blanc
- Cocktail-party crowd-pleaser: Pinot Gris — inoffensive, food-friendly, everyone likes it
$md$, 'wine_usa', 'Wine', 8, 2, 5, true, true, null),

('Oregon Whites', 'Pinot Gris, Riesling, Chardonnay — the other half of the Willamette.', $md$
Oregon is famous for Pinot Noir, but its white wines are exceptional and underpriced.

**Pinot Gris** — Oregon's most-planted white grape. Richer than Italian Pinot Grigio, with pear, apple, and a slight honeyed texture. The state's signature white.
- Producers: King Estate (the biggest), Ponzi, Chehalem, A to Z

**Chardonnay** — often overlooked for Burgundy or California, but Oregon makes lean, mineral, Burgundian-style Chardonnay that's genuinely world-class.
- Producers: Roco, Domaine Drouhin, Stoller, Evening Land

**Riesling** — small but growing. Dry to off-dry styles from cooler sites in the Willamette.
- Producers: Trisaetum, Brooks, Chehalem

**Müller-Thurgau** — a quirky Germanic grape that Oregon actually does well. Floral, light, perfect porch wine.

**Sell notes:**
- Customer loves Italian Pinot Grigio: Oregon Pinot Gris is the upgrade — same grape, more character
- Customer wants Burgundy-style Chard without Burgundy prices: Oregon Chardonnay ($25-40 vs. $60+ for Burgundy)
- The Oregon white wine gift: Ponzi Pinot Gris or Domaine Drouhin Chardonnay — both respected, both under $30
$md$, 'wine_usa', 'Wine', 9, 2, 5, true, true, null),

('Italian Reds — Chianti to Amarone', 'Sangiovese, Nebbiolo, and the wines that built Italian food culture.', $md$
Italy has more indigenous grape varieties than any country on Earth. Three reds dominate exports.

**Sangiovese** — Tuscany's grape. Makes Chianti (blended), Brunello di Montalcino (100% Sangiovese, aged 5+ years), Vino Nobile di Montepulciano. Cherry, leather, herbs, bright acid.
- Chianti Classico ($15-30): Antinori, Felsina, Castello di Ama
- Brunello ($50-200): Biondi-Santi (the icon), Casanova di Neri, Il Poggione
- "Super Tuscans" — Cab/Merlot blended with Sangiovese. Sassicaia, Ornellaia, Tignanello.

**Nebbiolo** — Piedmont's grape. Barolo and Barbaresco (covered in original modules). Also makes Langhe Nebbiolo (easier-drinking, $20-30) and Roero.

**Corvina (Valpolicella / Amarone):**
- **Valpolicella** — light, cherry, everyday Italian red ($12-18)
- **Ripasso** — Valpolicella refermented on Amarone grape skins. Richer, "baby Amarone" ($18-30)
- **Amarone della Valpolicella** — dried-grape method, massive, rich, 15%+ ABV, dried cherry, chocolate, fig ($40-120)

**Primitivo / Nero d'Avola** — southern Italian reds. Bold, ripe, value-driven. Puglia and Sicily.

**Sell notes:**
- Tuesday pasta night: Chianti Classico — born for tomato sauce
- Special occasion Italian: Brunello or Amarone
- Budget Italian red: Montepulciano d'Abruzzo ($10-14) — soft, fruity, crowd-friendly
$md$, 'wine_world', 'Wine', 8, 2, 5, true, true, null),

('Italian Whites — Pinot Grigio to Vermentino', 'Crisp, mineral, made for seafood.', $md$
Italian white wine is the world's go-to for light, food-friendly sipping.

**Pinot Grigio** — Italy's #1 white export. From the Veneto and Trentino-Alto Adige. Ranges from watery/cheap to genuinely excellent depending on the producer.
- Value ($10-15): Santa Margherita (the OG premium PG), Ecco Domani, Cavit
- Quality ($15-25): Jermann, Livio Felluga, Alois Lageder
- Alto Adige versions have more structure, acid, and minerality than flat Veneto bottlings.

**Vermentino** — Sardinia and Liguria's coastal white. Crisp, saline, citrus, almond. The Mediterranean seafood wine.
- Producers: Argiolas, Cantina di Santadi, Sella & Mosca

**Soave** — Garganega grape from the Veneto. Almond, white flowers, mineral. Underrated.
- Producers: Pieropan, Inama, Gini

**Gavi (Cortese)** — Piedmont's crisp white. Lemon, green apple, very dry. Elegant aperitif.

**Falanghina / Fiano / Greco** — Campania's whites (southern Italy). Richer, more textured, sometimes waxy. The "new frontier" for Italian whites.

**Arneis** — Piedmont. Pear, herbs, almond. Roero Arneis is a lovely alternative to Pinot Grigio.

**Sell notes:**
- Customer wants "Pinot Grigio but better": Vermentino or Soave — similar weight, more character
- Oyster/shellfish: Vermentino is the Italian answer to Muscadet
- Gift: Livio Felluga Pinot Grigio ($22) — the prestige PG everyone recognizes
$md$, 'wine_world', 'Wine', 9, 2, 5, true, true, null),

('How to Read a Wine Label', 'Old World vs. New World labeling — and what actually matters.', $md$
Wine labels confuse everyone. Here's what staff needs to know to help customers.

**New World labels (USA, Australia, NZ, Chile, Argentina):**
Primary info: **grape name** (Cabernet Sauvignon, Chardonnay). Region secondary. What you see: "2022 Napa Valley Cabernet Sauvignon."

**Old World labels (France, Italy, Spain, Germany):**
Primary info: **region** (Chablis, Barolo, Rioja). Grape often NOT stated. What you see: "Chablis 2021" — the grape (Chardonnay) is implied by the region.

**Key label terms:**
- **Vintage** — the year the grapes were harvested. Important for quality variation in France; less so in consistent warm climates.
- **Estate Bottled / Mis en Bouteille au Domaine** — made and bottled by the grower. Generally a quality indicator.
- **Reserve / Reserva / Riserva** — means different things in different countries. In Spain (Reserva = aged minimum years). In the US, it's meaningless marketing.
- **Grand Cru / Premier Cru** — French vineyard classifications. Grand Cru = top tier.
- **ABV** — alcohol percentage. Under 12% = lighter body. 14-15% = full and rich.
- **Sulfites** — legally required on all US-sold wine. Every wine has them. Not a quality indicator.

**What customers actually care about:**
1. What grape? (or what region, which implies the grape)
2. How much does it cost?
3. Is it dry or sweet?
4. What food does it go with?

**Sell notes:** When a customer stares at a label looking confused, just ask: "What are you having for dinner?" and work backwards from there.
$md$, 'wine_france', 'Wine', 7, 2, 4, true, true, null),

('Wine Storage & Serving Temperature', 'The two things that ruin more wine than anything else.', $md$
Most wine damage happens at home — wrong temperature, wrong storage. Staff who know this can save customers from wasting good bottles.

**Storage rules:**
1. **Temperature:** 55°F (13°C) is ideal. Anything 45-65°F is acceptable. Above 70°F = damage within weeks. A hot car trunk in summer destroys wine in hours.
2. **Light:** UV light degrades wine. Dark storage. This is why wine bottles are often dark-colored.
3. **Humidity:** 60-70% prevents corks from drying. Screw-cap wines don't need humidity.
4. **Position:** Cork bottles on their side (keeps cork moist). Screw caps can be upright.
5. **Vibration:** minimal. Don't store on top of the fridge (motor vibration + heat).

**Serving temperatures (the #1 thing people get wrong):**
- Sparkling: 40-45°F (ice cold)
- Light whites (Sauv Blanc, Pinot Grigio): 45-50°F
- Full whites (Chardonnay, Viognier): 50-55°F
- Rosé: 45-50°F
- Light reds (Pinot Noir, Gamay): 55-60°F
- Medium reds (Chianti, Rioja): 60-65°F
- Full reds (Cab, Syrah, Barolo): 63-68°F

**"Room temperature" is a myth.** That term comes from 18th-century European castles (55-60°F). Modern room temp (72°F) is TOO WARM for any wine.

**The 20-minute rule:** Put reds in the fridge 20 minutes before serving. Take whites out 20 minutes before. Both arrive at the right temp.

**Sell notes:** When a customer buys a $50+ bottle, remind them about temp. "This will be amazing at 60 degrees — put it in the fridge for 20 minutes before dinner."
$md$, 'wine_france', 'Wine', 8, 2, 4, true, true, null),

('Wine for Beginners', 'The zero-judgment guide for customers who say "I don''t know wine."', $md$
Every day, someone walks into your store and says "I don't know anything about wine." This module teaches you how to help them in 60 seconds.

**The 3-question method:**
1. "Red, white, or either?" — narrows the field by 50%
2. "What are you eating?" — gives you a pairing anchor
3. "What's your budget?" — keeps the recommendation honest

**If they say "I don't know":** Start with these universally-liked, easy-drinking wines:
- **White:** Sauvignon Blanc (crisp, clean) or Pinot Grigio (light, neutral)
- **Red:** Malbec (soft, fruity) or Pinot Noir (light, food-friendly)
- **Sweet-leaning:** Moscato d'Asti, Riesling (off-dry), or Rosé
- **Sparkling:** Prosecco (universally liked, under $15)

**Common "I don't like wine" objections and fixes:**
- "Wine gives me a headache" → likely sulfite sensitivity or dehydration. Try organic/low-sulfite wines.
- "Wine is too dry" → they need off-dry: Riesling, Gewürztraminer, Moscato
- "Wine is too sweet" → they need bone-dry: Sancerre, Chablis, Brut Champagne
- "I only like red/white" → respect the preference. Don't push.

**The $15 sweet spot:** For beginners, $12-18 is the quality/value inflection point. Below $10, quality drops noticeably. Above $25, the nuances are wasted on a beginner palate.

**Sell notes:** NEVER make a beginner feel dumb. "Great question — let me find something you'll love" is always the right response. The goal is a second visit, not a big sale.
$md$, 'wine_usa', 'Wine', 10, 2, 4, true, true, null),

('Dessert Wines — Port, Sauternes & Ice Wine', 'Sweet wines for after dinner, cheese, and gifts.', $md$
Dessert wines are the most underappreciated category in the store. They're some of the most complex, longest-lived wines in the world — and most customers have never tried a good one.

**Port (Portugal):**
- **Ruby Port** — young, fruity, vibrant. Entry-level. $12-20.
- **Tawny Port** (10, 20, 30, 40 year) — aged in barrel. Caramel, nuts, dried fruit. The older, the more complex (and expensive). 20-year ($30-50) is the sweet spot.
- **Vintage/Vintage Port (Vintage Vintage)** — declared only in great years. Massive, age-worthy, decant. $40-150.
- **Late Bottled Vintage (LBV)** — mini Vintage Port, more accessible. $15-25.

**Sauternes (France):**
Botrytized (noble rot) Sémillon/Sauvignon Blanc from Bordeaux. Honeyed, apricot, marmalade, luscious. Pairs with foie gras, blue cheese, fruit desserts.
- Château d'Yquem is the icon ($200+). Château Rieussec, Château Climens at $40-80 are excellent.

**Ice Wine / Eiswein (Canada, Germany):**
Grapes frozen on the vine, pressed while frozen. Intensely sweet, high acid. Apricot, lychee, honey.
- Canadian: Inniskillin ($40-60 for 375ml)
- German: any Eiswein from Mosel or Rheingau

**Moscato d'Asti** — lightly sparkling Italian sweet wine. Low ABV (5-6%). Peach, apricot, honey. $12-20.

**Sell notes:**
- "What goes with chocolate?" → Tawny Port or Ruby Port
- "Cheese course?" → Sauternes + Stilton is one of wine's greatest pairings
- Gift: 375ml Sauternes or Ice Wine — small bottle, big impression
$md$, 'wine_world', 'Wine', 10, 2, 5, true, true, null),

-- ============================================================================
-- WHISKEY — expanded (4 new)
-- ============================================================================

('Tennessee Whiskey', 'Jack Daniel''s, George Dickel — what makes Tennessee different from bourbon.', $md$
Tennessee Whiskey is legally a subset of bourbon (meets all bourbon requirements) with one addition: the **Lincoln County Process** — filtering through sugar maple charcoal before aging.

**What the charcoal does:** mellows the spirit, removes harsh congeners, adds a slightly sweet/sooty character. The whiskey drips through 10 feet of stacked charcoal over 3-5 days.

**Jack Daniel's** — the world's best-selling American whiskey.
- **Old No. 7 (black label)** — the standard. Banana, caramel, light smoke. 80 proof. $25.
- **Gentleman Jack** — double charcoal-filtered. Smoother, softer. $30.
- **Single Barrel Select** — individual barrel, 94 proof, more complex. $50.
- **Sinatra Select** — uses "Sinatra barrels" with extra staves. Rich, bold. $170.

**George Dickel** — Jack's quieter neighbor. Uses a chilled charcoal mellowing process.
- **No. 8** — light, approachable. $22.
- **Barrel Select** — richer, 86 proof. $35.
- **Bottled in Bond** — 100 proof, 13 years. Excellent value at $40.

**Uncle Nearest** — brand honoring Nathan "Nearest" Green, the enslaved man who taught Jack Daniel to distill. Premium Tennessee whiskey.
- **1856** — 100 proof, blend of 8-14 year barrels. $60.
- **1884** — 93 proof, approachable. $40.

**Sell notes:**
- "I want whiskey but bourbon is too strong": Tennessee — the charcoal mellowing makes it softer
- Jack Daniel's gift: Single Barrel Select is the upgrade move
- Cocktails: Old No. 7 works great in Lynchburg Lemonade and Tennessee Mules
$md$, 'spirits', 'Spirits', 13, 2, 5, true, true, null),

('Wheat Whiskey & Specialty Grains', 'Beyond corn and rye — wheat, oat, and malt whiskey.', $md$
Most American whiskey is corn-based (bourbon) or rye-based. But wheat and other grains are having a moment.

**Wheat whiskey** (51%+ wheat in the mash bill): Soft, sweet, bready, gentle. Often compared to "bourbon's easy-going sibling."
- **Bernheim Original** — Heaven Hill's wheat whiskey. Toffee, vanilla, honey. $30.
- **Dry Fly** (Washington state) — small-batch wheat whiskey.

**Wheated bourbon** (corn-dominant, but wheat replaces rye as the secondary grain): NOT wheat whiskey — it's bourbon with wheat instead of rye. Softer, rounder than high-rye bourbons.
- **Maker's Mark** — the famous wheated bourbon. $25.
- **Weller** (Buffalo Trace family) — same mash bill as Pappy Van Winkle. Special Reserve ($25 if findable), Antique 107, 12 Year, Full Proof. Highly allocated.
- **Larceny** — Heaven Hill's wheated bourbon. $25.

**Malt whiskey** (51%+ malted barley): American single malt is a growing category.
- **Westland** (Seattle) — American Single Malt pioneer. Peat, sherry cask, garrigue.
- **Balcones** (Texas) — Texas Single Malt. Bold, roasty.
- **Stranahan's** (Colorado) — smooth, honeyed.

**Sell notes:**
- Bourbon drinker who says "I want something softer": wheated bourbon (Maker's, Larceny)
- Scotch drinker visiting bourbon country: American Single Malt (Westland, Balcones)
- The Pappy conversation: Weller is the same recipe. If they can't find Pappy, Weller Antique 107 is the consolation.
$md$, 'spirits', 'Spirits', 14, 2, 5, true, true, null),

('Whiskey Blends & Budget Guide', 'Best bottles under $30 — and blends that punch above their price.', $md$
Not every customer wants a $50 single barrel. Most want something solid for $20-30 that works neat, on the rocks, or in cocktails.

**Best bourbons under $30:**
- **Buffalo Trace** ($25) — the benchmark. Everyone loves it.
- **Wild Turkey 101** ($22) — 101 proof workhorse. Bartender favorite.
- **Evan Williams Single Barrel** ($28) — vintage-dated, incredibly overdelivers.
- **Old Grand-Dad Bonded** ($25) — high-rye, 100 proof, classic.
- **Maker's Mark** ($25) — wheated, smooth, reliable.

**Best ryes under $30:**
- **Rittenhouse Bottled-in-Bond** ($28) — the bartender's rye.
- **Old Overholt Bonded** ($20) — budget bonded rye, solid.
- **Bulleit Rye** ($28) — 95% rye, big spice.

**Best blended whiskeys (American + world):**
- **Suntory Toki** ($28) — Japanese blend, light, approachable. Makes great highballs.
- **Monkey Shoulder** ($30) — Speyside Scotch blend. Smooth, cocktail-friendly.
- **Johnnie Walker Black** ($33) — the benchmark blended Scotch. 12-year.
- **Jameson** ($25) — the universal Irish whiskey.
- **Crown Royal** ($25) — Canadian. Sweet, smooth, approachable.

**The "Well" conversation:** Every home bar needs a "well" whiskey — the bottle you pour without thinking. Buffalo Trace (bourbon), Rittenhouse (rye), Jameson (Irish), and JW Black (Scotch) cover all four styles under $35 each.

**Sell notes:**
- "What's your best bourbon under $25?" → Buffalo Trace or Wild Turkey 101, depending on their proof preference
- "I want a whiskey for cocktails" → Wild Turkey 101 or Rittenhouse — designed for mixing
$md$, 'spirits', 'Spirits', 15, 2, 5, true, true, null),

('Whiskey Cocktails at Home', 'The 5 whiskey cocktails every home bartender should master.', $md$
Staff should know these five by heart. When a customer buys a bottle of whiskey, suggest one.

**1. Old Fashioned** (already a full module — quick recap):
- 2 oz bourbon/rye + sugar + Angostura bitters + orange twist
- The first cocktail. The foundation. Customer needs: bitters, sugar, orange.

**2. Manhattan:**
- 2 oz rye + 1 oz sweet vermouth + 2 dashes Angostura + cherry
- Customer needs: sweet vermouth (REFRIGERATE), Luxardo cherries.

**3. Whiskey Sour:**
- 2 oz bourbon + ¾ oz lemon + ¾ oz simple + optional egg white
- Customer needs: fresh lemons, simple syrup. Egg white for the foam upgrade.

**4. Mint Julep:**
- 2½ oz bourbon + ½ oz simple + 8 mint leaves + crushed ice
- Customer needs: fresh mint, crushed ice, silver julep cup (optional). Derby Day classic.

**5. Irish Coffee:**
- 1½ oz Irish whiskey + hot coffee + 1 tsp brown sugar + heavy cream float
- Customer needs: Irish whiskey (Jameson), good coffee, heavy cream (lightly whipped, NOT stiff peaks — it should flow).

**The upsell framework:**
Customer buys bourbon → "Making Old Fashioneds? You'll want Angostura bitters and some Luxardo cherries — they're over here."
Customer buys rye → "That's a great Manhattan rye. Do you have sweet vermouth? Carpano Antica transforms the drink."
Customer buys Irish → "Irish Coffee season — just add hot coffee and a float of cream."

Every whiskey sale has a 2-3 item add-on opportunity.
$md$, 'spirits', 'Spirits', 16, 2, 5, true, true, null),

-- ============================================================================
-- BEER — expanded (3 new)
-- ============================================================================

('Craft Beer for Beginners', 'Where to start when "just a beer" isn''t enough anymore.', $md$
Craft beer has exploded to 9,000+ breweries in the US. That's overwhelming. Here's how to navigate a customer who wants to explore.

**The 5 gateway styles (start here):**
1. **Helles Lager** (Weihenstephaner, Augustiner) — crisp, clean, malty. "Better Bud Light."
2. **Wheat Beer** (Hoegaarden, Allagash White) — hazy, citrus, coriander. Approachable.
3. **Amber / Red Ale** (Fat Tire, Killian's) — malty, caramel, balanced. Bridge from macro to craft.
4. **Pale Ale** (Sierra Nevada, Dale's) — hoppy but not overwhelming.
5. **Session IPA** (Founders All Day, Lagunitas DayTime) — IPA flavor at lower ABV.

**The discovery path:**
Gateway lager → wheat beer → pale ale → IPA → double IPA → stouts → sours → Belgian ales

**Don't start with:**
- Imperial stout (too heavy, too boozy for a newbie)
- Sour/lambic (too extreme)
- Triple IPA (too bitter, too strong)
- Barrel-aged anything (too complex, too expensive for exploration)

**How staff should guide:**
- "What beer do you usually drink?" → suggest one step up in complexity
- "I drink Bud Light" → try a Helles or Cream Ale
- "I drink Blue Moon" → try Allagash White or a Belgian Wit
- "I hate beer" → try a fruited sour or Belgian Witbier — they barely taste like "beer"

**Sell notes:** Singles and mix-six packs are the discovery format. Don't push a 6-pack of something they've never tried — one can first.
$md$, 'beer', 'Beer', 9, 2, 4, true, true, null),

('Beer & Food Pairing', 'Beyond "beer goes with pizza" — a real guide.', $md$
Beer pairing follows the same principles as wine pairing: match intensity, complement or contrast, think regionally.

**Light beers (Pilsner, Helles, Witbier) pair with:**
- Salads, light fish, sushi, Thai food, chips & dip
- The crispness refreshes; the carbonation scrubs the palate

**Hoppy beers (IPA, Pale Ale) pair with:**
- Spicy food (Indian, Mexican, Thai) — hops cut through capsaicin
- Burgers, fried food, grilled chicken
- AVOID: delicate fish (hops overpower), chocolate (clashes)

**Malty beers (Amber, Märzen, Brown Ale) pair with:**
- Roasted meats, sausages, Thanksgiving turkey, root vegetables
- Caramel + malt = magic with roasted/caramelized flavors

**Dark beers (Stout, Porter) pair with:**
- Chocolate desserts, coffee cake, blue cheese
- Oysters + Guinness is a legendary pairing (the mineral/brine complements the roast)
- BBQ brisket + Imperial Stout

**Belgian ales pair with:**
- Mussels + frites (the national dish, the national beer)
- Soft cheeses (Brie, Camembert with Tripel)
- Fruit tarts (with Lambic/Kriek)

**Sour beers pair with:**
- Fried food (acid cuts grease)
- Goat cheese, salads
- Fruit desserts (fruited sour + berry tart)

**The one-line cheat sheet:** "Carbonation and bitterness in beer do the same job as acidity in wine — they cut richness and refresh the palate."

**Sell notes:** When someone buys a 6-pack and also mentions dinner: "What are you eating? That IPA would be amazing with the tacos."
$md$, 'beer', 'Beer', 10, 2, 4, true, true, null),

('Non-Alcoholic Beer & Beverages', 'The fastest-growing category in the store.', $md$
Non-alcoholic beer is no longer sad O'Doul's. The category has been completely reinvented.

**Why it's growing:** health-conscious millennials/Gen Z, Dry January participants, pregnant customers, sober-curious trend, designated drivers, people who just want something "beer-like" at dinner without alcohol. 30%+ of adults now drink NA beverages regularly.

**Top NA beer brands to stock:**
- **Athletic Brewing** — the market leader. Run Wild IPA, Free Wave Hazy, Upside Dawn Golden. Genuinely great beer that happens to be NA. Best-seller.
- **Heineken 0.0** — the mainstream name. Familiar, crisp, widely recognized.
- **Clausthaler** — German. One of the originals. Dry-hopped is solid.
- **Bravus** — craft NA brewery. Oatmeal Stout, IPA, Amber.
- **Partake** — ultra-low calorie (10-30 per can). IPA, Pale, Red.
- **Guinness 0** — launched 2020. Tastes remarkably close to Guinness Draught.

**NA spirits to know:**
- **Seedlip** — the pioneer. Garden 108 (herbal), Spice 94 (aromatic), Grove 42 (citrus). Makes NA G&Ts and cocktails.
- **Lyre's** — full range mimicking classic spirits. Italian Orange (Aperol sub), American Malt (bourbon sub), etc.
- **Monday** — NA gin, whiskey, mezcal.

**Sell notes:**
- NEVER judge a customer buying NA. "Great choice — Athletic's Hazy is excellent" is the right response.
- Stock NA beer in the main fridge, not hidden in a corner
- Suggest NA options proactively during Dry January (shelf talker: "Going dry? Try these.")
- Margin is good — NA beer retails at similar prices to craft beer but costs less to produce
$md$, 'beer', 'Beer', 11, 2, 4, true, true, null),

-- ============================================================================
-- SPIRITS — expanded (3 new)
-- ============================================================================

('Non-Alcoholic Spirits', 'Seedlip, Lyre''s, Monday — the "spirits" shelf for the sober-curious.', $md$
The non-alcoholic spirits category barely existed in 2018. By 2026 it's a $500M+ market.

**What they are:** distilled or macerated botanical waters that mimic the flavor profiles of gin, whiskey, tequila, aperitivos — without alcohol. Used to make "mocktails" that feel like real cocktails.

**The big three brands:**

**Seedlip** — the pioneer (founded 2015, UK).
- Garden 108: herbal, pea, hay. Sub for gin in G&Ts.
- Spice 94: allspice, cardamom, bark. Sub for whiskey in spirit-forward drinks.
- Grove 42: citrus, mandarin, lemongrass. Sub for vodka in citrus cocktails.
- $30-35/bottle. Premium positioning.

**Lyre's** — broadest range, most literal mimicry.
- Italian Orange (Aperol sub — for NA Spritzes)
- American Malt (bourbon sub)
- Dark Cane (dark rum sub)
- Dry London (gin sub)
- $25-35/bottle. Good for customers who want "this cocktail but without alcohol."

**Monday** — US-based, West Coast.
- Monday Gin, Monday Whiskey, Monday Mezcal.
- Clean, approachable, less "botanical-forward" than Seedlip.
- $25-30/bottle.

**How to sell:**
- Don't position as "you can't drink" → position as "you can still enjoy cocktails"
- Pair with premium mixers (Fever-Tree tonic, Q Ginger Beer)
- "Sober-curious" is the term — not "non-drinker"
- Stock near the cocktail mixers, not in a "health" section

**Gift idea:** Seedlip + Fever-Tree tonic gift set. Under $50, thoughtful, inclusive.
$md$, 'spirits', 'Spirits', 17, 2, 5, true, true, null),

('Ready-to-Drink (RTD) Guide', 'Canned cocktails, hard seltzers, and the convenience revolution.', $md$
RTDs are the fastest-growing alcohol category. Pre-mixed, single-serve, ready to open and drink.

**Categories:**

**Hard seltzer** — flavored sparkling water + alcohol (usually fermented cane sugar). 100 calories, 5% ABV.
- White Claw, Truly, High Noon (vodka-based), Topo Chico Hard Seltzer

**Canned cocktails (spirits-based)** — real liquor in a can. Higher quality, 7-12% ABV.
- **Cutwater** — margarita, whiskey sour, rum & cola. Best range.
- **Tip Top** — Old Fashioned, Negroni, Manhattan. Bartender-quality.
- **On The Rocks (OTR)** — Hornitos Margarita, Effen Cosmopolitan. Made with real spirits.
- **Crafthouse** — Paloma, Moscow Mule. Austin-based.

**Wine-based RTDs** — wine cocktails in cans. Spritzers, sangria, frosé.
- Bev, Archer Roose, Ramona

**Malt-based RTDs** — cheaper base (fermented malt, like beer).
- Four Loko, Smirnoff Ice, Mike's Hard. Not premium but high volume.

**What sells:**
- Variety packs outsell single-flavor — customers want to try several
- High Noon is the #1 spirits-based RTD (vodka + real juice + soda)
- Cutwater has the broadest range of classic cocktails in cans
- Tip Top is the "craft" pick — actual cocktail-bar quality

**Sell notes:**
- Pool party / beach: hard seltzer or High Noon variety pack
- Camping/tailgating: Cutwater Margarita or Paloma 4-packs
- Gift for someone who doesn't mix drinks: Tip Top Old Fashioned 4-pack ($20)
$md$, 'spirits', 'Spirits', 18, 2, 4, true, true, null),

('Agave Beyond Tequila', 'Mezcal, sotol, raicilla, bacanora — the wider agave world.', $md$
Tequila is one agave spirit. Mexico produces several others — each with a distinct identity.

**Mezcal** — any agave spirit from 9 designated Mexican states (mostly Oaxaca). Agave is pit-roasted, giving the signature smokiness. Must be 100% agave.
- **Espadín** — the workhorse agave (~90% of mezcal). Smoke, citrus, mineral.
- **Tobalá** — wild-harvested, floral, complex. $60+.
- **Producers:** Del Maguey (Vida for mixing, Chichicapa for sipping), Montelobos, Bozal, Ilegal, Los Vecinos, Banhez

**Raicilla** — from Jalisco (like tequila) but made from different agave varieties and with different production. Funky, fruity, tropical, less smoky than mezcal. Think of it as "wild Jalisco moonshine."
- Producers: La Venenosa, Estancia

**Sotol** — not technically agave — it's from the Dasylirion plant (desert spoon). From Chihuahua, Coahuila, Durango. Herbal, grassy, earthy, slightly minty.
- Producers: Sotol Por Siempre, Fabriquero

**Bacanora** — from Sonora state. Made from Agave Pacifica. Similar to mezcal but drier, mineral-driven.

**Sell notes:**
- Customer says "I want to try mezcal": Del Maguey Vida ($35) — the gateway. Smokiest of the common bottles, versatile in cocktails.
- Customer loves tequila and wants to explore: mezcal first, then raicilla
- Mezcal Margarita recipe: sub 1 oz mezcal for 1 oz tequila. Smoky twist.
- Gift: Del Maguey Chichicapa ($60) or any Tobalá
$md$, 'spirits', 'Spirits', 19, 2, 5, true, true, null),

-- ============================================================================
-- SALES & SERVICE (10 new) — category_group = 'sales_service'
-- ============================================================================

('Upselling Without Being Pushy', 'How to suggest a better bottle without making the customer uncomfortable.', $md$
Upselling isn't about pushing the most expensive bottle. It's about solving the customer's problem better.

**The natural upsell framework:**

**1. Listen first.** "What's the occasion?" reveals budget, formality, and taste better than any question about price.

**2. Offer one step up — not three.** Customer picks a $15 wine → suggest the $22 version, not the $50 one. "That's a solid choice. If you want a little more depth, this one from the same region is really nice for a few dollars more."

**3. Bundle, don't upgrade.** Instead of "buy the more expensive whiskey," try "that bourbon makes an incredible Old Fashioned — you'd just need Angostura bitters and some Luxardo cherries." Now they're buying 3 items instead of 1, and they're grateful for the suggestion.

**4. Use the "gift test."** "Is this for you or a gift?" Gift buyers spend more willingly because they're buying an impression, not just a drink. Gift = license to suggest nicer packaging, higher shelf, engraving.

**5. Validate their first choice.** Never say "oh you don't want THAT." Say "that's great — and if you want to try the next level up sometime, this is what I'd suggest."

**What NOT to do:**
- Don't push based on YOUR margin — push based on THEIR experience
- Don't upsell when they're clearly budget-shopping (read the room)
- Don't use price as a quality shorthand ("this $50 bottle is so much better than that $20 one")

**The metric:** a good upsell feels like advice, not a sales pitch. If the customer says "thanks, that's a great idea" — you did it right.
$md$, 'sales_service', 'Sales', 1, 2, 4, true, true, null),

('Reading the Customer', 'Four customer types and how to serve each one.', $md$
Every customer who walks in falls roughly into one of four types. Identifying them quickly lets you serve them better.

**1. The Browser** — no specific goal, just looking. Body language: wandering slowly, touching bottles, reading labels.
→ **Approach:** Give space. Don't pounce. After 2-3 minutes: "Finding everything okay? Let me know if anything catches your eye."

**2. The Mission Buyer** — knows exactly what they want. Body language: walks straight to a section, scanning quickly, checking their phone (probably a list).
→ **Approach:** Be quick and helpful. "Can I help you find something?" If they name a product, walk them to it. Don't try to upsell unless they ask.

**3. The Asker** — wants guidance. Body language: looking around, hesitating, sometimes holding two bottles comparing. Often says "I don't know much about wine/whiskey."
→ **Approach:** This is your opportunity to shine. Ask questions ("what's the occasion?"), listen, recommend. Be the expert they're hoping to find.

**4. The Enthusiast** — knows a lot, wants to talk. Body language: immediately picks up premium bottles, uses specific terms (terroir, single barrel, cuvée), asks about allocation.
→ **Approach:** Match their energy. Share your knowledge. They want a peer, not a salesperson. Show them something they haven't tried. This is where your training pays off.

**The key insight:** the Browser and Mission Buyer want to be LEFT ALONE (mostly). The Asker and Enthusiast want ENGAGEMENT. Mismatching the approach is the #1 service mistake in retail — pushing help on someone who wants space, or ignoring someone who wants guidance.

**Train your instinct:** within 10 seconds of a customer entering, decide which type they are. Adjust your approach. It becomes automatic with practice.
$md$, 'sales_service', 'Sales', 2, 2, 4, true, true, null),

('Gift Recommendations by Budget', 'The $25, $50, $75, and $100+ gift guide for every occasion.', $md$
Gift-buying is 20-30% of a liquor store's revenue during holidays. Staff who can make a fast, confident recommendation will close more sales.

**Under $25:**
- Prosecco (any decent Italian — $12-18)
- Jameson Irish Whiskey ($25)
- Aperol ($22) — suggest as a "Spritz kit" with a $8 Prosecco
- Nice wine in a gift bag (Malbec, Côtes du Rhône, under $20)

**$25-50:**
- Woodford Reserve bourbon ($35) — iconic bottle shape, universally respected
- Hendrick's Gin ($35) — distinctive bottle, great for gin lovers
- Veuve Clicquot Champagne ($55 but sometimes $48 on sale)
- Maker's Mark gift set with glasses ($40)

**$50-75:**
- Blanton's bourbon ($60 if in stock — the horse stopper cap is the gift)
- Glenmorangie 18 ($75) — beautiful Highland Scotch
- Patrón Añejo ($65) — impressive bottle, sippable tequila
- Dom Pérignon if on sale ($150 normally, sometimes $120)

**$75-100:**
- Johnnie Walker Blue Label ($200 normally — this is the "I want to impress" bottle)
- WhistlePig 10 Year Rye ($75) — the whiskey-lover's choice
- Veuve Clicquot La Grande Dame ($150)
- Rémy Martin XO ($175)

**Gift wrapping matters.** A $20 wine in a nice bag with tissue paper feels like a $40 gift. If your store offers gift bags, always suggest them.

**The fail-safe answer** when you're stuck: "Champagne is always appropriate." A $40-60 bottle of Champagne works for any adult, any occasion, any taste.
$md$, 'sales_service', 'Sales', 3, 2, 4, true, true, null),

('Holiday Season Playbook', 'Thanksgiving through New Year — your store''s biggest revenue month.', $md$
November-December represents 30-40% of annual revenue for most liquor stores. Preparation starts in October.

**Thanksgiving week (biggest single week):**
- Stock heavy: Pinot Noir (Oregon + Burgundy), Beaujolais Nouveau, Riesling, sparkling
- Table card / shelf talker: "Thanksgiving wines — our picks"
- Whiskey + bourbon for "Friendsgiving" cocktails
- Cranberry juice + vodka + sparkling = Thanksgiving punch ingredients

**December / Christmas / Hanukkah:**
- Gift sets and premium bottles dominate
- Champagne and sparkling outsell everything else by revenue
- Liqueur sales spike: Baileys, Grand Marnier, Amaretto
- Eggnog ingredients: bourbon/rum/brandy + dairy section in grocery
- Mulled wine kits (red wine + spices + oranges)

**New Year's Eve:**
- Champagne, Champagne, Champagne. Stock 3x your normal amount.
- Prosecco for budget-conscious customers
- Late-night run for "one more bottle" — stay open late if allowed

**January (Dry January):**
- Non-alcoholic beer and spirits (Athletic Brewing, Seedlip, Lyre's)
- Pivot messaging: "Taking a break? Try these."
- Don't panic — your best customers come back in February

**Staff prep checklist:**
- Extra shifts scheduled for Wed before Thanksgiving + Dec 23-24
- Gift bags/tissue paper fully stocked by Nov 1
- Premium/allocated bottles reserved for best customers
- Holiday playlist, clean store, festive (not excessive) decorations

**The golden rule:** customers shopping for gifts are in a GOOD mood. They want help, they're open to suggestions, and they'll spend more than they planned if you guide them right.
$md$, 'sales_service', 'Sales', 4, 2, 5, true, true, null),

('Wine Club & Loyalty Programs', 'Building repeat visits through membership and loyalty.', $md$
A customer who visits once a month at $30/visit = $360/year. A wine club member might spend $60-100/month = $720-1,200/year. Loyalty programs turn one-time browsers into regulars.

**Wine club models:**
- **Monthly subscription box**: curated 2-3 bottles at a set price ($50-75). Staff selects wines. Members get first access to new arrivals.
- **Points/punch card**: buy 12 bottles, get 1 free (or 10% off all purchases over a threshold).
- **Tiered membership**: bronze/silver/gold based on annual spend. Higher tiers get better prices, exclusive access, invitations to tastings.

**What works for small liquor stores:**
- Keep it simple. A laminated punch card (buy 12, get 1 free) costs nothing to run and drives repeat visits.
- Monthly email: "Staff picks of the month" with tasting notes. Free to send, builds authority.
- First-access text alerts for allocated/limited bottles (Pappy, Blanton's, limited Scotch). Your best customers WANT to know.

**Tasting events:**
- Monthly in-store tasting (Thursday/Friday evening). 4-5 wines, 1 oz pours. Cost: $20-30 in opened bottles. Revenue generated: $200-500 in immediate sales, plus long-term loyalty.
- Partner with local restaurants or food trucks for pairing events.

**The data play (with BevTek):** Megan tracks what each customer buys, what they ask about, what modules staff complete. Over time, this data drives personalized recommendations.

**Sell notes:** Loyalty isn't about discounts — it's about relationships. A customer who feels known ("Hey Mike, we just got that Barolo you liked last month") comes back forever.
$md$, 'sales_service', 'Sales', 5, 2, 4, true, true, null),

('Handling Difficult Customers', 'De-escalation, ID checks, intoxicated refusals, and problem-solving.', $md$
Every retail job has difficult moments. Here's how to handle the ones specific to liquor retail.

**Refusing service to intoxicated customers:**
- You are LEGALLY REQUIRED to refuse sale to visibly intoxicated people in most states.
- Be calm, direct, not judgmental: "I can't sell alcohol to you right now. I'd be happy to help you with anything else, or you're welcome to come back another time."
- Don't negotiate. Don't apologize excessively. State the refusal once and hold.
- If they escalate: call your manager. If threatening: call police. Safety first.

**ID verification:**
- Check everyone who looks under 40 (not just 21). This protects YOU legally.
- Expired IDs: technically invalid in most states. If expired less than a month, use judgment. If expired a year, refuse.
- Vertical IDs (under-21 format): legal to accept once the person is over 21, but double-check the date.
- No ID? No sale. Period. "I'm sorry, I need valid ID to sell alcohol. That's store policy."

**The angry customer (general):**
1. Listen. Let them vent for 30 seconds.
2. Acknowledge: "I understand that's frustrating."
3. Solve: "Here's what I can do for you."
4. Don't take it personally. It's almost never about you.

**Price complaints:**
"This is cheaper at [competitor]" → "I understand — our prices reflect [selection/service/convenience]. But I'm happy to help you find something in your budget."

**Returns:** Most liquor stores have limited return policies (unopened, with receipt). Check your store's policy. If in doubt, ask a manager.

**The mantra:** be professional, be safe, be human.
$md$, 'sales_service', 'Sales', 6, 2, 4, true, true, null),

('Merchandising & Shelf Placement', 'Where a bottle sits determines whether it sells.', $md$
In retail, placement = sales. Products at eye level sell 30-40% more than bottom shelf. Your shelf strategy directly impacts revenue.

**Eye level = buy level:**
- Products at 4-5 feet (eye level for average adult) sell the most.
- Premium/higher-margin bottles go at eye level. Budget brands go bottom shelf.
- New arrivals or seasonal picks get end-cap or counter displays.

**The "V" pattern:** customers' eyes naturally scan shelves in a V shape — starting upper-left, dipping to center, then upper-right. Place best sellers in this natural scan path.

**Cross-merchandising:**
- Bitters + simple syrup + Luxardo cherries near the bourbon section
- Tonic water near the gin
- Margarita salt + limes near the tequila
- Gift bags + ribbon near the Champagne during holidays

**Signage that works:**
- "Staff Pick" cards with a one-line tasting note (handwritten feels authentic)
- "Pairs with: steak / seafood / cheese" cards
- Price per bottle clearly visible (customers won't ask — they'll just leave)
- QR code to the store's Megan Shopper page for more info

**Common mistakes:**
- Cluttered shelves with too many facings of the same product
- Not restocking — empty shelf space looks abandoned
- Hiding sale items in the back (they should be up front)
- Warm storage near the window — move temperature-sensitive wine away from sunlight

**Sell notes:** Walk your store like a customer once a week. What grabs your eye? What's confusing? Where do people hesitate? Fix one thing each walk-through.
$md$, 'sales_service', 'Sales', 7, 2, 4, true, true, null),

('Inventory Basics for Staff', 'Receiving, rotating, counting — the backend that keeps the floor running.', $md$
Inventory isn't glamorous but it's what keeps the store profitable. Every staff member should understand the basics.

**Receiving deliveries:**
1. Check the delivery against the purchase order (PO). Count boxes. Check for damage.
2. Note shortages or wrong items BEFORE the driver leaves. Sign the delivery receipt with notes.
3. Date-stamp cases (use a marker or sticker — "received [date]").
4. Move product to the floor or back stock promptly. Don't leave pallets in the way.

**FIFO — First In, First Out:**
The single most important inventory rule. Older stock goes to the front, new stock goes behind. This prevents:
- Expired beer (IPAs lose hop character fast)
- Dusty bottles that customers perceive as "old"
- Damage from prolonged shelf time

**Counting and cycle counts:**
- Full inventory: typically quarterly or annually. Every SKU counted.
- Cycle counts: count one section per week (e.g., all bourbon this week, all wine next week). Catches shrinkage faster.
- Shrinkage = theft + breakage + counting errors. Industry average: 2-3% of sales.

**Breakage and damage:**
- Report immediately (don't hide it — better a written-off bottle than an unaccounted mystery)
- Glass cleanup: sweep, then wet-mop. Tiny shards hide in crevices.
- Damaged labels: some distributors accept returns for damaged goods

**What BevTek does:** Megan tracks your digital inventory in real time from the POS import. When staff uses the Assistant to answer a customer question ("do we have Lagavulin?"), the answer comes from the latest inventory data. Keeping that data accurate = better customer experience.
$md$, 'sales_service', 'Sales', 8, 2, 4, true, true, null),

('Legal: Age Verification & Compliance', 'State law basics every employee must know.', $md$
Selling alcohol to minors is a criminal offense in every US state. The liability falls on BOTH the employee and the store. Know the law.

**Universal rules (all states):**
- Must be 21 to purchase alcohol in the US. No exceptions.
- Acceptable ID: state driver's license, state ID card, US passport, US military ID. Nothing else is required to be accepted (though some states allow additional forms).
- Expired ID = not valid in most jurisdictions. Refuse politely.
- No ID = no sale. No exceptions. "Store policy" is your shield.

**When to check ID:**
- If they look under 40 (company best practice, not just legal minimum)
- If you have ANY doubt
- If they're buying for a group and you suspect someone in the group is under 21

**Straw purchases / third-party sales:**
- If you see an adult buying for a minor (passes the bag, minor is waiting outside, etc.), you can and should refuse the sale.
- If you're unsure: "I can't complete this sale if I believe the alcohol may be provided to someone under 21."

**Sting operations:**
- ABC (Alcohol Beverage Control) agents send minors into stores to test compliance.
- The minor presents a REAL under-21 ID (vertical format with under-21 birth date). If you don't check, or sell anyway, you're cited.
- Consequences: fines ($500-$10,000), license suspension, termination, personal criminal charge.

**Your personal liability:** in many states, the INDIVIDUAL employee who made the sale can be fined, lose their ability to work in alcohol retail, or face misdemeanor charges. This isn't just the store's problem.

**The answer to "but I forgot my ID":** "I'm sorry, I legally can't sell without valid ID. You're welcome to come back with it." Smile. Be firm. You're protecting yourself.
$md$, 'sales_service', 'Sales', 9, 2, 4, true, true, null),

('Store Safety & Loss Prevention', 'Protecting yourself, your team, and the inventory.', $md$
Liquor stores are high-value retail targets. Safety comes first — always.

**Theft prevention:**
- Greet every customer who walks in. Eye contact + "Welcome!" is the #1 deterrent. Thieves don't want to be remembered.
- Keep the store well-lit. Dark corners invite concealment.
- High-value items (Pappy, Blue Label, allocated bottles) behind the counter or in a locked case.
- Cameras visible. Signage: "Smile, you're on camera."
- If you see shoplifting: do NOT physically confront. Note the description, call your manager, call police if needed. Your safety > any bottle.

**Robbery protocol:**
- Comply. Give them what they want. Money and inventory are replaceable. You are not.
- Don't be a hero. Don't chase. Don't argue.
- After: lock the door, call 911, preserve the scene, write down everything you remember.
- Trauma is normal afterward. Talk to your manager about support resources.

**Cash handling:**
- Regular drops to the safe (never let the register exceed $200-300)
- Count back change to the customer
- Two people for end-of-day close and counting
- Never discuss cash amounts in front of customers

**Slip and fall prevention:**
- Clean spills immediately (broken bottles, condensation from coolers)
- "Wet floor" signs always
- Stock rooms: nothing blocking exits, heavy items on lower shelves

**Emergency exits:** know where they are. Practice the route mentally. In an emergency, get out and call for help.

**The bottom line:** your job is to be observant, follow protocol, and go home safe. Everything else can be replaced or restocked.
$md$, 'sales_service', 'Sales', 10, 2, 4, true, true, null)

on conflict (title) where is_seed = true do nothing;
