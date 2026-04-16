-- Megan Trainer seed — 44 bite-sized beverage education modules.
-- Each module: title, 150-250 word content, category_group, position.
-- Each module also gets 2 quiz questions (next migration).
--
-- Idempotent-ish: uses ON CONFLICT DO NOTHING on (title, is_seed, store_id)
-- so re-running won't duplicate.

-- Ensure we can upsert by title for seed modules.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where indexname = 'modules_seed_title_uq'
  ) then
    create unique index modules_seed_title_uq
      on public.modules (title)
      where is_seed = true;
  end if;
end $$;

-- ============================================================================
-- WINE — FRANCE (6)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('Bordeaux Reds', 'Left Bank vs. Right Bank — Cabernet Sauvignon vs. Merlot, and how to tell which is which.', $md$
Bordeaux is France's most famous wine region and the benchmark for age-worthy red blends. Two sides of the Gironde river, two very different wines.

**Left Bank** (Médoc, Pauillac, Margaux, Saint-Julien): **Cabernet Sauvignon** dominates. Gravelly soils. Structured tannins. Bold, dark fruit, cedar, tobacco. Classic pairing: ribeye, lamb.

**Right Bank** (Saint-Émilion, Pomerol): **Merlot** dominates. Clay soils. Softer, rounder, plum and cocoa. Pairs with duck, mushroom dishes, pork.

**The classification you'll see on labels:**
- Grand Cru Classé — top tier
- Cru Bourgeois — quality mid-tier, often excellent value
- AOC Bordeaux — entry level

**Sell notes for customers:**
- Customer wants a gift: look for Saint-Julien or Margaux around $40–60 — reliable prestige
- Customer wants a steak wine: always Left Bank, Cabernet-dominant
- Customer wants something approachable now: Right Bank Merlot blend, drinks well younger
- "First growth" (Premier Cru) means Lafite, Latour, Margaux, Haut-Brion, Mouton — we rarely carry these unless a customer special-orders

Vintage matters in Bordeaux. Warm years (2015, 2016, 2018, 2020) are generally great across the region. Ask a manager before recommending older vintages ($100+).
$md$, 'wine_france', 1, 2, true, true, null),

('Burgundy — Pinot Noir', 'The most expensive grape on Earth, explained simply.', $md$
Burgundy's red wines are 100% Pinot Noir — no blends, no exceptions. This is a grape obsessed with terroir (the specific plot of land), which is why a bottle from one hill can cost 10× the bottle from the next hill over.

**Key regions, north to south:**
- **Côte de Nuits** — the heavy hitters. Gevrey-Chambertin, Vosne-Romanée, Nuits-Saint-Georges. Dark cherry, earth, structured.
- **Côte de Beaune** — slightly softer, more finesse. Pommard, Volnay, Beaune.

**The quality pyramid** (from bottom to top):
1. Bourgogne Rouge (regional)
2. Village (e.g. "Gevrey-Chambertin")
3. Premier Cru (1er Cru) — specific vineyard
4. Grand Cru — the top ~2% of vineyards

**Sell notes:**
- Customer new to Pinot Noir: start with village-level Beaune or Mercurey ($25–40)
- Customer loves Pinot but wants something different: try Gevrey-Chambertin — darker, muscular
- Customer wants romance-dinner wine: Volnay — elegant, silky
- DO NOT recommend Grand Cru to someone on a tight budget — they start around $200 and only make sense to collectors

Serve slightly cooler than room temp (58–62°F). Decant older vintages (10+ years) for 20 minutes before pouring.
$md$, 'wine_france', 2, 2, true, true, null),

('French Chardonnay', 'Chablis, Meursault, Pouilly-Fuissé — same grape, different universes.', $md$
All white Burgundy (with rare exception) is Chardonnay. But the style ranges from laser-crisp to golden and buttery based on where it's grown and how it's made.

**Three styles to know:**

**1. Chablis** (northern Burgundy) — unoaked, steel fermentation, flinty, salty, high acid. Classic oyster wine. Price: $20–50.

**2. Côte de Beaune whites** — Meursault, Puligny-Montrachet, Chassagne-Montrachet. Oak-aged. Rich, creamy, hazelnut, lemon curd. The gold standard for "buttery Chardonnay." Price: $50–200+.

**3. Mâconnais** — Pouilly-Fuissé, Saint-Véran, Mâcon-Villages. Entry to mid-range. Fruit-forward, light oak, versatile. Price: $18–40.

**Sell notes:**
- Customer wants California Chardonnay style but French: Meursault or Saint-Aubin
- Customer wants crisp unoaked white: Chablis, every time
- Customer on a budget: Mâcon-Villages — tastes above its price
- Customer wants a food-friendly dinner white: Puligny or Chassagne — handles butter, cream, fish, poultry

Always check: is it oaked or not? That's the single biggest flavor divide in French Chardonnay.
$md$, 'wine_france', 3, 2, true, true, null),

