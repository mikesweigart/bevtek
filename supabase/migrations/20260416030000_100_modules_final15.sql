-- Final 15 modules to reach 100 total.
-- More granular wine + whiskey per user direction.

insert into public.modules (title, description, content, category_group, category, position, star_reward, duration_minutes, is_seed, is_published, store_id)
values

-- ── WINE — deeper cuts (8 more) ─────────────────────────────────────────

('Pinot Noir — A Global Tour', 'Burgundy vs. Oregon vs. New Zealand vs. California — same grape, four worlds.', $md$
Pinot Noir is the world's most terroir-expressive grape. It tastes completely different depending on where it's grown.

**Burgundy (France):** the gold standard. Earth, mushroom, dried cherry, iron, truffle. High acid, ethereal. Expensive ($30-$500+). Côte de Nuits for power, Côte de Beaune for finesse.

**Oregon (Willamette Valley):** red cherry, cranberry, forest floor. More fruit than Burgundy, less than California. Elegant, food-friendly. $25-80. Domaine Drouhin, Ponzi, Beaux Frères.

**New Zealand (Central Otago, Martinborough):** bright cherry, thyme, minerality. Cool-climate intensity. Often stunning value at $20-40. Felton Road, Ata Rangi, Craggy Range.

**California (Sonoma Coast, Santa Rita Hills, Anderson Valley):** riper, darker fruit. Plum, cola, sometimes vanilla from oak. Kosta Browne ($100+) is the prestige name; Au Bon Climat and Siduri offer quality at $25-45.

**The sommelier shortcut:** ask where the customer falls on the "earthy-to-fruity" spectrum. Earthy = Burgundy or Oregon. Fruity = California or NZ.

**Sell notes:**
- Salmon dinner: Oregon or NZ Pinot
- Mushroom risotto: Burgundy
- "I want fruity but not too heavy": California Sonoma Coast Pinot
$md$, 'wine_world', 'Wine', 11, 2, 5, true, true, null),

('Sauvignon Blanc Around the World', 'Loire vs. NZ vs. California vs. South Africa — four styles, one grape.', $md$
Sauvignon Blanc is the most style-diverse white grape. The same variety tastes radically different by region.

**Loire (Sancerre, Pouilly-Fumé):** mineral, flinty, chalk, restrained citrus. Bone-dry. Classic oyster wine. $25-45. Elegant, not showy.

**New Zealand (Marlborough):** explosive passionfruit, grapefruit, gooseberry, cut grass. High acid. The most distinctive version. $14-30. Kim Crawford, Cloudy Bay, Dog Point.

**California:** sits between Loire and NZ. More tropical than Loire, less aggressive than NZ. Often oak-touched ("Fumé Blanc"). $15-25. Honig, Duckhorn, Ferrari-Carano.

**South Africa (Western Cape):** tropical but with a green, herbal edge. Often excellent value. $10-18. Mulderbosch, Neil Ellis.

**Chile:** crisp, green, slightly herbal. Very affordable entry point. $8-14. Casillero del Diablo, Cono Sur.

**Sell notes:**
- Goat cheese: Sancerre (the classic) or any NZ Sauv Blanc
- Summer sipper: NZ (Kim Crawford, Oyster Bay) — refreshing, distinctive
- Food-versatile white: California Fumé Blanc — works with salads, chicken, fish
- Budget pick: Chile or South Africa — $10-14 for genuinely good wine
$md$, 'wine_world', 'Wine', 12, 2, 5, true, true, null),

