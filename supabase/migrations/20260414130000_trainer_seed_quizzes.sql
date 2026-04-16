-- Megan Trainer quiz seed — 2 questions per module, 88 total.
-- Looks up modules by title (is_seed=true uniquely identifies them).

with quizzes(title, position, question, opts, correct, expl) as (
  values

  -- ── WINE — FRANCE ──────────────────────────────────────────────────────
  ('Bordeaux Reds', 0, 'A customer wants a bold red under $60 for a special occasion. What''s the dominant Bordeaux grape on the Left Bank?', '["Pinot Noir","Cabernet Sauvignon","Grenache","Tempranillo"]'::jsonb, 1, 'Cabernet Sauvignon dominates Left Bank Bordeaux — bold, structured, built for aging. Perfect for a gift occasion.'),
  ('Bordeaux Reds', 1, 'Which Right Bank Bordeaux region is dominated by Merlot?', '["Pauillac","Margaux","Saint-Émilion","Saint-Julien"]'::jsonb, 2, 'Saint-Émilion and Pomerol on the Right Bank are Merlot-dominant. Pauillac, Margaux, and Saint-Julien are Left Bank, Cabernet-dominant.'),

  ('Burgundy — Pinot Noir', 0, 'What grape do red Burgundy wines use?', '["Cabernet Sauvignon","Syrah","Merlot","Pinot Noir"]'::jsonb, 3, 'All red Burgundy is 100% Pinot Noir. No blending — Burgundy is obsessed with expressing one grape in one place.'),
  ('Burgundy — Pinot Noir', 1, 'From the quality pyramid, which is the highest level of Burgundy?', '["Village","Bourgogne Rouge","Premier Cru","Grand Cru"]'::jsonb, 3, 'Grand Cru is the top, covering roughly 2% of vineyards. Order from bottom: Bourgogne Rouge → Village → Premier Cru → Grand Cru.'),

  ('French Chardonnay', 0, 'Which French Chardonnay style is known for being unoaked, steel-fermented, and flinty?', '["Meursault","Pouilly-Fuissé","Chablis","Chassagne-Montrachet"]'::jsonb, 2, 'Chablis is the classic unoaked Chardonnay — high-acid, mineral-driven, perfect with oysters. The Côte de Beaune wines are oaked and richer.'),
  ('French Chardonnay', 1, 'A customer wants buttery Chardonnay in a French style. Where should you point them?', '["Chablis","Mâconnais","Sancerre","Meursault"]'::jsonb, 3, 'Meursault is the benchmark for rich, oaky, buttery white Burgundy. Chablis is crisp and unoaked; Sancerre is a different grape (Sauvignon Blanc).'),

  ('Champagne & Sparkling', 0, 'What''s the main grape of Italian Prosecco?', '["Chardonnay","Glera","Macabeo","Pinot Noir"]'::jsonb, 1, 'Prosecco is made from Glera. Chardonnay and Pinot Noir are used in Champagne; Macabeo is a Cava grape.'),
  ('Champagne & Sparkling', 1, 'On a Champagne label, which term means the driest style?', '["Extra Dry","Demi-Sec","Brut Nature","Brut"]'::jsonb, 2, 'Brut Nature (or Zero Dosage) is bone-dry. Confusingly, "Extra Dry" is actually sweeter than Brut — a holdover from 19th-century labeling.'),

  ('Rhône Valley', 0, 'Which grape is 100% of Northern Rhône reds?', '["Grenache","Syrah","Mourvèdre","Cinsault"]'::jsonb, 1, 'Northern Rhône reds (Côte-Rôtie, Hermitage, Saint-Joseph) are 100% Syrah. Southern Rhône blends Grenache, Syrah, and Mourvèdre (GSM).'),
  ('Rhône Valley', 1, 'Châteauneuf-du-Pape is in which part of the Rhône?', '["Northern","Southern","Eastern","Coastal"]'::jsonb, 1, 'Châteauneuf-du-Pape is the flagship Southern Rhône appellation — Grenache-dominant GSM blends, up to 13 grapes allowed.'),

  ('Sancerre & Loire', 0, 'Which grape makes Sancerre and Pouilly-Fumé?', '["Chardonnay","Sauvignon Blanc","Chenin Blanc","Riesling"]'::jsonb, 1, 'Both are 100% Sauvignon Blanc. Pouilly-Fumé is across the river from Sancerre and has a smokier note from flinty soils.'),
  ('Sancerre & Loire', 1, 'A customer wants a cheap oyster wine. What Loire white fits best?', '["Vouvray","Chinon","Muscadet","Sancerre"]'::jsonb, 2, 'Muscadet (from the coast) is the classic cheap oyster wine — under $20, salty, mineral. Sancerre works too but costs more; Vouvray is Chenin; Chinon is red.'),

  -- ── WINE — USA ─────────────────────────────────────────────────────────
  ('Napa Cabernet', 0, 'Which Napa sub-region is known for "Rutherford dust" — classic dusty tannins?', '["Calistoga","Stag''s Leap District","Rutherford","Coombsville"]'::jsonb, 2, 'Rutherford Cabs, along with Oakville, are famous for the distinctive dusty tannin character that comes from the benchland gravelly soils.'),
  ('Napa Cabernet', 1, 'A customer wants a big, ripe "fruit bomb" Napa Cab. Where do you point them?', '["Stag''s Leap District","Coombsville","Calistoga","Carneros"]'::jsonb, 2, 'Calistoga and Howell Mountain are warmer and produce the ripest, boldest Napa Cabs. Stag''s Leap is more elegant; Coombsville is restrained.'),

  ('California Chardonnay', 0, 'What does malolactic fermentation ("ML") do to a Chardonnay?', '["Adds oak flavor","Converts sharp malic acid to soft lactic acid","Increases alcohol","Adds tropical fruit"]'::jsonb, 1, 'ML converts sharp green-apple malic acid into creamy lactic acid — that''s the classic "buttery" note in Chardonnay.'),
  ('California Chardonnay', 1, 'A customer says "I hate buttery Chardonnay." What Sonoma Coast producer could you recommend?', '["Rombauer","Cakebread","Kistler","Far Niente"]'::jsonb, 2, 'Kistler, Hanzell, Sandhi, and Ramey make restrained, steel-forward Chardonnays. Rombauer and Cakebread are the buttery icons.'),

  ('Oregon Pinot Noir', 0, 'Which Willamette Valley sub-AVA is famous for red volcanic "Jory" soils?', '["Eola-Amity Hills","Dundee Hills","Yamhill-Carlton","Ribbon Ridge"]'::jsonb, 1, 'Dundee Hills is the benchmark Oregon Pinot sub-AVA, defined by red Jory volcanic soils that give elegance and red-cherry character.'),
  ('Oregon Pinot Noir', 1, 'Which classic regional pairing is Oregon Pinot Noir famous for?', '["Bison steak","Salmon","Fried chicken","Cheeseburger"]'::jsonb, 1, 'Salmon is Oregon''s state fish and the classic pairing with Willamette Valley Pinot Noir — both local, both silky.'),

  ('Washington Reds', 0, 'Which Washington sub-region is famous for the most structured, biggest Cabernets?', '["Walla Walla","Columbia Valley","Red Mountain","Horse Heaven Hills"]'::jsonb, 2, 'Red Mountain''s southeast-facing slopes and extreme heat create the most structured, tannic Cabernets in the state.'),
  ('Washington Reds', 1, 'A customer loves Napa Cab but wants to save money. What Washington producer is a reliable quality/value pick?', '["Yellow Tail","Carlo Rossi","Columbia Crest Reserve","Franzia"]'::jsonb, 2, 'Columbia Crest Reserve, Chateau Ste Michelle Indian Wells, and Waterbrook all deliver Napa-quality structure at significantly lower prices.'),

  ('Sonoma Whites', 0, 'Which Sonoma region is well-known for Fumé Blanc (oaked Sauvignon Blanc)?', '["Dry Creek Valley","Russian River","Alexander Valley","Napa Valley"]'::jsonb, 0, 'Dry Creek Valley is the Sonoma home of Fumé Blanc — Ferrari-Carano''s Fumé Blanc is the style''s California icon. (Napa is a different county entirely.)'),
  ('Sonoma Whites', 1, 'A customer wants an aromatic white that isn''t sweet. What Rhône-style white should you suggest?', '["Chardonnay","Viognier","Pinot Gris","Riesling"]'::jsonb, 1, 'Viognier is aromatic (honeysuckle, apricot, peach) but dry. It''s grown in Sonoma and more prominently in Paso Robles (Tablas Creek, Cline).'),

  ('California Rosé', 0, 'Which of these is the classic Provence-style rosé everyone knows?', '["Sutter Home White Zinfandel","Whispering Angel","Beringer White Zin","Sofia Rosé"]'::jsonb, 1, 'Whispering Angel (Château d''Esclans) is the benchmark Provence-style dry pale rosé. Sofia is California; the others are the sweet pink-zin style.'),
  ('California Rosé', 1, 'How old is the oldest vintage rosé you should ever sell a customer?', '["4–5 years","2–3 years","1–2 years","5–10 years"]'::jsonb, 2, 'Rosé is best drunk fresh — ideally within 1–2 years of vintage. Older rosé loses its bright fruit character.'),

  -- ── WINE — WORLD ───────────────────────────────────────────────────────
  ('Australian Shiraz', 0, 'Which Australian region is the benchmark for big, rich Shiraz?', '["Clare Valley","Hunter Valley","Margaret River","Barossa Valley"]'::jsonb, 3, 'Barossa Valley is the benchmark — warm climate, rich Shiraz, Penfolds Grange country. Hunter Valley and Clare produce more elegant, cooler-climate styles.'),
  ('Australian Shiraz', 1, 'What does "GSM" on an Australian label typically stand for?', '["Grenache, Syrah, Mourvèdre","Grenache, Shiraz, Merlot","Gamay, Syrah, Muscat","Grange, Shiraz, Malbec"]'::jsonb, 0, 'GSM = Grenache, Syrah (= Shiraz), Mourvèdre — a Southern Rhône-style blend very common in McLaren Vale and Barossa.'),

  ('Argentine Malbec', 0, 'Where is the heart of Argentine Malbec production?', '["Patagonia","Mendoza","Salta","Córdoba"]'::jsonb, 1, 'Mendoza produces the majority of Argentina''s Malbec. High altitude, dry climate, and Andean meltwater define the region.'),
  ('Argentine Malbec', 1, 'How does higher altitude affect Malbec?', '["Riper, sweeter, less acid","More acid, more structure, violet/blueberry notes","Lower alcohol and lighter color","No significant impact"]'::jsonb, 1, 'Higher altitude = cooler nights = more acid retention, more floral/blue-fruit notes, more structure. Uco Valley Malbec is the classic example.'),

  ('Barolo — Italy', 0, 'Which grape makes Barolo?', '["Sangiovese","Montepulciano","Nebbiolo","Barbera"]'::jsonb, 2, '100% Nebbiolo. It''s considered the king of Italian red grapes — thin-skinned, high-acid, high-tannin, pale garnet color but massive structure.'),
  ('Barolo — Italy', 1, 'What grape is Barbaresco?', '["Sangiovese","Nebbiolo","Barbera","Dolcetto"]'::jsonb, 1, 'Same grape as Barolo — 100% Nebbiolo. Barbaresco is the neighboring region, with slightly earlier-drinking, lighter expressions.'),

  ('Spanish Rioja', 0, 'Which Rioja aging tier requires 2 years oak + 3 years bottle?', '["Crianza","Reserva","Gran Reserva","Joven"]'::jsonb, 2, 'Gran Reserva is the top tier — only made in top vintages. Reserva is 1 oak + 2 bottle; Crianza is 1 + 1; Joven has no oak aging.'),
  ('Spanish Rioja', 1, 'Which type of oak does traditional Rioja use, and what flavor does it give?', '["French oak — subtle spice","American oak — dill, coconut, sweet vanilla","Hungarian oak — toasted bread","Slavic oak — neutral"]'::jsonb, 1, 'Traditional Rioja uses American oak, famous for its dill, coconut, and sweet-vanilla notes. Modern producers have shifted to French oak for subtler flavors.'),

  -- ── SPIRITS ────────────────────────────────────────────────────────────
  ('Bourbon 101', 0, 'By law, what is the minimum percentage of corn in a bourbon mash bill?', '["25%","40%","51%","75%"]'::jsonb, 2, 'Bourbon must be at least 51% corn. The rest is usually rye (spicy) or wheat (softer, like Maker''s Mark). Everything else about bourbon — oak, proof — flows from that rule.'),
  ('Bourbon 101', 1, 'What does "Bottled in Bond" mean on a bourbon label?', '["Aged at least 2 years","Single distillery, 100 proof exactly, aged 4+ years","From Kentucky only","Single barrel"]'::jsonb, 1, 'Bottled in Bond = 4+ years old, 100 proof exactly, one distillery, one distillation season. Strict government-backed quality mark dating to 1897.'),

  ('American Rye Whiskey', 0, 'What''s the minimum rye percentage in an American Rye Whiskey mash bill?', '["25%","40%","51%","95%"]'::jsonb, 2, 'By law, rye whiskey must be at least 51% rye grain. However, "true high-rye" ryes (MGP-sourced Bulleit, Dickel, Templeton) are often 95% rye.'),
  ('American Rye Whiskey', 1, 'A customer says bourbon is "too sweet" for their Manhattan. What do you suggest?', '["Add more vermouth","Use a high-rye whiskey instead","Add bitters","Use Irish whiskey"]'::jsonb, 1, 'Rye is drier, spicier, more peppery than bourbon — the traditional choice for Manhattans. Rittenhouse, Bulleit Rye, or Sazerac Rye are all great picks.'),

  ('Scotch — Single Malt', 0, 'Which Scotch region is famous for peated, smoky whiskies?', '["Speyside","Highland","Islay","Lowland"]'::jsonb, 2, 'Islay (pronounced "EYE-la") is the famous peated region — Laphroaig, Lagavulin, Ardbeg, Bowmore. Speyside is generally soft and fruity; Lowland is light.'),
  ('Scotch — Single Malt', 1, 'What does "single malt" Scotch require?', '["100% malted barley from one distillery","Aged at least 10 years","From the Highlands only","Bottled at cask strength"]'::jsonb, 0, 'Single malt = 100% malted barley from one distillery. Age isn''t the defining criterion (12 years is common but not required).'),

  ('Scotch — Blended', 0, 'What is a blended Scotch?', '["Whiskies from multiple distilleries, malt + grain combined","A mix of bourbon and Scotch","100% grain whisky","Whisky aged in multiple casks"]'::jsonb, 0, 'Blended Scotch mixes malt whisky and grain whisky from multiple distilleries. 90% of Scotch sold worldwide is blended. Johnnie Walker, Dewar''s, Chivas.'),
  ('Scotch — Blended', 1, 'Which Johnnie Walker is the classic 12-year blend and widely respected?', '["Red Label","Black Label","Gold Label","Blue Label"]'::jsonb, 1, 'Johnnie Walker Black Label is the 12-year blended workhorse — a legitimately great whisky. Blue is the luxury prestige blend; Red is the basic base blend.'),

  ('Tequila & Mezcal', 0, 'What does "100% agave" mean on a tequila label?', '["Aged at least 1 year","Made only from blue agave — no added sugars or grain alcohol","Organic certification","Handmade"]'::jsonb, 1, '"100% agave" means the tequila contains no added sugar or grain alcohol. Tequila without this designation ("mixto") can be up to 49% other sugars.'),
  ('Tequila & Mezcal', 1, 'Which tequila aging category is aged 1–3 years in oak?', '["Blanco","Reposado","Añejo","Extra Añejo"]'::jsonb, 2, 'Añejo = 1–3 years oak aging. Blanco is unaged (or <2 months). Reposado is 2–12 months. Extra Añejo is 3+ years.'),

  ('Gin Essentials', 0, 'What is the one botanical that must legally dominate the flavor of gin?', '["Coriander","Juniper","Orange peel","Angelica"]'::jsonb, 1, 'Juniper must be the dominant flavor — this is the legal and definitional anchor of all gin. Everything else varies by distiller.'),
  ('Gin Essentials', 1, 'A customer wants a gin that isn''t juniper-forward. Which style should you recommend?', '["London Dry","Plymouth","New Western / Contemporary","Old Tom"]'::jsonb, 2, 'New Western / Contemporary gins (Hendrick''s, Aviation, Monkey 47) emphasize other botanicals over juniper. Classic styles are juniper-forward.'),

  ('Rum — Light & Dark', 0, 'What grape… sorry, what base ingredient makes Rhum Agricole different from most rum?', '["Brown sugar","Molasses","Fresh sugarcane juice","Corn"]'::jsonb, 2, 'Rhum Agricole uses fresh pressed sugarcane juice (not molasses), giving it a grassy, vegetal character. It''s made in Martinique, Guadeloupe, and Haiti.'),
  ('Rum — Light & Dark', 1, 'Which rum style is funky, pot-still, with banana and pineapple ester notes?', '["Spanish-heritage (Cuban-style)","English-heritage (Jamaican)","French-heritage (Agricole)","Naval rum"]'::jsonb, 1, 'Jamaican/English-heritage rums (Appleton, Smith & Cross, Hamilton) are pot-distilled and ester-rich — that''s the signature "funky" tropical character.'),

  ('Cognac & Brandy', 0, 'What does "VSOP" mean on a Cognac label?', '["Very Superior Old Pale — aged at least 4 years","Very Select Old Premium","Very Small Old Production","Vintage Special Oak Pale"]'::jsonb, 0, 'VSOP = Very Superior Old Pale, aged at least 4 years. VS is 2+ years; XO is 10+ years.'),
  ('Cognac & Brandy', 1, 'Which is France''s "other" brandy region, often a better value than Cognac?', '["Calvados","Armagnac","Chartreuse","Martell"]'::jsonb, 1, 'Armagnac, from Gascogne in southwest France, is often much better value than Cognac at equivalent age. Rustic, bolder, column-still tradition.'),

  ('Japanese Whisky', 0, 'Which two companies dominate Japanese whisky?', '["Nikka and Suntory","Yamazaki and Hibiki","Kirin and Sapporo","Chichibu and Mars"]'::jsonb, 0, 'Nikka (Yoichi, Miyagikyo) and Suntory (Yamazaki, Hakushu, Hibiki) are the two dominant producers. Chichibu is smaller and cult-status.'),
  ('Japanese Whisky', 1, 'Why is Japanese whisky currently so expensive and often allocated?', '["Cheaper ingredients","Production couldn''t scale to match sudden global demand","Government taxes","Strict legal restrictions"]'::jsonb, 1, 'Japanese whisky went global fast in the 2010s. Production is slow (long aging) and couldn''t keep up. Prices stayed elevated as a result.'),

  ('Irish Whiskey', 0, 'What uniquely Irish style uses a mix of malted and unmalted barley, triple-distilled in pot stills?', '["Single Malt","Blended","Single Pot Still","Grain Whiskey"]'::jsonb, 2, 'Single Pot Still is the uniquely Irish category. Examples: Redbreast, Green Spot, Yellow Spot, Powers Three Swallow. Spicy, creamy, complex.'),
  ('Irish Whiskey', 1, 'Irish whiskey is typically distilled how many times?', '["Once","Twice","Three times","Four times"]'::jsonb, 2, 'Most Irish whiskey is triple-distilled, making it lighter and smoother than twice-distilled Scotch. (Some Irish styles, like Connemara, are double-distilled.)'),

  ('Vodka Basics', 0, 'By US law, vodka must be:', '["Aged at least 2 years","Made from potatoes","Without distinctive character, aroma, taste, or color","From Russia or Poland"]'::jsonb, 2, 'US law requires vodka to be distilled to a neutral spirit — no distinctive character. Subtle differences exist based on base ingredient and water, but they''re subtle.'),
  ('Vodka Basics', 1, 'Which vodka brand is made from potatoes?', '["Grey Goose","Chopin","Ketel One","Absolut"]'::jsonb, 1, 'Chopin is the classic potato vodka — creamy, fuller body. Grey Goose is wheat; Ketel One is wheat; Absolut is wheat.'),

  ('Liqueurs & Amaro', 0, 'What is Campari?', '["A sweet orange liqueur","A bitter aperitif","An Italian coffee liqueur","A cream liqueur"]'::jsonb, 1, 'Campari is a bitter Italian aperitif — the key ingredient in Negronis and Americanos. Red color, intense bitter flavor, 24% ABV.'),
  ('Liqueurs & Amaro', 1, 'Which liqueur category is traditionally sipped after dinner as a digestif?', '["Orange liqueur","Amaro","Triple sec","Maraschino"]'::jsonb, 1, 'Amaro ("bitter" in Italian) is the classic after-dinner digestif category. Averna, Montenegro, Fernet-Branca, Amaro Nonino are all classic amari.'),

  -- ── BEER ───────────────────────────────────────────────────────────────
  ('IPA Styles Guide', 0, 'A customer says "IPAs are too bitter." What style should you suggest instead?', '["Double IPA","Hazy / New England IPA","West Coast IPA","Brut IPA"]'::jsonb, 1, 'Hazy/NEIPAs use the same hops but have much lower perceived bitterness — fruit-forward, soft, juicy. The standard recommendation for bitter-averse IPA newcomers.'),
  ('IPA Styles Guide', 1, 'Which hop gives tropical and passionfruit notes often found in Hazy IPAs?', '["Cascade","Citra","Simcoe","Chinook"]'::jsonb, 1, 'Citra is the tropical/juicy hop. Mosaic (blueberry) and Galaxy (passionfruit) are also common in hazy IPAs. Simcoe is piney; Chinook is resinous.'),

  ('Local Craft IPAs — Southeast', 0, 'Which Athens, GA brewery makes Tropicália, the flagship tropical IPA?', '["Terrapin","Creature Comforts","SweetWater","Scofflaw"]'::jsonb, 1, 'Creature Comforts''s Tropicália is the unofficial flagship Georgia IPA — mango, peach, tropical fruit, balanced bitterness. Widely available across the SE.'),
  ('Local Craft IPAs — Southeast', 1, 'Which Tampa brewery makes Jai Alai, the benchmark Florida IPA?', '["Funky Buddha","Cigar City","SweetWater","Tampa Bay Brewing"]'::jsonb, 1, 'Cigar City''s Jai Alai is the Florida IPA benchmark — bold grapefruit, pine, classic West-Coast influence. Distributed widely across the Southeast.'),

  ('Belgian Ales', 0, 'What makes Belgian ales distinctive vs. other beer styles?', '["High hop bitterness","Belgian yeast''s banana/clove esters and spicy phenolics","Added fruit","Low carbonation"]'::jsonb, 1, 'Belgian yeast is the defining feature — at warm fermentation it produces banana/pear esters and black-pepper phenolics. Not hop bitterness; not fruit additions.'),
  ('Belgian Ales', 1, 'Which Trappist style is dark, malty, with fig and raisin — typically 6–8% ABV?', '["Tripel","Dubbel","Witbier","Saison"]'::jsonb, 1, 'Dubbel = dark, malty, fig/raisin. Tripel = strong golden. Witbier = light wheat ale. Saison = dry farmhouse ale.'),

  ('Lagers & Pilsners', 0, 'What''s the main difference between German Pilsner and Czech Pilsner?', '["German is always stronger","German is crisper/hoppier; Czech is slightly maltier and fuller","Czech is dark","German is unfiltered"]'::jsonb, 1, 'German Pils is crisp, hop-forward, dry. Czech Pils (Pilsner Urquell, Budvar) has a slightly richer malt body and softer bitterness.'),
  ('Lagers & Pilsners', 1, 'What''s a "Helles" lager?', '["A dark lager","A wheat beer","A soft malt-forward Munich-style pale lager","A fruit lager"]'::jsonb, 2, 'Helles ("bright" in German) is the soft, malt-forward Munich-style pale lager. Bread crust, honey, low bitterness. Augustiner, Weihenstephaner, Hofbräu.'),

  ('Stouts & Porters', 0, 'What''s the main difference between a Milk Stout and an Imperial Stout?', '["Milk Stout uses lactose for sweetness; Imperial is much higher ABV","Imperial uses oats","Milk Stout is carbonated with CO₂","They''re the same"]'::jsonb, 0, 'Milk Stout adds lactose (milk sugar) for sweetness and texture; typically 5–6% ABV. Imperial Stouts are 8–12%+, much bigger, and usually don''t use lactose.'),
  ('Stouts & Porters', 1, 'Why is Guinness often served on nitro?', '["Higher ABV","Creamy head and smoother mouthfeel from nitrogen instead of CO₂","Legal requirement","Adds flavor"]'::jsonb, 1, 'Nitrogen (instead of CO₂) creates the characteristic creamy head and smoother, less-prickly mouthfeel. Originally a Guinness innovation.'),

  ('Sours & Goses', 0, 'What gives a Gose its characteristic flavor beyond the sourness?', '["Fruit puree","Salt and coriander","Oak aging","Added vinegar"]'::jsonb, 1, 'Gose is a tart wheat beer distinguished by added salt and coriander. Salt makes it uniquely savory compared to other sours.'),
  ('Sours & Goses', 1, 'What''s a Gueuze?', '["A blend of young and old lambic","A dark sour beer","A Belgian Dubbel","A fruit-flavored lager"]'::jsonb, 0, 'Gueuze is a blend of young and old spontaneously-fermented lambic, re-fermented in the bottle. Complex, effervescent, like Champagne with funk.'),

  ('Wheat Beers', 0, 'Which yeast-driven flavors are signature in a German Hefeweizen?', '["Hop bitterness and citrus","Banana and clove","Coffee and chocolate","Grapefruit and pine"]'::jsonb, 1, 'Hefeweizen yeast produces characteristic banana (isoamyl acetate) and clove (4-vinyl guaiacol) esters/phenols at warm fermentation.'),
  ('Wheat Beers', 1, 'What spice is traditionally used in Belgian Witbier?', '["Cinnamon","Coriander and orange peel","Star anise","Clove"]'::jsonb, 1, 'Belgian Witbier is flavored with coriander and orange peel (often dried bitter orange or curaçao peel). Hoegaarden defines the style.'),

  ('Reading a Beer Label', 0, 'What does "IBU" measure on a beer?', '["Alcohol by volume","Bitterness from hops","Original gravity","Color"]'::jsonb, 1, 'IBU = International Bitterness Units, measuring iso-alpha acid from hops. Note: perception of bitterness also depends on malt sweetness.'),
  ('Reading a Beer Label', 1, 'Why do hop-forward beers (IPAs) lose quality quickly?', '["Higher ABV degrades","Hop compounds oxidize and fade within 90 days","Bacteria contamination","Yeast continues fermentation"]'::jsonb, 1, 'Hop aromatics oxidize quickly — a fresh IPA at 30 days is noticeably better than one at 120 days. Always check packaging dates on hop-forward beers.'),

  -- ── COCKTAILS ──────────────────────────────────────────────────────────
  ('Old Fashioned', 0, 'Which syrup do many modern craft bartenders prefer in an Old Fashioned?', '["Maple syrup","Simple syrup","Demerara syrup","Honey syrup"]'::jsonb, 2, 'Demerara syrup (1:1 turbinado sugar + water) adds caramel richness that complements whiskey better than white-sugar simple syrup. Craft bartender default.'),
  ('Old Fashioned', 1, 'What''s the difference between a rye and a bourbon Old Fashioned?', '["Rye is aged longer","Rye is drier and spicier; bourbon is sweeter and rounder","Rye adds citrus","They''re the same"]'::jsonb, 1, 'Rye Old Fashioneds are classic NYC-style — drier, spicier, with black pepper notes. Bourbon versions are sweeter, rounder, often Louisville-style.'),

  ('Negroni & Variations', 0, 'What are the three components of a classic Negroni in equal parts?', '["Rye, sweet vermouth, Campari","Gin, Campari, sweet vermouth","Vodka, dry vermouth, Campari","Bourbon, Aperol, sweet vermouth"]'::jsonb, 1, 'Gin + Campari + sweet vermouth in equal 1:1:1 parts. Stirred, served over ice with an orange peel.'),
  ('Negroni & Variations', 1, 'What''s a "Boulevardier"?', '["Negroni with mezcal","Negroni with whiskey instead of gin","Negroni with dry vermouth","Negroni with prosecco"]'::jsonb, 1, 'A Boulevardier replaces gin with whiskey (usually bourbon or rye). Richer, warmer, more of a winter cocktail.'),

  ('Whiskey Sour Family', 0, 'What does adding egg white to a Whiskey Sour create?', '["Lower alcohol","A silky foam on top","A Boston Sour — creamy texture and visual foam","Sweetness"]'::jsonb, 2, 'Egg white + whiskey sour = "Boston Sour" — creamy texture, softer taste, and a distinctive foam top. Aquafaba (chickpea water) is a vegan substitute.'),
  ('Whiskey Sour Family', 1, 'What''s the key distinguishing feature of a "New York Sour"?', '["Rye instead of bourbon","A float of red wine on top","An absinthe rinse","Extra sugar"]'::jsonb, 1, 'A New York Sour is a whiskey sour with a ½ oz float of full-bodied red wine (Malbec, Shiraz) on top. Dramatic look, excellent taste.'),

  ('Martini & Variations', 0, 'Why is a Martini traditionally stirred, not shaken?', '["It dilutes less","Shaking causes cloudiness and over-dilution for clear spirit cocktails","Stirring is stronger","Tradition only"]'::jsonb, 1, 'Shaking clear spirit cocktails aerates them (cloudy) and adds too much dilution. Stirring creates the proper silky texture and temperature without cloudiness. Bond was wrong.'),
  ('Martini & Variations', 1, 'What does "dirty" mean in a Dirty Martini?', '["Aged longer","Includes olive brine","Extra vermouth","Shaken instead of stirred"]'::jsonb, 1, 'Dirty = olive brine added (¼–½ oz). Usually made with vodka by default. Savory, salty character. Garnish with 3 olives.'),

  ('Margarita Family', 0, 'What''s a "Tommy''s Margarita"?', '["Frozen margarita","No orange liqueur — uses agave syrup instead","Rum-based margarita","Margarita with Grand Marnier"]'::jsonb, 1, 'Tommy''s Margarita replaces the orange liqueur (Cointreau) with agave syrup. Cleaner, lets the tequila shine. Developed at Tommy''s Mexican Restaurant, SF.'),
  ('Margarita Family', 1, 'Why is fresh-squeezed lime juice always used in good Margaritas?', '["Bottled has no limes","Bottled lime juice loses flavor and adds preservative notes","Fresh is cheaper","Legal requirement"]'::jsonb, 1, 'Bottled lime juice is pasteurized and contains preservatives — it tastes flat and chemical compared to fresh. Fresh lime is transformative and non-negotiable.'),

  ('Aperitivo & Spritzes', 0, 'What''s the standard ratio for an Aperol Spritz?', '["1 part Prosecco : 2 parts Aperol : 3 parts soda","3 Prosecco : 2 Aperol : 1 soda","Equal parts","4 Prosecco : 1 Aperol"]'::jsonb, 1, 'The official ratio is 3 Prosecco : 2 Aperol : 1 soda. Served over ice in a large wine glass with an orange slice.'),
  ('Aperitivo & Spritzes', 1, 'What is an "Americano" cocktail?', '["Coffee with whiskey","Campari + sweet vermouth + soda","Long black espresso","A sour with American whiskey"]'::jsonb, 1, 'An Americano is Campari + sweet vermouth + soda — essentially a low-alcohol predecessor to the Negroni (no gin). ~2% ABV in a tall glass.'),

  ('Classic Highballs', 0, 'What''s the key ingredient difference between a Moscow Mule and a Dark ''n'' Stormy?', '["Vodka vs. dark rum","Ginger beer vs. ginger ale","Mug vs. glass","No difference"]'::jsonb, 0, 'Moscow Mule = vodka + ginger beer. Dark ''n'' Stormy = dark rum (specifically Gosling''s Black Seal) + ginger beer. Similar build, different spirit.'),
  ('Classic Highballs', 1, 'What grapefruit soda is traditionally used in a Paloma?', '["Squirt or Jarritos Toronja","Ting","Both A and B","Lemon-lime soda"]'::jsonb, 2, 'Both Squirt (USA) and Jarritos Toronja (Mexico) are classic Paloma mixers. Ting (Caribbean) works too. Mexican grapefruit sodas are perfect.'),

  ('Food & Drink Pairings', 0, 'A customer is serving spicy Thai food. What wine style works best?', '["Cabernet Sauvignon","Oaked Chardonnay","Off-dry Riesling","Dry red Rioja"]'::jsonb, 2, 'Off-dry Riesling is the classic spicy-food pairing — residual sweetness tames heat, high acid refreshes. Big tannic reds make spice worse.'),
  ('Food & Drink Pairings', 1, 'What''s the classic pairing for Sancerre (Sauvignon Blanc)?', '["Beef stew","Goat cheese","Chocolate cake","Steak"]'::jsonb, 1, 'Sancerre + goat cheese (chèvre) is the classic French countryside pairing — the wine''s mineral acidity cuts the cheese''s creamy tang perfectly.')

)
insert into public.quiz_questions (module_id, position, question, options, correct_index, explanation)
select m.id, q.position, q.question, q.opts, q.correct, q.expl
from quizzes q
join public.modules m on m.is_seed = true and m.title = q.title
on conflict do nothing;