('Champagne & Sparkling', 'The difference between Champagne, Cava, Prosecco, and Crémant — in 2 minutes.', $md$
Only sparkling wine from the Champagne region of France can be called Champagne. Everything else is a sparkling wine. The bubbles matter less than what method makes them.

**Champagne** — traditional method (champenoise). Second fermentation in the bottle. Fine, persistent bubbles. Grapes: Chardonnay, Pinot Noir, Pinot Meunier. Price: $40–500+.

**Prosecco** — Italian (Veneto). Tank method (Charmat). Big, frothy bubbles. Grape: Glera. Lighter, fruitier, apple and pear. Price: $12–30.

**Cava** — Spanish. Traditional method (like Champagne). Grape: Macabeo, Parellada, Xarel-lo. Great value alternative to Champagne. Price: $12–25.

**Crémant** — French sparkling from outside Champagne (Loire, Alsace, Bourgogne). Traditional method, Champagne-like but cheaper. Price: $18–35.

**Styles on Champagne labels:**
- Brut — dry (standard)
- Extra Brut — very dry
- Brut Nature / Zero Dosage — bone dry
- Extra Dry — off-dry (ironically sweeter than Brut)
- Demi-Sec — noticeably sweet

**Sell notes:**
- Wedding/celebration, wants real Champagne: Veuve Clicquot, Moët, Taittinger — $45–60
- Brunch, mimosas: Prosecco every time (don't waste Champagne)
- Champagne taste, Prosecco budget: Cava
- Cocktail base: Prosecco or Cava — Champagne is too delicate
$md$, 'wine_france', 4, 2, true, true, null),

('Rhône Valley', 'Syrah, Grenache, and the big reds of southern France.', $md$
The Rhône splits into two halves with very different personalities.

**Northern Rhône** — all reds are 100% Syrah. Appellations: Côte-Rôtie, Hermitage, Saint-Joseph, Cornas, Crozes-Hermitage. Style: black pepper, smoked meat, violets, firm tannin. Age-worthy.

**Southern Rhône** — Grenache-dominant blends (GSM: Grenache, Syrah, Mourvèdre). Appellations: Châteauneuf-du-Pape, Gigondas, Vacqueyras, Côtes du Rhône Villages. Style: warm, spicy, red fruit, garrigue (Provençal herbs), often 14–15% ABV.

**Sell notes:**
- Customer loves bold Australian Shiraz: try Côte-Rôtie or Crozes-Hermitage — same grape, more elegance
- Customer wants a Châteauneuf — always ask price range. Great ones start at $40, top châteaux go past $100
- Customer wants great-value daily red: Côtes du Rhône Villages or Gigondas ($18–30)
- Pairs with grilled meats, lamb, game, spicy food, aged cheese

**Châteauneuf-du-Pape note:** up to 13 grape varieties allowed in the blend, though Grenache dominates. Look for "Cuvée Vieilles Vignes" (old vines) for the top examples.
$md$, 'wine_france', 5, 2, true, true, null),

('Sancerre & Loire', 'France''s Sauvignon Blanc country — plus Chenin Blanc and Cabernet Franc.', $md$
The Loire Valley runs west-east across northern France and makes some of the most food-friendly wines in the country.

**Sancerre** — 100% Sauvignon Blanc. Crisp, mineral, citrus, gooseberry, cut grass. Chalky finish. Think New Zealand Sauv Blanc with more restraint. Price: $25–50. Classic goat-cheese wine.

**Pouilly-Fumé** — across the river from Sancerre, also Sauvignon Blanc. Smokier (the "fumé" = smoky) due to flinty soils. Similar price. Slightly richer than Sancerre.

**Vouvray** — 100% Chenin Blanc. Comes dry (sec), off-dry (demi-sec), or sweet (moelleux). Apple, honey, wet-wool note that Chenin lovers adore. Ages beautifully.

**Chinon, Bourgueil** — 100% Cabernet Franc reds. Pencil shavings, red bell pepper, cranberry. Light and food-friendly, rarely over 13% ABV.

**Muscadet** (at the coast) — 100% Melon de Bourgogne. The classic French oyster wine. Under $20. Pairs with every shellfish on the menu.

**Sell notes:**
- Goat cheese, salads, seafood: Sancerre
- Thanksgiving: Cabernet Franc from Chinon — pairs with turkey, cranberry, stuffing all at once
- Customer says "I don't usually like white wine": try off-dry Vouvray demi-sec
- Budget-friendly crowd-pleaser seafood wine: Muscadet, always
$md$, 'wine_france', 6, 2, true, true, null);

-- ============================================================================
-- WINE — USA (6)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('Napa Cabernet', 'America''s most prestigious red — what to sell at $40, $80, and $200.', $md$
Napa Cabernet Sauvignon is the signature American luxury wine. Warm days, cool nights, volcanic and alluvial soils — a perfect recipe for Cabernet.

**Price tiers you'll see:**
- **$25–50** — entry-level Napa. Still a great bottle. Brands: Louis Martini, Franciscan, Rodney Strong.
- **$50–100** — mid-range. Silverado, Cakebread, Stag's Leap Artemis, Frank Family.
- **$100–250** — prestige. Caymus Special Select, Heitz Martha's Vineyard, Shafer Hillside Select.
- **$250+** — cult status. Screaming Eagle, Harlan, Opus One. Pre-order only.

**Sub-regions to know:**
- **Oakville, Rutherford** — heart of Napa, classic dusty tannins ("Rutherford dust")
- **Howell Mountain, Pritchard Hill** — mountain Cabs, bigger structure, darker fruit
- **Stag's Leap District** — elegant, silky, violets
- **Calistoga** — warmer, riper, bolder
- **Coombsville** — cooler, more restraint, newer in popularity

**Sell notes:**
- Big steakhouse crowd, no specific preference: Silver Oak, Caymus — safe bets
- Collector asking about aging: mountain Cabs age 15–25 years
- Customer wants "fruit bomb Napa Cab": look for 15% ABV+, Calistoga or Howell Mountain
- Customer prefers structured/Bordeaux-style: Stag's Leap or Oakville benchland

All Napa Cabs drink better with 1–2 hours of decanting, especially under 10 years old.
$md$, 'wine_usa', 1, 2, true, true, null),

('California Chardonnay', 'Oak, malolactic, and the big-butter style America invented.', $md$
California redefined Chardonnay in the 1980s — ripe fruit, heavy oak, buttery from malolactic fermentation ("ML"). The style has since split into two camps.

**Classic buttery style** (Napa, Sonoma Valley floor): Rombauer, Cakebread, La Crema, Far Niente, ZD. Tropical fruit, vanilla, butterscotch, full body. The "ABC" (Anything But Chardonnay) crowd reacts against this style.

**Modern restrained style** (Sonoma Coast, Russian River, Santa Rita Hills): Kistler, Ramey, Hanzell, Sandhi. Less oak, more acid, apple/lemon, minerality. Drinks closer to white Burgundy.

**Key flavor drivers:**
- **Oak** — French oak = vanilla, coconut; American oak = dill, sawdust
- **Malolactic fermentation** — converts sharp malic acid (green apple) to soft lactic acid (cream, butter)
- **Lees aging** — sur lie = bready, richer
- **Cold ferment / stainless steel** — preserves crisp fruit

**Sell notes:**
- Classic Chardonnay drinker: Rombauer, Cakebread, La Crema
- Customer says "I hate buttery Chardonnay": Kistler, Hanzell, Sandhi
- Thanksgiving showpiece: Far Niente or Patz & Hall
- Budget pick that punches above weight: La Crema Sonoma Coast ($22)

Always ask "do you like oaky or crisp?" before recommending.
$md$, 'wine_usa', 2, 2, true, true, null),

('Oregon Pinot Noir', 'Willamette Valley — America''s Burgundy.', $md$
Oregon's Willamette Valley makes some of the finest Pinot Noir outside of France. Cooler climate than California, more red fruit and earth, less jamminess.

**Sub-AVAs to know** (all within the Willamette):
- **Dundee Hills** — classic red volcanic (Jory) soils. Red cherry, rose, elegance. The benchmark.
- **Yamhill-Carlton** — sedimentary soils. Darker fruit, more structure.
- **Eola-Amity Hills** — windy, cooler. High acid, spicy.
- **Ribbon Ridge** — small, dense, marine-sedimentary. Concentrated.
- **Chehalem Mountains** — blend of soils, versatile.

**Producers to know:**
- Entry ($20–35): Elouan, A to Z, Erath
- Mid ($35–65): Ponzi, Sokol Blosser, Domaine Drouhin, Adelsheim
- Top ($65–200): Beaux Frères, Domaine Serene, Evening Land, Bergström

**Sell notes:**
- Customer wants Burgundy character at Napa prices (sort of): Oregon Pinot, always
- First-time Pinot drinker: Elouan or A to Z — approachable, fruit-forward
- Serious Pinot fan: Domaine Drouhin or Beaux Frères
- Salmon dinner: OR Pinot is the classic pairing (it's the state fish)

Vintages: 2014, 2015, 2019, 2021 are all very good. Serve at 60°F, decant if under 5 years old.
$md$, 'wine_usa', 3, 2, true, true, null),

('Washington Reds', 'Walla Walla, Columbia Valley — big Cabs, killer values.', $md$
Washington state is the second-largest US wine producer. Cold winters, hot summers, low rainfall — ideal for structured reds. Prices are generally lower than Napa for comparable quality.

**Key regions:**
- **Columbia Valley** — the biggest AVA, covers most of eastern Washington
- **Walla Walla** — small, prestigious sub-region. Home to Leonetti, Cayuse, Quilceda Creek.
- **Red Mountain** — hot, southeast-facing. The biggest, most structured Cabs in the state.
- **Horse Heaven Hills** — wind-cooled, balanced.

**Grapes:**
- **Cabernet Sauvignon** — flagship. More red fruit than Napa, firmer acid, herbal note.
- **Merlot** — underrated here. Long Shadows, Duckhorn's Canvasback, L'Ecole No. 41.
- **Syrah** — stunning in Walla Walla. Cayuse, Reynvaan, Gramercy Cellars.
- **Bordeaux blends** — Col Solare, Quilceda Creek, DeLille

**Sell notes:**
- Customer loves Napa Cab but wants to save $: Columbia Crest Reserve, Chateau Ste Michelle Indian Wells, Waterbrook
- Customer wants "hidden gem" Cab: Quilceda Creek (if you have it), Leonetti, K Vintners
- Syrah lover: any Walla Walla producer — world-class

Every Washington Cab needs 30+ minutes of decanting.
$md$, 'wine_usa', 4, 2, true, true, null),

('Sonoma Whites', 'Beyond Chardonnay — Sauvignon Blanc, Viognier, and Pinot Gris.', $md$
Sonoma County is famous for Pinot and Chard but makes excellent "other" whites too.

**Sauvignon Blanc** — Sonoma County, especially Russian River and Dry Creek. Style sits between zippy New Zealand and soft French Graves. Grapefruit, melon, herbs. Producers: Honig, Murphy-Goode, Ferrari-Carano Fumé Blanc, Duckhorn.

**Pinot Gris** — light, pear, slight almond. Versatile food wine. Producers: J Vineyards, La Crema, Scharffenberger.

**Viognier** — aromatic, honeysuckle, apricot, tropical. Small plantings but worth knowing. Producers: Cline, Tablas Creek (Paso Robles, related style).

**Roussanne / Marsanne / Grenache Blanc** — Rhône-style whites, mostly from Paso Robles but spreading. Tablas Creek, Bonny Doon.

**Sell notes:**
- Customer wants a summer sipper: Honig Sauv Blanc or Ferrari-Carano Fumé Blanc ($18–22)
- Customer wants aromatic but not sweet: Viognier — ask if they've tried it
- Customer wants Pinot Grigio alternative: CA Pinot Gris has more body than Italian
- Apéritif crowd-pleaser: Chenin Blanc from Dry Creek (if you stock it)

Serve all Sonoma whites at ~45–50°F (out of the fridge for 10 minutes). Too cold kills the aromatics.
$md$, 'wine_usa', 5, 2, true, true, null),

('California Rosé', 'Provence-style, White Zin, and everything in between.', $md$
Rosé is not one style — it's a category covering everything from bone-dry Provence-style to candy-sweet White Zinfandel.

**Dry, pale, Provence-style** (the "grown-up" rosé): Whispering Angel (French but the template), Sofia Rosé (Coppola), La Jolie Fleur, Miraval (French), Fleur de Mer (French). Think strawberry, watermelon, mineral, dry finish. 12–13% ABV.

**Fruit-forward New World rosé**: Underwood, Charles & Charles, Belle Glos Oeil de Perdrix. Fuller body, riper fruit, can be dry or off-dry.

**Off-dry pink zin style**: Beringer White Zinfandel, Sutter Home White Zin. Sweet, low ABV, huge mainstream audience. Don't look down on it — it's someone's favorite.

**Rosé of Pinot Noir** specifically: delicate, pale, elegant. From Oregon and California. More expensive generally.

**Sell notes:**
- Customer says "I want a dry rosé for the pool": Whispering Angel, Sofia, Fleur de Mer
- Customer says "I want a white zin": Sutter Home — no judgment, they know what they like
- Customer is gifting: Miraval (the Brangelina one) has brand cachet
- Thanksgiving wine for mixed-palate crowd: Belle Glos Rosé — everyone's happy

Rosé is best drunk in its first 1–2 years. Don't sell last year's stock if you have fresh.
$md$, 'wine_usa', 6, 2, true, true, null);

-- ============================================================================
-- WINE — WORLD (4)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('Australian Shiraz', 'Barossa and McLaren Vale — big, inky, unforgettable.', $md$
Shiraz (same grape as Syrah) is Australia's signature wine. New World styling — ripe, dense, oaky, often 14.5–15.5% ABV.

**Key regions:**
- **Barossa Valley** — the benchmark. Warm, rich, plum, blackberry, chocolate, leather. Penfolds Grange country.
- **McLaren Vale** — coastal, slightly fresher. D'Arenberg, Mollydooker.
- **Hunter Valley** — elegant, earthier, lower-alcohol Shiraz. Tyrrell's, Brokenwood.
- **Clare / Eden Valley** — cooler, peppery, more like Northern Rhône.

**Producers by price:**
- Entry ($12–20): Yellow Tail, Jacob's Creek, Lindeman's
- Quality everyday ($20–35): Peter Lehmann, Wolf Blass, Tyrrell's, Two Hands
- Top tier ($50–200+): Penfolds Bin 389 / RWT / Grange, Henschke Hill of Grace, D'Arenberg Dead Arm

**Sell notes:**
- Customer wants a "big red": Barossa Shiraz, every time
- Customer wants to try real Australian Shiraz for $30: Two Hands "Gnarly Dudes" or Peter Lehmann "Stonewell"
- Customer is new to Shiraz: start McLaren Vale — slightly more balanced
- Pairs with BBQ, grilled meats, aged cheese, dark chocolate

Australian "GSM" (Grenache-Syrah-Mourvèdre) blends are great values too — think Rhône-style from McLaren Vale.
$md$, 'wine_world', 1, 2, true, true, null),

('Argentine Malbec', 'Mendoza — how altitude changes everything.', $md$
Argentina is the world's 5th-largest wine producer, and Malbec is its calling card. Originally a Bordeaux blending grape, Malbec found its true home in high-altitude Mendoza.

**Altitude matters:**
- **Lower elevation (2,000–3,000 ft)** — plush, dark fruit, soft tannins. Approachable. Most sub-$20 Malbec.
- **Higher elevation (3,000–5,000 ft)** — Luján de Cuyo, Uco Valley. More acid, more structure, violet and blueberry. $25+.
- **Very high (5,000+ ft)** — Gualtallary, the Andes Mountains. Intense, mineral, cool-climate expressions.

**Producers:**
- Entry ($10–18): Alamos, Catena, Trapiche, Trivento
- Quality mid-range ($18–40): Catena Zapata Alta, Achaval-Ferrer, Susana Balbo, Zuccardi
- Icon ($60–200): Catena Zapata Adrianna, Cheval des Andes, Bodega Aleanna "Gran Enemigo"

**Sell notes:**
- Customer wants affordable everyday red: Alamos or Trapiche Reserve — $10–14 that drinks like $20
- Customer wants something memorable under $30: Catena Zapata "High Mountain Vines"
- Steakhouse classic: Argentine Malbec with Argentine beef — unbeatable combo
- Customer who loves Napa Cab but wants value: Uco Valley Malbec

Drink young (under 5 years) — Malbec is not meant for long aging except at the top end.
$md$, 'wine_world', 2, 2, true, true, null),

('Barolo — Italy', 'Nebbiolo, fog, and the "wine of kings".', $md$
Barolo is made from 100% Nebbiolo in the Langhe hills of Piedmont, Italy. Known as the "wine of kings, king of wines." Old-school tradition: long maceration, long oak aging, meant to age 10–30 years.

**Style:** pale garnet (color of old Pinot Noir), but massive structure. Rose, tar, cherry, licorice, leather, truffle. High acid, high tannin, 14.5%+ ABV. Never a cheap crowd-pleaser — this is an acquired-taste wine.

**Key sub-regions (Barolo villages):**
- **La Morra** — softer, perfumed, earlier-drinking. Think elegance.
- **Barolo** — balanced, classic.
- **Castiglione Falletto** — aromatic, structured, small.
- **Serralunga d'Alba** — the most tannic, longest-aging.
- **Monforte d'Alba** — muscular, dark.

**Traditional vs. Modernist producers:**
- **Traditional** — long aging in large old botti (Slavic oak). Giacomo Conterno, Bartolo Mascarello, Giuseppe Rinaldi. Austere, needs decades.
- **Modern** — shorter maceration, smaller French barriques. Elio Altare, Paolo Scavino, Luciano Sandrone. More approachable young.

**Barbaresco** — same grape (Nebbiolo), neighboring region. Slightly lighter, slightly earlier to drink. Produttori del Barbaresco is a legendary coop.

**Sell notes:**
- Customer wants a special-occasion Italian red: Barolo is the answer, $50–100 range
- Customer is impatient / wants to drink it now: Barbaresco, or any La Morra Barolo
- Customer pairs with truffles, mushroom risotto, braised short ribs, game
- Decant 1–2 hours for young Barolo. Older bottles: gentle, no decant, upright for a day first.

If customer says Barolo is "too harsh," suggest Langhe Nebbiolo — same grape, easier style.
$md$, 'wine_world', 3, 2, true, true, null),

('Spanish Rioja', 'Tempranillo, American oak, and the aging hierarchy.', $md$
Rioja is Spain's most famous red wine region. The grape is Tempranillo (mostly), with some Garnacha (Grenache), Graciano, and Mazuelo (Carignan) blended in.

**The aging tiers — printed right on the label:**
- **Joven / Cosechero** — no oak, young. Fruity, simple.
- **Crianza** — 1 year oak + 1 year bottle. Entry serious Rioja. $12–20.
- **Reserva** — 1 year oak + 2 years bottle. Mid-range. $18–35.
- **Gran Reserva** — 2 years oak + 3 years bottle. Only made in top vintages. $30–120+.

**American oak vs. French oak:**
- Traditional Rioja uses American oak — gives dill, coconut, sweet vanilla
- Modern Rioja increasingly uses French oak — subtler, more spice
- Classic producers still use American: La Rioja Alta, López de Heredia, CVNE
- Modern producers: Contino, Remírez de Ganuza

**Sell notes:**
- Customer new to Rioja, modest budget: Muga Reserva or La Rioja Alta 904 ($25–40)
- Customer wants benchmark old-school Rioja: López de Heredia "Viña Tondonia" — some of the only wine with 10+ years of age at release at any price
- Customer wants modern Rioja: Allende, Artadi, Sierra Cantabria
- Pair with lamb, chorizo, manchego, paella

Gran Reserva Riojas can show dried fruit and leather at release — this is intentional, not a flaw.

**Ribera del Duero note:** Also mostly Tempranillo but bolder, more Bordeaux-like. Vega Sicilia and Pingus are the icons. Don't confuse with Rioja.
$md$, 'wine_world', 4, 2, true, true, null);

-- ============================================================================
-- SPIRITS (12)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('Bourbon 101', 'What makes bourbon bourbon — and the 5 bottles every store owner should know.', $md$
**Bourbon by law (USA):**
1. Mash bill at least 51% corn
2. Aged in new charred oak barrels (not reused)
3. Distilled to no more than 160 proof
4. Barreled at no more than 125 proof
5. Bottled at 80 proof or higher
6. No additives except water

Not required: must be from Kentucky. (95%+ is from Kentucky, but Texas, NY, and Colorado make bourbon too.)

**"Straight bourbon"** = aged at least 2 years. **"Bottled in Bond"** = aged 4+ years, distilled in one season by one distiller at one distillery, bottled at exactly 100 proof.

**5 must-know bottles:**
1. **Buffalo Trace** ($25) — the house bourbon. Corn-forward, vanilla, caramel. Safe recommendation for anyone.
2. **Maker's Mark** ($25) — wheat (not rye) as the second grain. Softer, rounder. Great for whiskey-curious customers.
3. **Woodford Reserve** ($35) — double-distilled, smooth, well-oaked. Premium-casual gift bottle.
4. **Four Roses Small Batch** ($30) — a blend of 10 different recipes. Complex, fruity, floral.
5. **Eagle Rare 10 Year** ($35 if you can get it) — Buffalo Trace's 10-year-old. Holy grail for value.

**High-proof bourbons to know:** Stagg Jr (130+ proof), Booker's (125+), Knob Creek 120, Wild Turkey Rare Breed.

**Sell note:** "Is this a gift?" determines everything. Gift = pretty bottle and 90-proof (Woodford, Blanton's). Self-drinker = ask about flavor preference: spicy (high rye like Bulleit) vs. sweet (wheated like Maker's).
$md$, 'spirits', 1, 2, true, true, null),

('American Rye Whiskey', 'Spicy, not sweet — rye''s comeback and what to stock.', $md$
**Rye by law (USA):** same rules as bourbon, but mash bill must be at least 51% rye grain. The rest is usually corn and malted barley.

**Flavor difference vs. bourbon:** rye gives you pepper, baking spice, mint, grassiness. Bourbon gives you vanilla, caramel, sweet corn. Rye is drier, spicier, more acidic. Better cocktail spirit for classic recipes like Manhattan, Old Fashioned, Sazerac, Whiskey Sour.

**Two styles:**

**Kentucky rye** — barely-legal ~51% rye, still mostly corn. Softer. Examples: Bulleit Rye (95% rye actually, despite the KY address — it's sourced), Woodford Rye, Knob Creek Rye.

**True high-rye / MGP-style** — 95%+ rye, huge spice punch. MGP Indiana supplies most of these. Examples: Templeton, Redemption, Bulleit, Dickel Rye, High West Double Rye.

**5 to stock:**
1. **Rittenhouse Bottled-in-Bond** ($28) — the bartender's rye. 100 proof, 51% rye, workhorse.
2. **Sazerac Rye** ($35) — Buffalo Trace's rye. Smooth, classic New Orleans cocktail rye.
3. **Bulleit Rye** ($30) — 95% rye, big spice, fantastic in Manhattans.
4. **WhistlePig 10 Year** ($75) — Vermont-finished Canadian rye. Silky, sippable, gift-worthy.
5. **High West Double Rye** ($40) — blend of young spicy + older mellow rye. Crowd-pleaser.

**Sell note:** Customer making Old Fashioneds → ask rye or bourbon. Rye = drier, classic NYC-bar style. Bourbon = sweeter, modern Louisville style. Neither is wrong.
$md$, 'spirits', 2, 2, true, true, null),

('Scotch — Single Malt', 'The 5 regions in 3 minutes.', $md$
Scotch whisky (note the spelling — no "e") must be made in Scotland and aged at least 3 years. Single malt = 100% malted barley from one distillery.

**Five classic regions:**

**1. Speyside** — the big one (over half of all single malts). Sweet, fruity, honeyed. Entry point for most drinkers. Examples: Glenfiddich, Glenlivet, Macallan, Aberlour, Balvenie, GlenDronach (sherry-finished).

**2. Highland** — variety is the feature. Can be light and floral (Glenmorangie) or big and robust (Dalmore, Oban). Dalwhinnie, Glen Garioch, Highland Park (technically Islands).

**3. Islay (pronounced "EYE-la")** — peated, smoky, maritime. Laphroaig, Lagavulin, Ardbeg, Bowmore, Bunnahabhain (usually unpeated despite being on Islay), Kilchoman.

**4. Campbeltown** — tiny region. Salty, briny, complex. Springbank is the star.

**5. Lowland** — light, grassy, easy-drinking. Glenkinchie, Auchentoshan. Often dismissed, good entry-level.

**Age statements matter but aren't everything:** 12 years is the standard entry. 18+ is premium. NAS ("no age statement") can be amazing or just young — depends on the producer.

**Sell notes:**
- Newcomer who "wants to try Scotch": Glenlivet 12 or Glenfiddich 12 ($45–50)
- Wants smoky: Lagavulin 16 ($85) or Laphroaig 10 ($50)
- Wants gift bottle under $100: Glenmorangie La Santa or Balvenie 14 DoubleWood
- Wants collector piece: Macallan Rare Cask, GlenDronach 21, Highland Park 18
$md$, 'spirits', 3, 2, true, true, null),

('Scotch — Blended', 'Not inferior to single malt — just different.', $md$
Blended Scotch = malt whisky + grain whisky, combined for consistency and accessibility. 90% of all Scotch sold is blended. Most classic Scotch cocktails use blends.

**The big names:**
- **Johnnie Walker** (Red, Black, Double Black, Gold, 18, Blue) — the biggest brand in Scotch. Red is the base blend. Black 12 is the benchmark. Blue is the prestige pour.
- **Chivas Regal** — Speyside-heavy blend, smooth, rounded. 12, 18, 25.
- **Dewar's** (White Label, 12, 15, 18) — often double-matured. Smooth, versatile.
- **Famous Grouse** — Scotland's #1 domestic seller. Approachable, good value.
- **Ballantine's** — rounded, nutty, honeyed. Popular in Asia and Europe.
- **Compass Box** — craft blends. Peat Monster, Spice Tree, Hedonism. Higher-end blends for the Scotch-curious.

**Blended vs. Single Malt — when to recommend which:**
- Gift for someone who drinks with ice or water: blended Scotch often works better
- Customer will make Rob Roy or Rusty Nail cocktails: blend
- Customer wants complexity and terroir: single malt
- Customer is budget-conscious under $30: good blend > cheap single malt

**Sell notes:**
- Johnnie Walker Black is a genuinely great 12-year blend — don't dismiss it
- Johnnie Walker Blue is expensive ($200+) but you're paying for marketing + the bottle as much as the whisky
- Compass Box "Peat Monster" is a brilliant gift for a peated-Scotch lover — $60
- Customer says "I hate Scotch" — 99% of the time they had a cheap blend poorly served. Offer a Speyside single malt with a splash of water.
$md$, 'spirits', 4, 2, true, true, null),

('Tequila & Mezcal', 'Blanco, Reposado, Añejo — and why "100% agave" matters.', $md$
**Tequila** must be made in designated regions of Mexico (mostly Jalisco) from blue agave. **Mezcal** can be made from dozens of agave species anywhere in 9 Mexican states. Different categories, different styles.

**Tequila categories (by aging):**
- **Blanco / Plata** — unaged or <2 months. Peppery, citrus, cooked agave. Best for cocktails.
- **Reposado** — aged 2–12 months in oak. Subtle oak, vanilla, rounded. Good for sipping or cocktails.
- **Añejo** — aged 1–3 years. More oak, caramel, like a soft whiskey. Sip neat.
- **Extra Añejo** — aged 3+ years. Amber, caramel, luxury priced. Sip neat.
- **Cristalino** — añejo that's been filtered to remove color. Trendy, debated. Don Julio 70 is the famous one.

**"100% Agave" vs. "Mixto":**
- 100% blue agave = real tequila
- "Tequila" without "100%" = mixto — can have up to 49% added sugar/grain alcohol. Avoid for anyone serious.

**Producers to stock:**
- Entry 100% agave: Espolón ($25), Cazadores, Lunazul
- Premium: Don Julio (70, 1942), Casamigos, Patrón, Clase Azul
- Bartender favorites: Tapatío, Siete Leguas, Fortaleza
- Mezcal: Del Maguey Vida ($35), Bozal, Los Vecinos

**Mezcal note:** Always smoky (the agave is pit-roasted). Different agaves (espadín, tobalá, madrecuishe) give wildly different flavors. Espadín is the workhorse — start there.

**Sell notes:**
- Customer wants a margarita spirit: Blanco, 100% agave
- Customer wants to "sip tequila like whiskey": Añejo or Extra Añejo
- Customer wants to try mezcal: Del Maguey Vida — friendly intro, versatile
- Customer wants Instagram bottle: Clase Azul Reposado ($120+ — the pretty ceramic)
$md$, 'spirits', 5, 2, true, true, null),

('Gin Essentials', 'London Dry vs. New Western — and the botanicals that define both.', $md$
Gin is neutral spirit flavored with botanicals. Juniper must be the dominant flavor. Everything else is up to the distiller.

**Styles:**

**London Dry** — the classic. Juniper-forward, dry, crisp. Botanicals must be added before distillation (no post-distillation flavoring). Examples: **Tanqueray, Bombay Sapphire, Beefeater, Sipsmith, The Botanist**.

**Plymouth** — only one distillery makes it (Plymouth, UK). Slightly less juniper, earthier, creamier. Halfway between London Dry and Old Tom. Protected name.

**Old Tom** — slightly sweeter historical style. Hayman's, Ransom. Used in Martinez and classic Tom Collins.

**Genever (Jenever)** — Dutch/Belgian. Malted grain base. Tastes halfway between whiskey and gin. Bols is the benchmark.

**New Western / Contemporary** — juniper is present but not dominant. Citrus, floral, spice-forward. **Hendrick's** (rose + cucumber), **Aviation** (Ryan Reynolds'), **Monkey 47** (47 botanicals, Black Forest), **St. George Terroir** (California forest).

**Sell notes:**
- Classic G&T or Martini: Tanqueray, Bombay, Sipsmith
- Flavored G&T with cucumber: Hendrick's
- Negroni: any dry gin — Tanqueray is the default
- Customer doesn't like juniper-forward gin: Hendrick's, Aviation, Monkey 47
- Gift: Monkey 47 ($50) — striking bottle, complex
- Budget everyday: Beefeater ($22)

The American "craft gin" category has exploded — St. George, Citadelle, Roku (Japanese), Nolet's. All New Western-style.
$md$, 'spirits', 6, 2, true, true, null),

('Rum — Light & Dark', 'Cuban vs. Jamaican vs. Martinique — and how aging changes everything.', $md$
Rum is made from sugarcane — either fresh cane juice or molasses (a byproduct of sugar refining). The style hinges on origin and aging.

**Three style groups:**

**Spanish-heritage (Cuban-style)** — molasses, column-still, lighter, cleaner. Easy mixers. Examples: **Bacardi, Flor de Caña, Ron Zacapa, Havana Club, Diplomático, Zacapa 23, Ron del Barrilito**.

**English-heritage (Jamaican/Bajan)** — molasses, pot-still, funky, rich, banana/pineapple esters. Examples: **Appleton Estate, Mount Gay, Myers's, Smith & Cross, Hamilton, Plantation**.

**French-heritage (Rhum Agricole)** — fresh sugarcane juice, grassy, vegetal, spicy. From Martinique, Guadeloupe, Haiti. Examples: **Rhum Clement, Rhum JM, Barbancourt, La Favorite**.

**By aging:**
- **Light / white / silver** — unaged or lightly aged, filtered. Cocktails (mojito, daiquiri).
- **Gold** — 1–3 years oak. Mid-range cocktails.
- **Dark / aged** — 3–12 years oak. Sip neat or complex cocktails.
- **Aged blend / solera** — long solera aging. Zacapa 23, Diplomático Reserva Exclusiva. Sweet, luxurious.

**Sell notes:**
- Daiquiri / Mojito: light Spanish rum — Bacardi, Havana Club (outside USA), Flor de Caña 4
- Tiki: Jamaican funk — Appleton 12, Smith & Cross, Hamilton 151
- Sipping rum: Zacapa 23, Diplomático Reserva, Appleton Estate 21, Ron del Barrilito 3-Star
- Customer who loves bourbon: try aged Demerara rum (El Dorado 12/15) — similar profile

**Overproof rum** (151 proof+): for tiki drinks, floats on top. Dangerous neat.
$md$, 'spirits', 7, 2, true, true, null),

('Cognac & Brandy', 'VS, VSOP, XO — and why Cognac is not just fancy brandy.', $md$
**Brandy** = any spirit distilled from fermented fruit. **Cognac** = brandy specifically from the Cognac region of France, made from Ugni Blanc grapes, double-distilled in copper pot stills, aged in French oak.

**Cognac age classifications:**
- **VS (Very Special)** — aged at least 2 years. Entry-level. Cocktail cognac.
- **VSOP (Very Superior Old Pale)** — aged at least 4 years. Smooth, sipping-worthy.
- **XO (Extra Old)** — aged at least 10 years (as of 2018, was 6). Prestige sipping.
- **Hors d'Âge** — beyond age classification. Top tier.

**Big houses:** Hennessy, Rémy Martin, Martell, Courvoisier. All four own most of the high-end spirits market share.

**Small artisan Cognac houses:** Pierre Ferrand, Paul Giraud, Tesseron, Frapin. Less marketing budget, often exceptional quality.

**Other brandies to know:**
- **Armagnac** — France's other brandy, from Gascogne. Column-still or pot-still, single distillation. Rustic, bolder. Often a better value than Cognac at the same age. Examples: Tariquet, Baron de Sigognac, Delord.
- **Spanish Brandy** (Brandy de Jerez) — Cardenal Mendoza, Torres 10. Solera-aged, sweeter.
- **American Brandy** — Germain-Robin, Osocalis, Bertoux. High quality, underrated.
- **Pisco** (Peru/Chile) — clear, unaged grape brandy. Pisco Sour base.
- **Grappa** (Italy) — distilled from wine-making leftovers. Poli, Nonino. Acquired taste.

**Sell notes:**
- Customer wants to try Cognac: Hennessy VS ($40) or Rémy VSOP ($50)
- Customer wants a gift: Rémy XO, Hennessy Paradis (if budget allows)
- Cocktail cognac (Sidecar, Sazerac): Pierre Ferrand 1840 or Hennessy VS
- Customer loves aged bourbon: suggest Armagnac XO — similar profile, half the price
$md$, 'spirits', 8, 2, true, true, null),

('Japanese Whisky', 'Why it''s expensive, and the producers worth knowing.', $md$
Japanese whisky was modeled on Scotch in the 1920s (Masataka Taketsuru brought the techniques home). Today it's a global luxury category — demand vastly exceeds supply.

**Key producers:**
- **Suntory** — Yamazaki, Hakushu, Hibiki (blend), Toki (blend, entry).
- **Nikka** — Yoichi, Miyagikyo, Nikka Coffey Grain, Nikka From The Barrel (blend).
- **Chichibu** — small but cult-status. Ichiro's Malt.
- **Mars, Akkeshi, Kanosuke** — newer craft distilleries.

**Style:**
Generally clean, precise, subtle. Less smoke than Islay, less sweetness than Speyside, but often impeccable balance. Japanese oak (mizunara) gives a distinctive sandalwood / incense / coconut note.

**Watch out for "Japanese-style" whisky:**
Before 2021, "Japanese whisky" had no legal definition — brands like Shinju, Kaiyo, and some early Suntory bottlings were partly or fully sourced from Scotland or Canada and bottled in Japan. A 2021 voluntary code tightened this. For authenticity, stick to bottles explicitly aged and distilled in Japan.

**Sell notes:**
- Customer asking about Yamazaki/Hakushu: know age statements are largely discontinued. Yamazaki 12 is still around but expensive ($250+); NAS "Yamazaki Distiller's Reserve" is $90 and still great.
- Gift under $100: Hibiki Harmony, Nikka From The Barrel, Suntory Toki
- Sipping whisky with sushi or subtle food: any Japanese single malt — designed to not overwhelm
- Customer wants peated Japanese: Yoichi, Hakushu (lightly peated)

Prices are high because production couldn't scale fast enough to meet demand. This isn't going to change soon.
$md$, 'spirits', 9, 2, true, true, null),

('Irish Whiskey', 'Pot still, blended, and single malt — the three Irish styles.', $md$
Irish whiskey is often triple-distilled (vs. Scotch's double), making it lighter and smoother. It's the world's fastest-growing whisky category.

**Three styles:**

**1. Single Pot Still** — a uniquely Irish style. Mix of malted + unmalted barley, triple-distilled in copper pot stills. Spicy, creamy, complex. Examples: **Redbreast 12 ($75), Green Spot ($65), Yellow Spot ($100), Powers Three Swallow**.

**2. Single Malt** — 100% malted barley, one distillery. Like Scotch single malt but often triple-distilled. Examples: **Bushmills 10/16/21, Teeling Single Malt, Connemara (peated!)**.

**3. Blended** — the 90% most people know. Grain + malt whiskey. Easy, approachable. Examples: **Jameson, Tullamore DEW, Powers Gold, Bushmills Original**.

**Producers to know:**
- **Midleton** (Irish Distillers / Pernod Ricard) — makes Jameson, Redbreast, Green Spot, Powers, Midleton Very Rare
- **Bushmills** — oldest licensed distillery in the world (1608). Made the Giant's Causeway distillery famous.
- **Teeling** — newer independent producer, exciting range.
- **Kilbeggan / Connemara / Tyrconnell** — Cooley Distillery. Good for peated Irish (Connemara).

**Sell notes:**
- Jameson is everyone's intro — don't overlook it. Great whiskey, honest price ($30).
- Customer wants to upgrade from Jameson: Redbreast 12 or Green Spot
- Customer wants peated: Connemara or Bushmills 10 (barely peated)
- Customer wants a gift under $80: Redbreast 12 — universally respected
- St. Patrick's Day: stock Jameson, Bushmills, Tullamore DEW heavily

Irish whiskey is generally smooth enough for beginners — great gateway spirit.
$md$, 'spirits', 10, 2, true, true, null),

('Vodka Basics', 'Grain, potato, grape — and whether "premium" vodka actually matters.', $md$
Vodka is distilled to near-neutral (95% ABV+) and cut with water to bottling strength (40% typically). By law in the US, vodka must be "without distinctive character, aroma, taste, or color" — but subtle differences do exist.

**Base ingredient affects mouthfeel more than flavor:**
- **Wheat** — the most common. Soft, slightly sweet. Grey Goose, Absolut, Stolichnaya.
- **Rye** — spicier, firmer. Belvedere, Potocki.
- **Potato** — creamy, fuller body. Chopin, Luksusowa.
- **Corn** — sweet, clean. Tito's, Deep Eddy.
- **Grape** — silky, delicate. Ciroc.

**Premium vodka debate:**
- Blind tastings consistently show most drinkers can't distinguish premium from mid-tier vodka when chilled and in cocktails
- Differences ARE detectable at room temperature, neat
- Premium vodka is often about the brand/bottle for gifting, not the liquid

**Producers by tier:**
- Value ($15–20): Svedka, Smirnoff, New Amsterdam
- Mid ($20–35): Tito's, Absolut, Stolichnaya, Russian Standard
- Premium ($30–50): Grey Goose, Belvedere, Ketel One, Ciroc
- Craft / ultra-premium ($40–100+): Chopin, Hangar 1, Reyka

**Sell notes:**
- Customer making vodka tonic at home: Tito's or Ketel One — clean in mixers
- Customer sipping neat or martini: Grey Goose, Belvedere, Chopin
- Gift: Grey Goose ($40) — strong brand recognition, looks expensive
- Flavor-forward infused: Absolut Elyx (copper-distilled, upmarket)
- Bloody Mary specifically: Deep Eddy or Tito's — both made for savory mixers

Don't oversell "premium" to someone making mixed drinks. Match the spirit to the use case.
$md$, 'spirits', 11, 2, true, true, null),

('Liqueurs & Amaro', 'Sweet, bitter, herbal — the cocktail modifiers you need to know.', $md$
**Liqueurs** are sweetened, lower-proof spirits flavored with fruit, herbs, nuts, or cream. Essential for cocktail-making.

**The classic cocktail modifiers:**

**Orange liqueurs:** Cointreau (triple sec), Grand Marnier (cognac-based), Combier, dry curaçao. Margaritas, Sidecars, Cosmopolitans.

**Herbal:** Chartreuse (green = 55% ABV, bold; yellow = 40%, softer). Bénédictine. Galliano. Drambuie (Scotch-based). St-Germain (elderflower).

**Bitter / aperitivo:** **Campari** (red, intensely bitter — Negroni). **Aperol** (softer, orange — Aperol Spritz). Suze (yellow gentian). Select.

**Amaro** (Italian bitter digestifs): Averna, Montenegro, Fernet-Branca (mint, divisive), Amaro Nonino, Cynar (artichoke), Ramazzotti. Sip after dinner or build cocktails.

**Coffee:** Kahlúa (workhorse), Mr Black (craft), Tia Maria. Espresso martinis, White Russians.

**Cream/dairy:** Baileys, RumChata.

**Fruit:** Chambord (raspberry), Luxardo Maraschino (distinct — not cherry flavored!), Crème de Cassis (blackcurrant), Luxardo Sambuca.

**Anise/licorice:** Absinthe, Pernod, Pastis, Ouzo.

**Sell notes:**
- Customer making Negronis at home: Campari is non-negotiable
- Customer making Margaritas: Cointreau >> cheap triple sec
- Gift for cocktail enthusiast: Chartreuse Green — versatile, iconic, $60
- Customer loves bitter cocktails: introduce Amaro category — Averna is the gateway
- Customer wants Italian digestif: Amaro Nonino ($45) or Montenegro ($30)

Most home bars have a sad bottle of triple sec that's been there 10 years. Upsell Cointreau — it makes every cocktail instantly better.
$md$, 'spirits', 12, 2, true, true, null);

-- ============================================================================
-- BEER (8)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('IPA Styles Guide', 'West Coast, Hazy, Double, Session — know the difference fast.', $md$
IPA (India Pale Ale) is the most fragmented beer style in America. Every brewery makes three. Know the lanes.

**West Coast IPA** — the original American style. Clear, bitter, pine and grapefruit. 6–7.5% ABV. Hop-forward. Examples: **Stone IPA, Ballast Point Sculpin, Russian River Blind Pig, Sierra Nevada Celebration**.

**Hazy / New England IPA (NEIPA)** — cloudy (literally unfiltered), juicy, tropical fruit, soft bitterness. Tree House, Trillium, Other Half, Monkish. 6.5–8% ABV. The dominant IPA style of the 2020s.

**Double IPA (DIPA) / Imperial IPA** — stronger version of either style above. 7.5–10% ABV. Pliny the Elder is the benchmark. Stone Enjoy By, Bell's Hopslam, The Alchemist Heady Topper.

**Triple IPA (TIPA)** — rare, 10%+ ABV. Russian River Pliny the Younger (released once/year).

**Session IPA** — lower alcohol (4–5%), same hop punch as a regular IPA. Founders All Day, Lagunitas DayTime, Firestone Easy Jack.

**Cold IPA** — newer style. Lager-like body + West Coast hops. Crisp, bitter, clean.

**Milkshake IPA** — adds lactose for sweetness and sometimes fruit. Polarizing.

**Brut IPA** — dry as Champagne. Fad from 2018–2019, mostly died.

**Sell notes:**
- Customer wants a "classic IPA": West Coast — Stone IPA, Sculpin
- Customer wants "the juicy kind": Hazy — Tree House if you have it, Sierra Nevada Hazy Little Thing otherwise
- Customer wants highest ABV: Double IPA
- Customer says IPA is "too bitter": suggest Hazy IPA — same hops, way less bitterness perception
- Customer wants multiple beers for a session: Session IPA is literally named for that

Hops matter: **Citra** (tropical), **Mosaic** (blueberry, tropical), **Galaxy** (passionfruit), **Simcoe** (pine/earth), **Amarillo** (orange). Most great hazies use Citra + Mosaic.
$md$, 'beer', 1, 2, true, true, null),

('Local Craft IPAs — Southeast', 'Key breweries and their flagships in the SE US.', $md$
The Southeast has exploded as a craft beer region. Atlanta, Charleston, Asheville, and Nashville lead the way. Here's a working knowledge.

**Georgia:**
- **Scofflaw** (Atlanta) — Basement IPA (Hazy), POG, Double Jeopardy DIPA
- **Wild Leap** (LaGrange) — Alpha Abstraction series (DIPAs), Pacific Coast IPA
- **Monday Night** (Atlanta) — Han Brolo (NEIPA), Slap Fight IPA, Drafty Kilt Scotch Ale (not IPA, but signature)
- **Terrapin** (Athens) — Hopsecutioner (classic West Coast), Luau Krunkles (Hawaiian Pale), RecreationAle
- **Creature Comforts** (Athens) — Tropicália (the legendary flagship IPA), Athena Paradiso (fruited sour, not IPA)
- **SweetWater** (Atlanta) — 420 Extra Pale Ale (gateway), IPA, Guide Beer

**Carolinas:**
- **Wicked Weed** (Asheville, now AB-owned) — Pernicious IPA, Freak of Nature DIPA
- **Burial Beer** (Asheville) — Skillet Donut Stout (not IPA but essential), Shadowclock Pilsner, Surf Wax IPA
- **Highland Brewing** (Asheville) — Gaelic Ale (a Red, not IPA, but iconic)
- **Edmund's Oast** (Charleston) — various IPAs including collaborations
- **Fonta Flora** (Morganton, NC) — farmhouse + IPA range

**Tennessee:**
- **Yazoo** (Nashville) — Hop Perfect IPA
- **Bearded Iris** (Nashville) — Homestyle (flagship NEIPA), Double Scoop
- **TailGate Beer** (Nashville) — Hefeweizen is the flagship, but their IPAs are solid

**Florida:**
- **Cigar City** (Tampa) — Jai Alai IPA (benchmark Florida IPA)
- **Funky Buddha** (Oakland Park) — Floridian Hefeweizen, but IPA range too

**Sell notes for SE stores:**
- Walk-in customer new to craft IPA: Tropicália or Jai Alai — universally loved
- Customer wants highest-alcohol DIPA: Wild Leap Alpha Abstraction or Scofflaw Double Jeopardy
- Customer wants classic bitter West Coast: Terrapin Hopsecutioner or SweetWater IPA
- Customer wants hazy: Scofflaw Basement or Bearded Iris Homestyle
- Tourist looking for local flavor: Creature Comforts Tropicália — state beer of Georgia unofficially

Stock rotates fast — check freshness dates on IPAs. Older than 90 days = lost hop character.
$md$, 'beer', 2, 2, true, true, null),

('Belgian Ales', 'Trappist, Dubbel, Tripel, Quad — and why Belgian yeast is everything.', $md$
Belgian ales are defined by the yeast. Belgian yeast strains produce fruity esters (banana, pear, clove) and phenolic notes (black pepper, spice) at warm fermentation temperatures. No IPA-level hop bitterness — the yeast does the work.

**Style families:**

**Trappist / Abbey ales:** made by monks in (or historically by) Belgian monasteries. Only 11 Trappist breweries worldwide hold the authentic Trappist trademark.
- **Dubbel** — dark, malty, fig, raisin, 6–8% ABV. Chimay Red, Westmalle Dubbel.
- **Tripel** — golden, strong, deceptively smooth. 7.5–9.5% ABV. Westmalle Tripel, Chimay Cinq Cents (White), La Fin du Monde (Canadian-Belgian).
- **Quadrupel / Belgian Strong Dark** — big, boozy, dried fruit, chocolate. 9–12% ABV. Rochefort 10, Westvleteren 12 (the unicorn), St. Bernardus Abt 12, Chimay Blue.

**Witbier (Belgian White)** — unfiltered wheat beer with coriander and orange peel. 4.5–5.5% ABV. **Hoegaarden** is the template. Allagash White (Maine) is the American gold standard.

**Saison** — farmhouse ale. Dry, peppery, effervescent. 5–8% ABV. Saison Dupont is the classic. Hill Farmstead (VT) makes world-class saisons.

**Lambic / Geuze / Kriek** — spontaneously fermented wild ales. Sour, funky, cidery. Cantillon, Drie Fonteinen, Boon Oude Geuze. Kriek = cherry-fermented lambic.

**Flanders Red / Oud Bruin** — sour aged reds from Flanders. Rodenbach Grand Cru, Duchesse de Bourgogne. Tart, wine-like.

**Sell notes:**
- Customer likes dark beers and wants to try Belgian: Rochefort 10 or Chimay Blue
- Customer wants summer Belgian: Hoegaarden or Allagash White
- Customer wants to try sour: Cantillon (if you have it, congrats), Duchesse de Bourgogne, Rodenbach
- Cooking with mussels/pairing with Belgian food: any Saison (Dupont)
- Gift box: mix Chimay Red, White, Blue — three-pack tells the Trappist story

Westvleteren 12 is called "the best beer in the world" — only sold at the monastery in Belgium. If you have a bottle in the States, it's gray-market.
$md$, 'beer', 3, 2, true, true, null),

('Lagers & Pilsners', 'Light doesn''t mean simple — the crafted lager renaissance.', $md$
Lager = bottom-fermented, cold-aged beer. The category includes everything from Bud Light to high-precision German pilsners. Most of the world's beer is lager.

**Key styles:**

**German Pilsner** — crisp, bitter, floral hops (Saaz, Hallertau), pale gold. 4.5–5% ABV. **Bitburger, Warsteiner, Jever** (extra hoppy).

**Czech Pilsner** — slightly richer, more malt body, floral/soapy hop. Pilsner Urquell is the original. **Pilsner Urquell, Budvar** (the real "Budweiser" from Czech Republic — legally called Czechvar in the US).

**Helles / Munich Lager** — softer, maltier, less bitter than pilsner. Bread crust, honey. **Augustiner Helles, Weihenstephaner Original, Hofbräu Original**.

**Märzen / Oktoberfest** — amber, malty, caramel. Brewed in spring, drunk in fall. **Paulaner Oktoberfest, Hacker-Pschorr, Spaten**.

**Schwarzbier (black lager)** — dark, chocolatey, but light-bodied. Köstritzer.

**Vienna Lager** — amber, malt-forward, crisp. Negra Modelo is a Mexican cousin. Great Lakes Eliot Ness.

**Doppelbock** — strong lager (7–10% ABV). Malty, rich. Ayinger Celebrator, Paulaner Salvator.

**American Lager / Light Lager** — Budweiser, Coors, Miller, Modelo Especial. Don't dismiss — Modelo especially.

**Mexican Lager / Cerveza** — Modelo, Pacifico, Victoria, Tecate. Lime optional.

**Italian Pilsner** — newer craft trend. Dry-hopped pilsner. Birrificio Italiano Tipopils is the archetype; Firestone Walker Pivo Pils (CA) brought it to the US.

**Sell notes:**
- Customer wants "something light but interesting": Helles or Italian Pils
- Customer drinks Bud Light but is willing to try slightly better: American craft lager (Founders Solid Gold, Firestone Lager) or Modelo
- Oktoberfest season: stock Märzens heavily — consumers literally ask for "Oktoberfest beer"
- Customer wants dark but not heavy: Schwarzbier
- Pairing with Asian food or fried food: Japanese lagers — Sapporo, Asahi, Kirin

The craft lager renaissance is real. Pilsner is in, ironic mustaches or not.
$md$, 'beer', 4, 2, true, true, null),

('Stouts & Porters', 'Dry, sweet, oatmeal, imperial, pastry — the dark-beer landscape.', $md$
Stouts and porters are roast-malt-forward dark beers. Coffee, chocolate, toasty notes. Porter came first (18th century London); stout was originally "stout porter" — just a stronger porter.

**Dry Irish Stout** — the Guinness style. Low ABV (4–5%), coffee, dry finish, often served on nitro for creamy head. **Guinness Draught, Murphy's, Beamish**.

**Oatmeal Stout** — oats add silky mouthfeel. 5–6% ABV. **Samuel Smith's Oatmeal Stout, Founders Breakfast Stout, Ommegang Adoration**.

**Milk Stout / Sweet Stout** — lactose (milk sugar) adds sweetness. 5–7% ABV. Left Hand Milk Stout (famous for nitro version).

**Russian Imperial Stout** — the biggest, baddest. 8–12%+ ABV. Molasses, dark chocolate, coffee, often barrel-aged. **North Coast Old Rasputin, Bell's Expedition, Founders KBS (Kentucky Breakfast Stout), Goose Island Bourbon County**.

**Pastry Stout** — imperial stout with adjuncts (cocoa nibs, marshmallow, vanilla, maple syrup, peanut butter). 10%+ ABV. Polarizing. Omnipollo, Prairie Bomb, Trillium's adjunct stouts.

**Porter** — slightly less roasty than stout, more chocolate, lighter body. 4.5–6.5% ABV. **Founders Porter, Deschutes Black Butte, Stone Smoked Porter**.

**Baltic Porter** — lagered strong porter. 7–9.5% ABV. Malty, clean, chocolate. Smuttynose Baltic Porter.

**Sell notes:**
- Guinness is the gateway — 90% of US stout starts there
- Customer wants chocolate/coffee: any imperial stout, Breakfast Stout especially
- Customer wants "easy-drinking dark beer": Dry Irish Stout or Porter, not imperial
- Customer wants highest ABV dark beer: Imperial Stout, 11–15%
- BBOS ("Bourbon Barrel Old Stout") has a cult following — Goose Island Bourbon County Stout (winter release) is the most famous
- Dessert pairing: pastry stout with chocolate cake. It's decadent but works.

Serve stouts slightly warmer than lagers — 50–55°F. Cold masks the flavor.
$md$, 'beer', 5, 2, true, true, null),

('Sours & Goses', 'Berliner Weisse, Gose, fruited sours — the tart beer category.', $md$
Sour beers come from bacterial fermentation (Lactobacillus, Brettanomyces, Pediococcus). For decades, sour was a mistake brewers tried to prevent. Now it's a billion-dollar category.

**Key styles:**

**Berliner Weisse** — light, tart, low ABV (2.5–4%). Wheat base. Traditionally served with raspberry or woodruff syrup. Dogfish Head Festina Pêche, Freigeist Abraxxxas.

**Gose (pronounced GO-zuh)** — tart, slightly salty, coriander-spiced wheat beer. 4–5% ABV. **Anderson Valley Gose, Westbrook Gose, Off Color Troublesome**. Modern versions often add fruit.

**Lambic / Geuze** — Belgian spontaneously fermented wild ale, aged in oak. Young lambic + old lambic blended = gueuze. Cantillon, Drie Fonteinen, Boon. **Kriek** = with cherries. **Framboise** = raspberry.

**Flanders Red / Oud Bruin** — Belgian sour aged reds. Rodenbach Grand Cru, Duchesse de Bourgogne.

**American Wild Ale** — catch-all for US brewers experimenting with wild/sour fermentation. Jester King, Russian River "Sonambic" releases, Crooked Stave, Side Project, Jolly Pumpkin.

**Fruited Sour (Sour with X)** — popular US craft category. Sour base + heavy fruit addition. Creature Comforts Athena series, Westbrook fruit Goses, New Glarus Wisconsin Belgian Red (the legendary cherry sour).

**Sell notes:**
- Customer new to sour: Berliner Weisse or fruited Gose — friendly intro
- Customer wants the real deal: Cantillon, Drie Fonteinen (rare, pricey)
- Summer session: low-ABV Gose (4%), served cold
- Champagne-like celebration sour: Gueuze
- Customer hates sour but wants to try: Duchesse de Bourgogne — balanced with caramel sweetness

Sours tend to divide drinkers sharply. Don't push; offer a taste if possible, or let customers buy a single can to try.
$md$, 'beer', 6, 2, true, true, null),

('Wheat Beers', 'Hefeweizen, Witbier, American Wheat — the banana-and-clove world.', $md$
Wheat beers are brewed with a high percentage of wheat (usually 30–60% of the grain bill). Light body, often hazy, specific yeast-driven flavors.

**German Hefeweizen** — Bavarian wheat beer. Weizen yeast produces banana and clove esters. Cloudy, 5–5.5% ABV. Classic examples: **Weihenstephaner Hefeweissbier** (benchmark), **Paulaner Hefe-Weissbier, Ayinger Bräuweisse**. Traditional glass is the tall curvy "Weizen" glass.

**Kristallweizen** — filtered version of Hefeweizen. Clear, cleaner, but less yeast character.

**Dunkelweizen** — dark wheat beer. Hefeweizen + Munich malt. Banana + caramel + bread. Weihenstephaner Hefeweissbier Dunkel.

**Weizenbock** — strong wheat beer. 7–9% ABV. Aventinus (Schneider Weisse), Weihenstephaner Vitus.

**Belgian Witbier** — unfiltered Belgian wheat with coriander and orange peel. 4.5–5.5% ABV. **Hoegaarden** (the blueprint), Allagash White (Maine, excellent), Blue Moon (the American corporate cousin).

**American Wheat** — neutral clean wheat ale, no banana/clove yeast. Gumballhead (Three Floyds) is a famous hoppy example. Boulevard Unfiltered Wheat.

**Berliner Weisse** — tart wheat beer, covered in Sours module.

**Sell notes:**
- Hot summer day + hesitant beer drinker: Hefeweizen or Witbier — refreshing, banana/orange notes
- Customer "doesn't like beer": Witbier is often the bridge (citrus, spice, light body)
- Pairs beautifully with brunch, salads, mild seafood, fruit desserts
- Serve in a Weizen glass if you can — the tall shape retains head, enhances aromatics
- Orange wedge is traditional on Witbier; a lemon wheel is often served with Hefeweizen — debate if it's necessary (German purists hate it)

Wheat beer is best fresh. Within 3 months of packaging ideally.
$md$, 'beer', 7, 2, true, true, null),

('Reading a Beer Label', 'ABV, IBU, OG, and all the other abbreviations.', $md$
Beer labels pack a lot of information. Here's what to know.

**ABV — Alcohol By Volume.** Percentage of ethanol. Session = 3–5%, standard = 5–6.5%, strong = 7–10%, imperial/extreme = 10%+.

**IBU — International Bitterness Units.** Measures iso-alpha acid from hops. Roughly:
- 10–25 IBU: wheat beers, lagers, witbier
- 25–40: pale ales
- 40–70: most IPAs
- 70–100+: double IPAs, barleywines
- IBU perception depends on malt sweetness. A 70 IBU sweet barleywine feels less bitter than a 40 IBU dry IPA.

**SRM / EBC — Color.** Straw (2-4 SRM) → amber (10-15) → brown (15-20) → black (40+).

**OG — Original Gravity.** Density of the unfermented wort. Higher OG = more alcohol potential. 1.050 is average, 1.100+ is big beer.

**FG — Final Gravity.** Density after fermentation. The difference between OG and FG indicates residual sweetness.

**Packaged on / Best by** — hop-forward beers fade fast. An IPA over 90 days old is significantly diminished. Stouts and barrel-aged beers generally improve with age.

**Can/Bottle codes:** most major breweries print the packaging date on the side of the can or on the label. Craft: usually a "packaged on" date. Mass: often a Julian calendar code (YYDDD).

**Hop names on label:** Citra, Mosaic, Galaxy, Simcoe, Amarillo, Cascade, Chinook, Nelson Sauvin, El Dorado. Different hops = different flavor profiles.

**Style designation:** brewers vary on whether they follow BJCP style guidelines exactly. Treat style names as approximate.

**Sell notes:**
- Customer asks "which is strongest": ABV on label
- Customer asks "which is most bitter": IBU, but explain it's not the whole story
- Customer asks for "freshest IPA": always check dates — turnover matters for hop-forward beers
- Customer wants to compare two stouts for sweetness: OG and FG give hints but tasting notes are better

Teach your staff to always check packaging dates on hop-forward beers. It's the #1 quality issue in craft beer retail.
$md$, 'beer', 8, 2, true, true, null);

-- ============================================================================
-- COCKTAILS (8)
-- ============================================================================

insert into public.modules (title, description, content, category_group, position, star_reward, is_seed, is_published, store_id)
values
('Old Fashioned', 'The original cocktail — rye or bourbon, and the sugar debate.', $md$
The Old Fashioned may be the world's oldest cocktail (1806). The template: spirit + sugar + bitters + water. Simple, but every element matters.

**Classic Old Fashioned:**
- 2 oz rye or bourbon
- 1 sugar cube (or ¼ oz simple syrup, or ¼ oz rich demerara syrup)
- 2–3 dashes Angostura bitters
- Orange twist (expressed and dropped in)
- Optional: brandied cherry (Luxardo)
- Large ice cube, stir gently in rocks glass

**Rye vs. Bourbon:**
- **Rye** — classic NYC/Sazerac-style. Drier, spicier. Rittenhouse, Sazerac Rye, Bulleit.
- **Bourbon** — sweeter, rounder. Maker's, Woodford, Buffalo Trace. Modern default in the US.

**Sugar debate:**
- **Sugar cube muddled with bitters** — traditional. Slightly inconsistent sweetness.
- **Simple syrup** — easy, uniform.
- **Demerara syrup (1:1 turbinado sugar + water)** — richer, caramelly, complements whiskey better. Most craft bartenders' choice.
- **Maple syrup** — modern twist. Too distinct for purists.

**Bitters to try:**
- **Angostura** — the default. Clove, allspice, baking spice.
- **Peychaud's** — New Orleans style. Lighter, anise-forward. Classic in a Sazerac.
- **Orange bitters** — Regans' or Fee Brothers. Brightens rye-based Old Fashioneds.

**Common mistakes:**
- Muddling the orange peel (adds bitterness from the pith) — expresses the oil instead
- Adding muddled cherries and orange slices like it's 1985 — fine if customer wants that, but not classic
- Shaking instead of stirring

**Sell notes:**
- Customer says "I want an Old Fashioned but with something interesting": try rye + Amaro Nonino instead of sugar, or a mezcal Old Fashioned
- Classic presentation: Woodford Reserve + demerara + orange twist + Luxardo cherry = crowd-pleaser
- Gift bundle: bourbon + Angostura + orange + Luxardo cherries

The Old Fashioned is every home bar's proving ground. Get it right.
$md$, 'cocktails', 1, 2, true, true, null),

('Negroni & Variations', 'Gin + Campari + sweet vermouth — and the family tree.', $md$
The Negroni: equal parts (1 oz each) gin, Campari, sweet vermouth. Stirred over ice, orange peel. It's been around since 1919 and has spawned a dozen variations.

**Classic Negroni:**
- 1 oz London Dry gin (Tanqueray, Beefeater)
- 1 oz Campari
- 1 oz sweet vermouth (Carpano Antica, Cocchi Vermouth di Torino)
- Stir with ice, strain over fresh ice in rocks glass
- Express and drop an orange peel

**Variations to know:**

**Negroni Sbagliato ("mistaken Negroni")** — replace the gin with sparkling wine. Lighter, bubbly, brunch-friendly. Went viral in 2022 thanks to Emma D'Arcy.

**Boulevardier** — replace gin with rye or bourbon. Richer, more "winter" cocktail. 1:1:1 or 1½ oz whiskey for more spirit.

**Old Pal** — dry vermouth + rye + Campari, 1:1:1. Drier, more aperitivo-forward.

**White Negroni** — gin + Suze (yellow gentian liqueur) + Lillet Blanc. Lighter, floral, for Campari-averse drinkers.

**Mezcal Negroni** — mezcal instead of gin. Smoky twist, works beautifully.

**Cynar Negroni** — Cynar (artichoke amaro) instead of Campari. Less bitter, more herbal.

**Italian Greyhound Negroni / Jasmine** — variation with grapefruit, Cointreau — less classic but popular in cocktail bars.

**Sell notes:**
- Customer wants to make Negronis at home: they need gin (can be modest), Campari (non-negotiable), and good vermouth (THE upgrade — Carpano Antica transforms it)
- Vermouth is wine-based. Refrigerate after opening. Lasts ~1 month.
- Customer says Negroni is "too bitter": try Boulevardier first, or White Negroni with Suze
- Gift bundle: Tanqueray + Campari + Carpano Antica Formula = Negroni kit

Pro tip: chill the glass. Negroni served in a warm glass is a different drink.
$md$, 'cocktails', 2, 2, true, true, null),

('Whiskey Sour Family', 'Sour, New York Sour, Boston Sour — and the egg white question.', $md$
The Whiskey Sour: spirit + citrus + sweetener. The "sour" template is the most flexible in cocktails — Margarita, Daiquiri, Sidecar, Gimlet, all sours.

**Classic Whiskey Sour:**
- 2 oz bourbon or rye
- ¾ oz fresh lemon juice
- ¾ oz simple syrup (or ½ oz if less sweet)
- Optional: 1 egg white (or 1 oz aquafaba) for foam
- Shake hard with ice, strain into rocks or coupe
- Garnish: Luxardo cherry, orange slice

**With egg white = "Boston Sour."** Shake dry first (no ice) to build foam, then shake with ice. Strain. Creamy texture, softer taste, visually striking.

**"New York Sour"** = float ½ oz red wine on top of a whiskey sour. Looks dramatic, tastes better than it sounds. Use a full-bodied red (Malbec, Shiraz).

**Other sour variations:**
- **Amaretto Sour** — amaretto + lemon + syrup. Often too sweet; pros add a split with bourbon.
- **Penicillin** — Scotch + honey-ginger syrup + lemon, float of peated Scotch. Modern classic (Sam Ross, 2005).
- **Gold Rush** — bourbon + honey syrup + lemon, no egg. Simpler cousin.

**Equipment/technique:**
- Fresh lemon juice is mandatory. Bottled lemon juice is noticeably worse.
- Shake hard — 15+ seconds, not 5.
- Double strain through a fine mesh for a polished look.

**Spirits that work:**
- **Bourbon** — Buffalo Trace, Woodford Reserve, Maker's Mark
- **Rye** — Rittenhouse (classic bartender pick), Bulleit Rye, Old Overholt
- **Irish whiskey** — Jameson works; uses a similar template = Irish Sour

**Sell notes:**
- Home bartender: they need fresh lemon juice weekly, not bottled
- Gift for whiskey-and-citrus lover: the Penicillin kit — Compass Box Peat Monster + a middle-shelf blend + honey + ginger root + lemon
- Customer who loved an Aperol Spritz: they'll probably like a Gold Rush too
$md$, 'cocktails', 3, 2, true, true, null),

('Martini & Variations', 'Gin vs. vodka, dry vs. wet, and what "dirty" really means.', $md$
The Martini is the most argued-about cocktail in history. Bond got it wrong (shaken makes it cloudy and waters it down — stirred is correct for any clear spirit cocktail).

**Classic Dry Martini:**
- 2½ oz gin (London Dry: Tanqueray, Beefeater, Sipsmith)
- ½ oz dry vermouth (Dolin, Noilly Prat)
- Stir with ice 20 seconds
- Strain into chilled martini or coupe glass
- Lemon twist or olive garnish

**"Dry" means less vermouth.** A 5:1 gin:vermouth is classic; 10:1 is drier; some bartenders in the 60s just waved the vermouth bottle over the gin ("Churchill Martini").

**"Wet" means more vermouth.** 2:1 gin:vermouth is a "wet Martini" or "50/50" (approximately). Modern bars often make wetter Martinis because good vermouth makes great cocktails.

**"Dirty" = olive brine.** Add ¼–½ oz olive brine. Mix of flavor profile and savory element. Best with vodka. Dirty Martini at most bars is vodka by default.

**Vodka Martini** — same template, vodka instead of gin. Smoother, more neutral. Grey Goose, Belvedere work well.

**Vesper** (Bond's drink) — 3 oz gin + 1 oz vodka + ½ oz Lillet Blanc. Shaken (Bond's order) or stirred (correct). Original spec used Kina Lillet (now discontinued) — Lillet Blanc is the modern substitute.

**Gibson** — Martini with a pickled cocktail onion instead of olive. Technically identical otherwise.

**Martinez** — the precursor. Old Tom gin + sweet vermouth + Luxardo Maraschino + Boker's bitters. Sweeter, older, elegant.

**Dirty Cajun / Flavored Martinis** — expresso martini, apple-tini, etc. Marketing names, rarely Martinis in the purist sense.

**Vermouth storage:** Vermouth is wine. After opening, refrigerate. Lasts 4–6 weeks. Old vermouth ruins Martinis.

**Sell notes:**
- Customer wants "a good martini gin": Tanqueray or Sipsmith are benchmark
- Customer wants it extra cold: freeze the gin and vermouth (controversial — some say it dulls the aromatics)
- Garnish: 3 olives is standard for dirty; lemon peel for clean
- Gift bundle: Tanqueray No. Ten + Dolin Dry + Castelvetrano olives = home bar upgrade

A good martini is 30 seconds of careful work, not a showy shake.
$md$, 'cocktails', 4, 2, true, true, null),

('Margarita Family', 'On the rocks, frozen, tommy''s, spicy — every version, done right.', $md$
The Margarita: tequila + lime + orange liqueur. Invented (probably) in Mexico in the 1940s. America's most-ordered cocktail.

**Classic Margarita (on the rocks):**
- 2 oz blanco tequila (100% agave — Espolón, Cazadores, Lunazul, Casamigos)
- 1 oz fresh lime juice
- ¾ oz Cointreau (or ½ oz Cointreau + ½ oz agave syrup for "Tommy's" style)
- Shake with ice, strain over fresh ice in salt-rimmed rocks glass
- Lime wheel garnish

**Tommy's Margarita** — no orange liqueur, uses agave syrup instead. Cleaner, lets tequila shine. Developed at Tommy's Mexican Restaurant in SF.

**Frozen Margarita** — blended with ice. Made famous by the first frozen margarita machine (Mariano Martinez, Dallas, 1971). Use less citrus; blending waters it down. Or use less-sweet citrus (Tommy's-style).

**Top-shelf Margarita** — substitute aged tequila (reposado/añejo) + Grand Marnier for Cointreau. Richer, more oak-forward.

**Spicy Margarita** — muddle jalapeño slices before shaking, or use chile-infused tequila. Rim with Tajín instead of salt.

**Mezcal Margarita** — mezcal for tequila. Smoky, distinctive. Also works with a split mezcal + blanco tequila.

**Tamarind Margarita, Watermelon Margarita, etc.** — add fresh fruit or fruit purée. Reduce simple syrup proportionally.

**Skinny Margarita** — tequila + lime + agave + soda or a splash of triple sec. Fewer calories; also less flavor.

**Rim salt options:**
- Regular kosher salt (standard)
- Tajín (chile lime salt) — modern, spicy-citrus
- Black lava salt — dramatic presentation
- Smoked salt — for mezcal margaritas
- No salt (per customer request) — wet half of rim only

**Sell notes:**
- Best-value recipe: Espolón Blanco + fresh lime + Cointreau. Beats most bar margaritas.
- Customer wants sipping-quality Margarita: upgrade tequila to reposado (Fortaleza, Tapatío)
- Home party: recipe is infinitely scalable. Just pre-shake with crushed ice and serve.
- Don't use pre-made "margarita mix" — it's usually bottled lime + corn syrup. Fresh-lime margarita is transformatively better.

Fresh lime juice is non-negotiable. Period.
$md$, 'cocktails', 5, 2, true, true, null),

('Aperitivo & Spritzes', 'Aperol Spritz, Campari Spritz, Hugo — the Italian happy-hour template.', $md$
Aperitivo = Italian pre-dinner drinking tradition. Light, bitter, effervescent drinks that stimulate appetite. Low-alcohol (~11%), sessionable.

**Aperol Spritz** — the dominant spritz of the 2010s–2020s.
- 3 parts Prosecco (usually 3 oz)
- 2 parts Aperol (2 oz)
- 1 part soda (1 oz)
- Ice, orange slice garnish
- Served in a large wine glass

**Campari Spritz** — same template, Campari instead of Aperol. Drier, more bitter. The original spritz.

**Select Spritz** — Venetian classic, between Aperol and Campari in bitterness. Slightly herbal. The "local Venice" answer.

**Cynar Spritz** — Cynar (artichoke amaro) + Prosecco + soda. Earthy, less sweet.

**Hugo** — elderflower syrup or St-Germain + Prosecco + soda + mint + lime. German/Italian border origin. Floral, summery, grown-up.

**Negroni Sbagliato** — 1 oz Campari + 1 oz sweet vermouth + 2–3 oz Prosecco. Covered in the Negroni module.

**Americano** — 1 oz Campari + 1 oz sweet vermouth + soda. Low-alcohol predecessor to Negroni (2% ABV vs. 24%).

**Non-alcoholic alternatives:**
- Lyre's Italian Orange (Aperol alternative)
- Martini Vibrante (de-alcoholized vermouth)
- Sanbitter (Italian non-alcoholic bitter soda)

**Why Spritzes matter for retail:**
- Brunch staple
- Growing category ($Billion+ in the US)
- Entry-level "sophisticated" cocktail for new drinkers
- Perfect summer home-bar starter

**Sell notes:**
- Customer asks for "an Aperol Spritz": stock Aperol, Prosecco, soda water, oranges
- Gift: Aperol + Prosecco + orange = instant summer kit
- Customer finds Aperol too sweet: Campari Spritz
- Brunch host: case of Prosecco + Aperol + St-Germain = three classic spritzes from one shopping trip
- Winter aperitivo: Campari + blood orange instead of orange garnish

Italians drink these at 5pm. The timing matters culturally, but retail just cares they're drinking it.
$md$, 'cocktails', 6, 2, true, true, null),

('Classic Highballs', 'Gin & Tonic, Dark & Stormy, Paloma, Moscow Mule — the tall-glass templates.', $md$
Highball = spirit + long mixer (soda, tonic, ginger beer, etc.) served over ice in a tall glass. Simple, sessionable, food-friendly.

**Gin & Tonic:**
- 2 oz gin
- 4–5 oz tonic water
- Ice, lime wedge
- The quality of the tonic matters. Fever-Tree, Q Tonic, Jack Rudy are upgrades over Schweppes. Quinine aromatic.

Variations: cucumber (with Hendrick's), grapefruit (with Tanqueray No. Ten), rosemary sprig, Mediterranean tonic (Fever-Tree "Mediterranean") with pink peppercorn + lemon peel.

**Moscow Mule:**
- 2 oz vodka
- 4 oz ginger beer (not ginger ale — they're different)
- ½ oz lime juice
- Ice, lime wedge, copper mug (optional but iconic)
- Ginger beer brands that matter: Fever-Tree, Gosling's, Q. Avoid ginger ale (no kick).

Variations: **Mexican Mule** (tequila), **Kentucky Mule** (bourbon), **Dark 'n' Stormy** (Gosling's Black Seal rum — Bermuda-protected name).

**Dark & Stormy:**
- 2 oz Gosling's Black Seal dark rum (legal requirement in Bermuda and their US trademark)
- 4 oz ginger beer
- ½ oz lime
- Tall glass, ice, lime wedge

**Paloma** — Mexico's actual most popular tequila drink (not the Margarita).
- 2 oz blanco tequila
- 4 oz grapefruit soda (Jarritos, Squirt, Ting, or fresh grapefruit + soda + ½ oz lime + pinch salt)
- Tall glass, ice, salt rim optional

**Cuba Libre** — rum + cola + lime. Don't dismiss — classic, sessionable. Bacardi + Coca-Cola + lime.

**Whiskey Highball** — Japanese favorite. 1 oz Japanese whisky + 4 oz cold soda. Precise pour, huge ice, elegant. Toki Highball is a common order.

**Tom Collins** — gin + lemon + sugar + soda. Refreshing, classic. Also see: John Collins (bourbon), Vodka Collins, Pedro Collins (rum).

**Ranch Water** — modern Texas favorite. Blanco tequila + Topo Chico + lime. That's it. ~$12 to make a case at home.

**Sell notes:**
- Summer stockup: gin + tonic + limes is the universal summer drink kit
- Customer parties at home: highballs scale — no shaking, no precise measuring, everyone pours their own
- Gift: Fever-Tree gift pack (tonic + ginger beer + club soda) pairs with any base spirit
- Hot weather grab-and-go: Ranch Water or Paloma

Highballs teach ice matters. Crushed ice dilutes fast; large cube stays cold longer.
$md$, 'cocktails', 7, 2, true, true, null),

('Food & Drink Pairings', 'The pairing rules that actually work, and the ones to forget.', $md$
Pairing rules exist because they work often enough to be useful. But no pairing is universal. Here's the working knowledge.

**The three classic pairing principles:**

**1. Match intensity.** Light food (salad, white fish) with light drinks (Sauvignon Blanc, Pilsner). Rich food (braised short ribs, blue cheese) with rich drinks (Cabernet, Imperial Stout).

**2. Complement OR contrast.** Sweet Riesling with spicy Thai food (contrast — sweetness calms heat). Oaky Chardonnay with buttery lobster (complement — both rich).

**3. Regional pairing.** What grows together goes together. Tuscan red with Tuscan pasta. IPA with fish tacos (California). Rioja with paella (Spain).

**Red meat pairings:**
- Steak, ribeye: Napa Cab, Bordeaux Left Bank, Malbec, Syrah
- Lamb: Rioja, Bordeaux, Cabernet Franc, Zinfandel
- Duck: Pinot Noir (Burgundy or Oregon), Gamay (Beaujolais), lambic
- Pork: Pinot Noir, Riesling (off-dry), Grenache, American Pale Ale

**Fish and seafood:**
- Oysters: Muscadet, Chablis, Sancerre, dry Champagne, Guinness
- Salmon: Pinot Noir, Rosé, oaked Chardonnay, Gose
- Lobster: buttery Chardonnay (Meursault), Champagne, Belgian Witbier
- Shellfish generally: crisp, unoaked whites or light pilsners

**Spicy food:**
- Off-dry Riesling (tames heat)
- Sparkling wine (bubbles refresh)
- Mexican lager (familiar pairing)
- Aromatic whites (Gewürztraminer, Viognier)
- AVOID: high-tannin reds (intensify heat)

**Cheese:**
- Aged hard (Parmigiano, aged cheddar): Italian reds, Bourbon
- Soft bloomy (Brie, Camembert): Champagne, Pinot Noir, Chardonnay
- Washed rind (Epoisses, Taleggio): Belgian ales, Gewürztraminer
- Blue (Stilton, Roquefort): Sauternes, Port, Oatmeal Stout
- Goat (Chèvre, Crottin): Sauvignon Blanc (Sancerre is the classic)

**Desserts:**
- Chocolate: Port, Zinfandel, Imperial Stout, aged Bourbon, Amaro
- Fruit tarts: Moscato d'Asti, Sauternes, ice wine
- Cheesecake: Sauternes, Tokaji, fortified sweet wines
- Crème brûlée: Sauternes, Vin Santo, Tawny Port

**Universal "safe bets":**
- Champagne goes with almost anything (even fried chicken)
- Pilsner pairs with most savory food
- Off-dry Riesling bridges sweet-spicy divides
- Pinot Noir pairs with more food than any other red

**Sell notes:**
- Customer has a specific menu: ask about the protein first, then the sauce
- Hosting Thanksgiving: Oregon Pinot Noir + Riesling + Beaujolais covers 90% of traditional menus
- Hosting BBQ: Zinfandel, Syrah, IPA, fruity lager
- Hosting Italian night: Chianti for red sauce, Barbera for complex pasta, Vermentino for seafood

Don't overcomplicate it. "A wine the meal enjoys" is good enough 95% of the time.
$md$, 'cocktails', 8, 2, true, true, null);