('Cabernet Sauvignon — A Global Tour', 'Napa vs. Bordeaux vs. Chile vs. Australia — the king of reds.', $md$
Cabernet Sauvignon is the most widely-planted premium red grape in the world. It makes serious wine everywhere it grows.

**Bordeaux Left Bank (France):** blended (65-85% Cab, with Merlot, Cab Franc). Structured, cedar, tobacco, dark fruit. Ages 10-30 years. Pauillac, Margaux, Saint-Julien. $30-$500+.

**Napa Valley (California):** bolder, riper, more fruit-forward than Bordeaux. Blackcurrant, vanilla, chocolate. Often 100% Cab. $30-300. Silver Oak, Caymus, Opus One.

**Chile (Maipo, Colchagua):** excellent value. Ripe dark fruit, eucalyptus, mint. $10-25 for quality that rivals $40+ from other regions. Concha y Toro Don Melchor, Montes Alpha, Santa Rita.

**Australia (Coonawarra, Margaret River):** minty, eucalyptus, structured. Coonawarra is famous for its "terra rossa" red soil. $20-60. Wynns, Leeuwin, Cape Mentelle.

**South Africa (Stellenbosch):** Bordeaux-style at a fraction of the price. Rust en Vrede, Meerlust Rubicon. $20-50.

**Sell notes:**
- Steak: always Cabernet. Start with Napa or Bordeaux depending on the customer's style preference
- Value Cab: Chile (Maipo Valley $12-20) punches WAY above its price
- Gift: Napa Cab in a bag is never wrong
$md$, 'wine_world', 'Wine', 13, 2, 5, true, true, null),

('Merlot — The Comeback', 'Underrated since Sideways (2004) — here''s why it''s time to bring it back.', $md$
In 2004, the movie Sideways had a character say "I am NOT drinking Merlot!" Sales dropped 2% overnight and took a decade to recover. That was unfair. Merlot makes world-class wine.

**Why Merlot is great:**
- Softer tannins than Cabernet — more approachable young
- Plum, cherry, chocolate, herbs — crowd-pleasing flavors
- Exceptional from the RIGHT places

**Where Merlot shines:**
- **Bordeaux Right Bank (Pomerol, Saint-Émilion):** the greatest Merlots on Earth. Château Pétrus, Le Pin, Château Cheval Blanc — $200-$5,000. But village-level Saint-Émilion at $25-40 is excellent.
- **Washington State:** Columbia Valley and Horse Heaven Hills. DeLille, L'Ecole No. 41, Duckhorn Canvasback. $20-45.
- **California:** Duckhorn Napa Merlot ($55) is the American benchmark. Shafer, Pride Mountain.
- **Chile:** Colchagua Merlot. Soft, fruity, great value at $10-18.

**The "Sideways effect" takeaway:** Merlot's reputation problem was never about quality — it was about cheap, mass-market Merlot flooding the market in the 90s. Good Merlot (Right Bank Bordeaux, Washington, Duckhorn) has always been excellent.

**Sell notes:**
- Customer says "I don't like Merlot": hand them Duckhorn or a Saint-Émilion. They'll reconsider.
- Customer wants something softer than Cab: Merlot is the answer
- Pasta with red sauce: Right Bank Bordeaux or Washington Merlot
$md$, 'wine_world', 'Wine', 14, 2, 5, true, true, null),

('Rosé — Year-Round, Not Just Summer', 'Provence, Spain, California — and why limiting rosé to summer is a mistake.', $md$
Rosé is the fastest-growing wine category of the past decade. It's not seasonal — the French drink it year-round.

**How rosé is made:** red grapes, short skin contact (2-20 hours). The shorter the maceration, the paler the color. No blending of red + white (except in Champagne).

**Provence (France):** the template. Pale salmon, bone-dry, mineral, garrigue herbs, white peach. Domaines Ott, Miraval, Whispering Angel, Château d'Esclans. $15-50.

**Spain (Navarra, Rioja):** deeper pink, strawberry, slightly more body. Excellent value at $10-18. Often from Garnacha (Grenache). MUGA Rosado is a perennial favorite.

**California:** ranges from Provence-style (pale, dry) to fruit-forward (deeper pink, off-dry). Sofia (Coppola), Lorenza, Belle Glos Oeil de Perdrix.

**Italy:** Chiaretto from Lake Garda — crisp, mineral, cherry blossom. Bardolino rosé. Abruzzo rosé (Cerasuolo) — darker, more structured.

**Year-round pairing ideas:**
- Spring: rosé + asparagus, light salads
- Summer: rosé + grilled seafood, poolside
- Fall: darker rosé (Spanish, Cerasuolo) + Thanksgiving turkey
- Winter: rosé Champagne with celebration meals

**Sell notes:**
- Rosé is best fresh — current vintage always. Don't sell 2-year-old rosé.
- The #1 mistake: customers think all rosé is sweet (White Zin gave it a bad name). Show them dry Provence.
$md$, 'wine_world', 'Wine', 15, 2, 5, true, true, null),

('German & Alsatian Riesling', 'Dry, off-dry, sweet — the most misunderstood grape in the store.', $md$
Riesling is the most versatile food wine in the world. It can be bone-dry, off-dry, or lusciously sweet — and the label usually tells you which.

**German Riesling label decoder:**
- **Trocken** = dry
- **Halbtrocken / Feinherb** = off-dry
- **Kabinett** = light, often off-dry (8-10% ABV)
- **Spätlese** = riper, ranges from dry to sweet depending on producer
- **Auslese** = late harvest, usually sweet
- **Beerenauslese / Trockenbeerenauslese (TBA)** = dessert wine, very sweet, very expensive
- **Eiswein** = ice wine, intensely sweet

**Regions:** Mosel (slate soils, electric acid, delicate), Rheingau (fuller, more body), Pfalz (warmest, richest), Nahe (balanced, underrated).

**Alsace (France):** almost always dry. Fuller-bodied than German. Gewürztraminer is the other star here.

**Sell notes:**
- Spicy food (Thai, Indian): off-dry German Riesling (Kabinett or Spätlese) — sweetness tames heat, acid refreshes
- Sushi: dry Riesling from Alsace or Mosel Trocken
- The objection: "I don't like sweet wine" → "This one is dry (Trocken). Taste it." Riesling's reputation problem is entirely about the sweet assumption.
- Under $15 German Riesling: Dr. Loosen, Selbach-Oster, Dr. Hermann — all excellent
$md$, 'wine_world', 'Wine', 16, 2, 5, true, true, null),

('Wine Regions of Spain Beyond Rioja', 'Ribera del Duero, Priorat, Albariño, Cava — the new Spain.', $md$
Spain is the 3rd-largest wine producer and arguably the best value in the world right now.

**Ribera del Duero:** 100% Tempranillo (called "Tinto Fino" here). Bolder, darker, more structured than Rioja. Think Bordeaux-meets-Tempranillo. Vega Sicilia (the icon, $200+), Pesquera, Pago de los Capellanes, Aalto. $20-80 for excellent bottles.

**Priorat:** tiny, mountainous region in Catalonia. Old-vine Garnacha + Cariñena on slate (llicorella) soils. Massive, concentrated, mineral. Álvaro Palacios (L'Ermita is $500+, Camins del Priorat is $15). Clos Mogador, Clos Erasmus.

**Rías Baixas (Galicia):** 100% Albariño. Crisp, saline, citrus, almond. The ultimate seafood white from Spain's Atlantic coast. $15-25. Martín Códax, Do Ferreiro, Pazo de Señoráns.

**Cava:** Spanish sparkling, traditional method (like Champagne). Macabeo + Parellada + Xarel-lo. Exceptional value alternative to Champagne. $10-25. Freixenet, Codorníu, Gramona, Raventós i Blanc.

**Sherry (Jerez):** bone-dry to very sweet. Fino, Manzanilla (dry, salty — perfect aperitif). Amontillado, Oloroso, Palo Cortado (oxidative, nutty). Pedro Ximénez (PX — intensely sweet, poured on ice cream). Massively underrated.

**Sell notes:**
- Customer loves Napa Cab: try Ribera del Duero ($25-40) — similar power, different terroir
- Customer wants cheap Champagne alternative: Cava, always
- Seafood dinner: Albariño from Rías Baixas
$md$, 'wine_world', 'Wine', 17, 2, 5, true, true, null),

('Wine & Cheese Pairing', 'The classic pairings that never fail — and the science behind them.', $md$
Wine + cheese is the world's oldest luxury pairing. The science is simple: fat and protein in cheese coat the palate; acid and tannin in wine cut through and refresh.

**The rules that work:**

**1. Match intensity.** Mild cheese with light wine, strong cheese with big wine.

**2. "What grows together goes together."** French cheese with French wine, Italian with Italian, Spanish with Spanish. Centuries of co-evolution.

**3. Sweet + salty = magic.** Sauternes + Roquefort. Port + Stilton. The contrast is electric.

**Classic pairings:**
- **Aged Cheddar:** Cabernet Sauvignon, Zinfandel, Bourbon (yes, bourbon works)
- **Brie / Camembert:** Champagne, Pinot Noir, Chardonnay
- **Goat cheese (Chèvre):** Sancerre (Sauvignon Blanc) — THE pairing
- **Gruyère / Comté:** white Burgundy, Beaujolais, Alsace Pinot Gris
- **Parmigiano-Reggiano:** Chianti, Barolo, Lambrusco (sparkling red — the authentic local pairing)
- **Blue cheese (Stilton, Roquefort, Gorgonzola):** Sauternes, Port, late-harvest Riesling
- **Manchego:** Rioja (Spanish → Spanish), Cava, Tempranillo
- **Epoisses / washed rind:** Gewürztraminer, Belgian ales, Burgundy

**What to AVOID:**
- Very tannic reds with very creamy cheeses (tannin + fat = metallic taste)
- Delicate whites with pungent blue cheese (the cheese overwhelms)
- Over-thinking it. Most wine + most cheese = pretty good.

**Sell notes:** Cheese-and-wine night is the easiest dinner party to sell. Pick 4 cheeses + 4 wines. Done. Total spend: $60-100. Margin: excellent.
$md$, 'wine_world', 'Wine', 18, 2, 5, true, true, null),

-- ── WHISKEY — deeper cuts (4 more) ──────────────────────────────────────

('Bourbon Deep-Dive — Mash Bills & Flavor', 'High-rye vs. wheated vs. high-corn — why bourbon doesn''t all taste the same.', $md$
All bourbon is at least 51% corn, but the remaining 49% defines the flavor profile.

**High-rye bourbon (15-35% rye):** spicy, peppery, assertive. The "bartender's bourbon" — holds up in cocktails.
- Buffalo Trace (mashbill #1: ~10% rye)
- Four Roses (two mash bills: 20% and 35% rye)
- Bulleit (28% rye — high for bourbon)
- Wild Turkey 101 (13% rye)
- Old Grand-Dad (27% rye)

**Wheated bourbon (wheat replaces rye):** soft, sweet, round, caramel-forward. The "sipping" bourbon.
- Maker's Mark (~16% red winter wheat)
- Weller (same mashbill as Pappy Van Winkle)
- Larceny
- Rebel

**High-corn (75%+ corn):** sweet, simple, approachable. Often younger, budget-friendly.
- Mellow Corn (80% corn, 100 proof, cult following)
- Many bottom-shelf brands

**The flavor map:**
More rye → spicier, drier, baking spice, pepper
More wheat → softer, sweeter, bread, honey
More corn → sweeter, simpler, candy, vanilla

**Why this matters for customers:**
"I want something smooth for sipping" → wheated (Maker's, Weller, Larceny)
"I want something for Old Fashioneds" → high-rye (Four Roses SB, WT101)
"I want to try something different" → Mellow Corn ($15) — the internet's favorite cheap bourbon

**Age matters too:** 4-6 years = youthful, bright. 8-12 years = balanced, complex. 15+ years = heavy oak, tannic, divisive (not always better).
$md$, 'spirits', 'Spirits', 20, 2, 5, true, true, null),

('Scotch — Peated vs. Unpeated', 'The smoke question — and how to navigate it for customers.', $md$
"Do you like smoky Scotch?" is the single most important question when recommending Scotch. It divides the whisky world in half.

**What is peat?** Decomposed vegetation (moss, heather, grass) compressed over thousands of years. In Scotland, peat is burned to dry malted barley. The smoke infuses the grain with phenolic compounds = smoky flavor.

**Peat is measured in PPM (phenol parts per million):**
- 0-5 PPM = unpeated (most Speyside, Highland)
- 5-20 PPM = lightly peated (Highland Park, Talisker)
- 20-40 PPM = moderately peated (Caol Ila, Bowmore)
- 40-60 PPM = heavily peated (Laphroaig, Lagavulin, Ardbeg)
- 60+ PPM = extreme peat (Octomore by Bruichladdich — the world's most peated whisky)

**The unpeated side (no smoke):**
- Glenlivet 12, Glenfiddich 12: honey, apple, vanilla
- Macallan: sherry-forward, rich, dried fruit
- Balvenie DoubleWood 12: honey, vanilla, orange
- Glenmorangie Original: floral, creamy, easy

**The peated side (smoky):**
- Highland Park 12: balanced smoke + honey (great entry)
- Talisker 10: maritime smoke, pepper, sea salt
- Lagavulin 16: deep, complex, medicinal smoke ($85)
- Laphroaig 10: iodine, campfire, bandage (love-it-or-hate-it)
- Ardbeg 10: smoke + lemon + pepper (vibrant)

**Sell notes:**
- "I want to TRY smoky": Highland Park 12 — balanced, not overwhelming
- "I LOVE smoky": Lagavulin 16 or Ardbeg 10
- "I HATE smoky": anything Speyside. Glenlivet, Balvenie.
- "What's in the middle?": Talisker 10 or Oban 14
$md$, 'spirits', 'Spirits', 21, 2, 5, true, true, null),

('Bourbon Cocktails — Beyond the Old Fashioned', 'Mint Julep, Boulevardier, Paper Plane, Gold Rush — 5 more bourbon drinks.', $md$
The Old Fashioned gets all the attention. These five deserve equal fame.

**1. Mint Julep:**
2½ oz bourbon + ½ oz simple + 8-10 mint leaves + crushed ice. Build in a julep cup or rocks glass. The Derby Day classic. Gentle muddle, big crushed ice pile, mint bouquet garnish. Use a medium-proof bourbon (Woodford, Maker's).

**2. Boulevardier:**
1½ oz bourbon + 1 oz Campari + 1 oz sweet vermouth. Stirred, rocks glass, orange peel. The bourbon Negroni. Warmer, richer, more "winter evening." Any bourbon works; rye also works.

**3. Paper Plane:**
¾ oz bourbon + ¾ oz Aperol + ¾ oz Amaro Nonino + ¾ oz lemon juice. Equal parts, shaken, coupe. Invented by Sam Ross (2007). Bittersweet, citrusy, balanced, impressive. Requires Amaro Nonino (stock it).

**4. Gold Rush:**
2 oz bourbon + ¾ oz honey syrup (2:1 honey + hot water) + ¾ oz lemon juice. Shaken, rocks glass. A Whiskey Sour with honey instead of sugar. Warmer, rounder. Works with any bourbon.

**5. Brown Derby:**
2 oz bourbon + 1 oz fresh grapefruit juice + ½ oz honey syrup. Shaken, coupe. Named after the Hollywood restaurant. Tart, refreshing, underrated.

**Sell notes:**
Bourbon buyers should leave with an idea: "What are you making tonight?" leads to ingredient add-ons every time. Aperol + Amaro Nonino = Paper Plane kit. Honey + lemons = Gold Rush kit.
$md$, 'spirits', 'Spirits', 22, 2, 5, true, true, null),

('World Whiskey — Canada, India, Taiwan', 'Beyond Scotland, Ireland, America, and Japan.', $md$
The whiskey world extends far beyond the Big Four. Three countries are producing world-class whisky that most customers have never heard of.

**Canadian Whisky:**
Traditionally light, smooth, rye-forward blends. Often dismissed, but the top end is excellent.
- **Crown Royal** — the mainstream giant. Smooth, sweet. $25.
- **Lot 40** — 100% rye, copper pot-distilled. Spicy, complex. $35.
- **JP Wiser's 18** — aged blend, sophisticated. $50.
- **Canadian Club 100% Rye** — affordable, solid. $20.
- **WhistlePig** (Vermont) technically finishes Canadian rye — their 10-year ($75) is outstanding.

**Indian Whisky:**
India is the world's largest whisky market by volume. Most Indian whisky is molasses-based (not grain). But a few produce genuine single malt.
- **Amrut** (Bangalore) — tropical climate ages whisky 3× faster than Scotland. Amrut Fusion is spectacular ($65). Won worldwide blind tastings.
- **Paul John** (Goa) — rich, fruity, excellent quality. $55-80.
- **Rampur** — Indian single malt, increasingly available in the US.

**Taiwanese Whisky:**
- **Kavalan** (Taiwan) — the astonishing newcomer. Won "World's Best Single Malt" in 2015. Tropical aging creates rapid maturation. Kavalan Classic ($80), Solist series ($150+).

**Why these matter:** as Scotch and Japanese whisky get more expensive and harder to find, adventurous drinkers are looking elsewhere. Canada, India, and Taiwan offer genuine quality at often-better prices.

**Sell notes:**
- Scotch drinker wants to explore: Amrut Fusion or Kavalan Classic
- Japanese whisky too expensive: Canadian rye (Lot 40) or Kavalan
- "Something no one's heard of": Paul John Brilliance — conversation-starter guaranteed
$md$, 'spirits', 'Spirits', 23, 2, 5, true, true, null),

-- ── ONE MORE COCKTAIL + BEER + SPIRITS ──────────────────────────────────

('Home Bar Essentials', 'The 20 bottles, tools, and ingredients every home bartender needs.', $md$
A customer building a home bar from scratch needs guidance. Here's the definitive list.

**The 6 base spirits:**
1. Bourbon (Buffalo Trace, $25)
2. Rye (Rittenhouse, $28)
3. Gin (Tanqueray, $22)
4. Vodka (Tito's, $22)
5. Blanco tequila (Espolón, $25)
6. White rum (Bacardi, $15)

**The 5 modifiers/liqueurs:**
7. Sweet vermouth (Carpano Antica, $35 — REFRIGERATE)
8. Dry vermouth (Dolin, $15 — REFRIGERATE)
9. Cointreau ($35)
10. Campari ($28)
11. Simple syrup (make at home: 1:1 sugar + water)

**The bitters:**
12. Angostura ($10)
13. Orange bitters (Regans' or Fee Brothers, $10)

**The fresh ingredients:**
14. Lemons
15. Limes
16. Oranges (for peels)

**The tools:**
17. Shaker (Boston shaker or cobbler — $15-30)
18. Jigger (measuring — $8)
19. Bar spoon (for stirring — $8)
20. Strainer (Hawthorne — $10)

**Nice to have (phase 2):**
- Luxardo maraschino cherries ($22)
- Muddler
- Peeler (for citrus peels)
- Large ice cube tray
- Absinthe (for Sazerac rinses)
- St-Germain (elderflower — versatile)

**Total cost for the full starter kit:** ~$300-350 for everything listed above.

**Sell notes:** When a customer says "I'm setting up a home bar" — this is your chance for a $200+ sale. Walk them through the list. Most will buy 8-12 items in one trip.
$md$, 'sales_service', 'Sales', 11, 2, 5, true, true, null)

on conflict (title) where is_seed = true do nothing;
