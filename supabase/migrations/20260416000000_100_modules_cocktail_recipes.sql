-- Expand Megan Trainer to 100 modules.
-- This migration adds 15 Popular Cocktail Recipe modules.
-- Each is an individual drink with history, ingredients, steps, tips.

-- Ensure the unique index for seed modules exists.
do $$ begin
  if not exists (select 1 from pg_indexes where indexname = 'modules_seed_title_uq') then
    create unique index modules_seed_title_uq on public.modules (title) where is_seed = true;
  end if;
end $$;

-- ============================================================================
-- POPULAR COCKTAIL RECIPES (15) — category_group = 'cocktail_recipes'
-- The top 15 most-ordered cocktails at US restaurants/bars.
-- ============================================================================

insert into public.modules (title, description, content, category_group, category, position, star_reward, duration_minutes, is_seed, is_published, store_id)
values

('Margarita', 'The #1 cocktail in America — tequila, lime, triple sec.', $md$
**The Margarita** is the most-ordered cocktail in the United States. Simple, refreshing, endlessly riffable.

**Classic recipe:**
- 2 oz blanco tequila (100% agave — Espolón, Casamigos, Patrón)
- 1 oz fresh lime juice (NEVER bottled)
- ¾ oz Cointreau (or ½ oz Cointreau + ¼ oz agave syrup)
- Salt rim (kosher salt, Tajín, or smoked salt)
- Lime wheel garnish

**Steps:**
1. Run a lime wedge around half the rim of a rocks glass
2. Dip in salt (half-rim, so the customer can choose salty or not)
3. Shake tequila, lime juice, and Cointreau with ice for 15 seconds
4. Strain over fresh ice in the prepared glass
5. Garnish with lime wheel

**Glassware:** rocks glass (on the rocks) or coupe (up)

**Variations your customers ask about:**
- **Tommy's Margarita** — agave syrup replaces Cointreau. Cleaner, lets tequila shine.
- **Spicy Margarita** — muddle 2-3 jalapeño slices before shaking. Rim with Tajín.
- **Mezcal Margarita** — sub mezcal for tequila. Smoky twist.
- **Frozen** — blend with ice. Use less citrus (blending dilutes).
- **Skinny** — tequila + lime + splash of agave + soda. Fewer calories.

**Pro tips:**
- Fresh lime juice is non-negotiable — bottled lime tastes flat and chemical
- Cointreau >> cheap triple sec (it's the #1 upgrade)
- Reposado tequila in a Margarita = oak-forward, slightly richer
- Pre-batched Margaritas: scale the recipe, shake individual servings to order

**Ingredients for your store to stock:** 100% agave blanco tequila, Cointreau, fresh limes, kosher salt, Tajín.
$md$, 'cocktail_recipes', 'Cocktails', 1, 2, 5, true, true, null),

('Espresso Martini', 'Coffee meets vodka — the cocktail that took over 2023-2026.', $md$
**The Espresso Martini** is the fastest-growing cocktail of the decade. Every restaurant serves it now.

**Classic recipe:**
- 2 oz vodka (Grey Goose, Ketel One, or Absolut)
- 1 oz fresh espresso (cooled slightly — hot espresso melts ice too fast)
- ½ oz coffee liqueur (Kahlúa or Mr Black)
- ½ oz simple syrup (adjust to taste)
- 3 coffee beans garnish

**Steps:**
1. Pull a fresh espresso shot and let it cool 1-2 minutes
2. Add vodka, espresso, coffee liqueur, and simple syrup to a shaker
3. Shake HARD with ice for 15-20 seconds (this creates the signature foam)
4. Double-strain into a chilled coupe or Nick & Nora glass
5. Drop 3 coffee beans on the foam (the tradition: health, wealth, happiness)

**Glassware:** coupe or Nick & Nora

**Why the hard shake matters:** espresso has natural oils that create a crema when agitated. A lazy shake = flat drink. A vigorous shake = thick, velvety foam top.

**Variations:**
- **Salted Caramel Espresso Martini** — add ¼ oz salted caramel syrup
- **Baileys Espresso Martini** — ½ oz Baileys instead of simple syrup
- **Rum Espresso Martini** — aged rum instead of vodka (think coffee + caramel)
- **Non-alcoholic** — Mr Black decaf or Lyre's Coffee Originale + espresso + syrup

**Mr Black vs. Kahlúa:** Mr Black is drier, more bitter, more "coffee-forward" — preferred by craft bartenders. Kahlúa is sweeter, more vanilla — preferred by customers who want dessert-in-a-glass. Stock both.

**Sell notes:** Customers making these at home need: vodka, coffee liqueur (upsell Mr Black), an espresso machine or Moka pot, and simple syrup. Gift basket opportunity.
$md$, 'cocktail_recipes', 'Cocktails', 2, 2, 5, true, true, null),

('Moscow Mule', 'Vodka, ginger beer, lime — and the copper mug.', $md$
**The Moscow Mule** launched vodka in America in the 1940s. The copper mug is iconic but optional.

**Classic recipe:**
- 2 oz vodka
- 4-5 oz ginger beer (NOT ginger ale — they're different)
- ½ oz fresh lime juice
- Lime wheel garnish

**Steps:**
1. Fill a copper mug (or highball glass) with ice
2. Add vodka and lime juice
3. Top with ginger beer
4. Stir gently once
5. Garnish with lime wheel

**Glassware:** copper Moscow Mule mug (traditional) or highball glass

**Ginger beer vs. ginger ale:** Ginger beer is brewed (often with real ginger), spicy, bold. Ginger ale is carbonated water with ginger flavoring — much milder. A Mule NEEDS ginger beer for the kick.

**Best ginger beers to stock:**
- **Fever-Tree** — premium, balanced, the crowd-pleaser
- **Gosling's** — strong ginger punch, pairs with dark rum too
- **Q Mixers** — clean, crisp, bartender favorite
- **Bundaberg** — Australian, very gingery, cult following

**Variations (the "Mule" family):**
- **Kentucky Mule** — bourbon instead of vodka
- **Mexican Mule** — tequila
- **Dark 'n' Stormy** — Gosling's Black Seal rum (trademarked name)
- **London Mule** — gin
- **Mezcal Mule** — smoky, unexpected, excellent

**Pro tips:**
- Copper mugs keep the drink colder longer (metal conducts cold)
- Don't use copper mugs lined with nickel if the customer has allergies — some cheap mugs do this
- Crushed ice = colder faster, more dilution. Large cubes = slower dilution.

**Store opportunity:** Sell copper mug gift sets + vodka + Fever-Tree ginger beer as a bundle.
$md$, 'cocktail_recipes', 'Cocktails', 3, 2, 5, true, true, null),

('Mojito', 'Rum, mint, lime, sugar, soda — Cuba''s greatest export.', $md$
**The Mojito** is the classic Cuban highball. Light, minty, crushable on a hot day.

**Classic recipe:**
- 2 oz white rum (Bacardi, Havana Club, Flor de Caña 4)
- 1 oz fresh lime juice
- ¾ oz simple syrup (or 2 tsp sugar)
- 8-10 fresh mint leaves
- 2-3 oz club soda
- Mint sprig + lime wheel garnish

**Steps:**
1. Place mint leaves in the bottom of a highball glass
2. GENTLY press (don't crush/muddle hard — you want the oils, not the bitter chlorophyll from shredded leaves)
3. Add lime juice and simple syrup
4. Fill glass with crushed ice
5. Pour rum over ice
6. Top with club soda
7. Stir briefly from the bottom up
8. Garnish with a mint sprig (slap the sprig between your palms first to release the aroma)

**Glassware:** highball glass

**The muddling mistake:** Most people destroy the mint. You want to PRESS gently — just enough to bruise the leaves and release oils. Over-muddling creates bitter, green-tinged drink.

**Variations:**
- **Coconut Mojito** — add 1 oz coconut cream
- **Strawberry Mojito** — muddle 3 strawberries with the mint
- **Mango Mojito** — 1 oz mango purée
- **Dark Rum Mojito** — float dark rum on top (Appleton, Myers's)
- **Virgin Mojito** — skip the rum. Still delicious.

**Pro tips:**
- Fresh mint is essential — dried mint doesn't work
- Crushed ice is traditional and correct (not cubed)
- If no crushed ice: fill a zip bag with cubes, wrap in a towel, smash with a rolling pin
- Rum quality matters less than lime + mint freshness here

**Store stock:** white rum, fresh limes, fresh mint (seasonal — suggest customers grow their own), simple syrup, club soda.
$md$, 'cocktail_recipes', 'Cocktails', 4, 2, 5, true, true, null),

('Daiquiri', 'Not the frozen kind — the real thing is rum, lime, sugar. That''s it.', $md$
**The classic Daiquiri** is one of the most perfect cocktails ever invented. Three ingredients, perfect balance.

**Classic recipe:**
- 2 oz white rum (Bacardi, Plantation 3 Star, Probitas, Banks 5)
- 1 oz fresh lime juice
- ¾ oz simple syrup

**Steps:**
1. Add rum, lime juice, and simple syrup to a shaker
2. Fill with ice and shake hard for 12-15 seconds
3. Fine-strain into a chilled coupe glass
4. Garnish with a lime wheel (optional — many bars serve with no garnish)

**Glassware:** coupe

**This is NOT a frozen strawberry thing.** The real Daiquiri is a shaken, strained, elegant cocktail. Hemingway drank them. JFK drank them. The frozen blender version is a different (perfectly fine) drink — but when a craft bar says "Daiquiri," this is what they mean.

**Variations:**
- **Hemingway Daiquiri (Papa Doble)** — 2 oz rum, ¾ oz lime, ½ oz grapefruit juice, ½ oz Luxardo Maraschino. No sugar. Dry, tart, complex.
- **Banana Daiquiri** — blend 2 oz rum + ½ banana + ¾ oz lime + ½ oz simple with ice
- **Strawberry Daiquiri** — blend with 4-5 fresh strawberries
- **Navy Grog** — multi-rum Daiquiri variant with honey and grapefruit

**Rum matters here.** In a Margarita, the tequila can hide behind lime and Cointreau. In a Daiquiri, the rum is front and center. This is where quality shows.

**Best rums for a Daiquiri:**
- Budget: Bacardi Carta Blanca ($15)
- Mid: Plantation 3 Stars ($22) — bartender's choice
- Premium: Probitas ($30) — Foursquare + Hampden blend, exceptional

**Sell notes:** "A Daiquiri is the cocktail that tells you how good a bartender (or a rum) really is." Push quality rum here — the upgrade is worth it.
$md$, 'cocktail_recipes', 'Cocktails', 5, 2, 5, true, true, null),

('Manhattan', 'Whiskey, sweet vermouth, bitters — the king of stirred cocktails.', $md$
**The Manhattan** is New York in a glass. Whiskey-forward, aromatic, stirred (never shaken).

**Classic recipe:**
- 2 oz rye whiskey (Rittenhouse, Bulleit Rye, or Wild Turkey 101 Rye)
- 1 oz sweet vermouth (Carpano Antica Formula or Cocchi Vermouth di Torino)
- 2 dashes Angostura bitters
- Luxardo maraschino cherry garnish (NOT neon-red cocktail cherries)

**Steps:**
1. Add rye, sweet vermouth, and bitters to a mixing glass
2. Fill with ice and stir for 20-30 seconds (until well-chilled)
3. Strain into a chilled coupe or Nick & Nora glass
4. Garnish with a Luxardo cherry (or brandied cherry)

**Glassware:** coupe or Nick & Nora

**Why rye, not bourbon?** Rye is the traditional choice — its spice and dryness balance the sweet vermouth. Bourbon makes a softer, sweeter Manhattan. Neither is wrong, but rye is classic.

**Vermouth is the upgrade.** The difference between a bad Manhattan and a great one is the vermouth. Carpano Antica Formula ($35) or Cocchi di Torino ($22) vs. bottom-shelf Martini & Rossi = night and day. ALWAYS refrigerate vermouth after opening (it's wine — it oxidizes).

**Variations:**
- **Perfect Manhattan** — ½ oz sweet vermouth + ½ oz dry vermouth
- **Rob Roy** — Scotch instead of rye (same proportions)
- **Boulevardier** — bourbon + Campari + sweet vermouth (1:1:1 like a Negroni)
- **Black Manhattan** — replace sweet vermouth with Averna amaro

**Cherry matters:** Luxardo Maraschino cherries ($22/jar) are THE cocktail cherry. Dark, syrupy, complex. Those bright-red "cocktail cherries" are artificially dyed and taste like candy. The upgrade from cheap to Luxardo is the single biggest visual + flavor improvement in a Manhattan.

**Sell notes for store:** Rye whiskey + Carpano Antica + Luxardo cherries = "Manhattan kit" gift bundle. Very giftable.
$md$, 'cocktail_recipes', 'Cocktails', 6, 2, 5, true, true, null),

('Cosmopolitan', 'Vodka, cranberry, lime, Cointreau — the 90s icon that never left.', $md$
**The Cosmopolitan** was made famous by Sex and the City but was invented by Toby Cecchini in 1987. It's a legitimate, well-balanced cocktail.

**Classic recipe:**
- 1½ oz citrus vodka (Absolut Citron is traditional)
- 1 oz Cointreau
- ½ oz fresh lime juice
- ½ oz cranberry juice (100% cranberry, not "cranberry cocktail")
- Orange peel garnish (flamed, if you want to show off)

**Steps:**
1. Add all ingredients to a shaker with ice
2. Shake for 10-12 seconds
3. Fine-strain into a chilled martini or coupe glass
4. Express an orange peel over the drink (twist it to spray the oils), then drop it in or balance on the rim

**Glassware:** martini glass (traditional) or coupe

**The cranberry juice secret:** Use 100% unsweetened cranberry juice (Ocean Spray has a "100% Cranberry" version, or use Lakewood Organic). The regular "cranberry juice cocktail" is mostly sugar water. Real cranberry juice is tart and makes a much better drink.

**Common mistakes:**
- Too much cranberry = too sweet, too red, too "punch bowl"
- No fresh lime = flat, one-dimensional
- Cheap triple sec instead of Cointreau = syrupy
- A Cosmo should be PINK, not RED — if it's dark red, there's too much cranberry

**Variations:**
- **White Cosmo** — white cranberry juice instead of red. Elegant, clear-pink.
- **Spiced Cosmo** — add a dash of cardamom bitters
- **Elderflower Cosmo** — St-Germain instead of Cointreau. Floral, modern.

**Store stock:** citrus vodka (Absolut Citron), Cointreau, 100% cranberry juice, fresh limes.
$md$, 'cocktail_recipes', 'Cocktails', 7, 2, 5, true, true, null),

('French 75', 'Gin, lemon, sugar, champagne — the most elegant cocktail on any menu.', $md$
**The French 75** is named after the French 75mm field gun from WWI — because it "hits you with the force of artillery." Gin + champagne is a dangerous combination.

**Classic recipe:**
- 1 oz gin (London Dry — Tanqueray, Beefeater, or Plymouth)
- ½ oz fresh lemon juice
- ½ oz simple syrup
- 3-4 oz dry champagne or sparkling wine (brut)
- Lemon twist garnish

**Steps:**
1. Shake gin, lemon juice, and simple syrup with ice
2. Strain into a champagne flute
3. Top with cold champagne
4. Garnish with a long lemon twist

**Glassware:** champagne flute (classic) or coupe (modern)

**Champagne vs. sparkling:** You don't need to use actual Champagne (save the $50 bottles for sipping). A good Cava ($12-15) or Crémant ($18-25) works perfectly and keeps the cost per drink reasonable.

**Variations:**
- **French 75 with cognac** — the original recipe actually used cognac, not gin. Both are correct historically.
- **French 77** — elderflower liqueur (St-Germain) instead of simple syrup
- **Rosé French 75** — rosé sparkling instead of brut. Pink, festive.
- **Non-alcoholic** — Seedlip Garden 108 + lemon + sparkling water

**When to recommend:** brunch, weddings, New Year's Eve, any celebration. It's the "grown-up mimosa."

**Sell notes:** Stock this as a "champagne cocktail kit" — gin + Cava + lemons. Less expensive than gifting a bottle of Champagne, more impressive than wine.
$md$, 'cocktail_recipes', 'Cocktails', 8, 2, 5, true, true, null),

('Mai Tai', 'The tiki classic — rum, lime, orgeat, curaçao. Not the neon pool drink.', $md$
**The Mai Tai** was created by Trader Vic in 1944. The real version is a sophisticated rum cocktail — nothing like the neon-orange syrupy thing served at resort pools.

**Classic recipe (Trader Vic original):**
- 1 oz aged Jamaican rum (Appleton Estate 12, Smith & Cross)
- 1 oz rhum agricole or other aged rum (Clément VSOP or Denizen Merchant's Reserve)
- ¾ oz fresh lime juice
- ½ oz orange curaçao (Pierre Ferrand Dry Curaçao is the best)
- ½ oz orgeat (almond syrup — Small Hand Foods or BG Reynolds)
- ¼ oz rich demerara syrup (optional, adjust sweetness)
- Spent lime shell + mint sprig garnish

**Steps:**
1. Add both rums, lime juice, curaçao, orgeat, and syrup to a shaker
2. Shake with ice for 15 seconds
3. Strain over crushed ice in a double rocks glass (or tiki mug)
4. Garnish with the squeezed lime shell and a big mint sprig

**Glassware:** double rocks glass or tiki mug

**Why two rums?** The split-base creates complexity. Jamaican rum brings funk and banana esters; agricole brings grassy, vegetal notes. Together they're more than the sum of parts.

**Orgeat is the secret ingredient.** It's an almond-based syrup that gives the Mai Tai its creamy, nutty, almost-tropical backbone. Without it, it's just a rum sour. Small Hand Foods makes an excellent one ($15). Or DIY: blend blanched almonds with sugar, water, and orange blossom water.

**Common mistakes:**
- Adding pineapple juice, orange juice, or grenadine — none of these are in a real Mai Tai
- Using only one cheap rum instead of a split base
- Skipping the orgeat (or using "almond extract" — NOT the same)

**Sell notes:** Mai Tai kit = two rums + orgeat + curaçao + limes. High ticket, multiple bottles, great margin.
$md$, 'cocktail_recipes', 'Cocktails', 9, 2, 5, true, true, null),

('Paloma', 'Mexico''s actual favorite tequila drink — not the Margarita.', $md$
**The Paloma** outsells the Margarita in Mexico. Simpler, more refreshing, and criminally underrated in the US.

**Classic recipe:**
- 2 oz blanco tequila (100% agave)
- ½ oz fresh lime juice
- Pinch of salt
- 4-5 oz grapefruit soda (Jarritos Toronja, Squirt, or Ting)
- Lime wedge garnish
- Salt rim (optional)

**Steps:**
1. Salt the rim of a highball glass (optional)
2. Fill with ice
3. Add tequila, lime juice, and salt
4. Top with grapefruit soda
5. Stir gently once
6. Garnish with lime wedge

**Glassware:** highball glass or Collins glass

**The fresh version (no soda):**
- 2 oz tequila
- 1½ oz fresh grapefruit juice
- ½ oz lime juice
- ½ oz simple syrup
- 2 oz club soda
- Shake everything except soda, strain over ice, top with soda

**Grapefruit sodas to stock:**
- **Jarritos Toronja** — Mexican classic, natural flavor, $1.50/bottle
- **Squirt** — the Texan staple. Slightly sweeter.
- **Ting** — Jamaican grapefruit soda. Tart, sharp, excellent.
- **San Pellegrino Pompelmo** — Italian, bitter grapefruit. Premium option.

**Why it's better than a Margarita (sometimes):** less work, lower ABV per glass, more refreshing in hot weather, and customers can make it with zero bartending skill. Tequila + grapefruit soda + lime + ice. Done.

**Ranch Water** is the Paloma's Texan cousin: tequila + Topo Chico + lime. Even simpler.

**Sell notes:** Stock grapefruit sodas near the tequila — the pairing is intuitive. "Making Palomas? Grab a Jarritos."
$md$, 'cocktail_recipes', 'Cocktails', 10, 2, 5, true, true, null),

('Piña Colada', 'Rum, coconut, pineapple — the beach in a glass.', $md$
**The Piña Colada** was born in Puerto Rico (it's the island's national drink). Done right, it's luscious and transportive.

**Classic recipe:**
- 2 oz white rum (Bacardi, Don Q Cristal, or Plantation 3 Stars)
- 3 oz pineapple juice (fresh is ideal, canned is fine)
- 1½ oz coconut cream (Coco López is the traditional brand)
- 1 cup crushed ice

**Steps (blended):**
1. Add rum, pineapple juice, coconut cream, and ice to a blender
2. Blend until smooth (~15 seconds)
3. Pour into a hurricane glass or large goblet
4. Garnish with pineapple wedge and/or maraschino cherry

**Steps (shaken, for a lighter version):**
1. Shake rum, pineapple juice, and coconut cream with ice
2. Strain over crushed ice in a tall glass
3. Garnish

**Glassware:** hurricane glass, tiki mug, or any large glass

**Coconut cream vs. coconut milk:** Coco López is sweetened coconut cream — thick, sweet, rich. Coconut milk (the can in the Asian aisle) is thin and unsweetened. You want CREAM for a Piña Colada. If you can't find Coco López, Real Coco cream works too.

**Variations:**
- **Dirty Piña Colada** — use aged rum (Appleton Estate, El Dorado 12) for a deeper, toasted flavor
- **Piña Colada Float** — pour blended colada, then float dark rum on top
- **Chi-Chi** — vodka instead of rum (for the rum-averse)
- **Virgin Piña Colada** — skip the rum. Still incredible.

**Frozen drink machine note:** If any of your store customers run a machine: Piña Colada is the #1 frozen cocktail after frozen Margarita. Pre-made mixes work but fresh is noticeably better.

**Sell notes:** rum + Coco López + pineapple juice as a bundle. Coco López is hard to find in regular grocery — stock it as a specialty item.
$md$, 'cocktail_recipes', 'Cocktails', 11, 2, 5, true, true, null),

('Negroni', 'Gin, Campari, sweet vermouth — equal parts, always.', $md$
**The Negroni** is the world's most debated cocktail — and it's three equal parts. No room to hide.

**Classic recipe:**
- 1 oz gin (London Dry — Tanqueray, Beefeater, Sipsmith)
- 1 oz Campari (non-negotiable — there is no substitute)
- 1 oz sweet vermouth (Carpano Antica Formula is the gold standard)
- Orange peel garnish

**Steps:**
1. Add gin, Campari, and sweet vermouth to a mixing glass
2. Fill with ice and stir for 20-25 seconds
3. Strain over a large ice cube in a rocks glass
4. Express an orange peel over the drink, then drop it in

**Glassware:** rocks glass with one large ice cube

**The three ingredients — and why each matters:**
- **Gin** provides the botanical backbone. London Dry is classic; try it with Hendrick's for a softer riff.
- **Campari** is the soul. Bright red, intensely bitter. If someone doesn't like Campari, they won't like a Negroni.
- **Sweet vermouth** provides roundness and sweetness to balance the bitter. Cheap vermouth = bad Negroni. Carpano Antica ($35) or Cocchi di Torino ($22) are worth the price.

**REFRIGERATE YOUR VERMOUTH.** It's wine. Once opened, store in the fridge. Lasts 4-6 weeks. Old vermouth ruins Negronis.

**Variations:**
- **Negroni Sbagliato** — prosecco instead of gin. Lighter, bubbly, brunch-friendly.
- **Boulevardier** — bourbon or rye instead of gin. Warmer, richer.
- **White Negroni** — gin + Suze + Lillet Blanc. No Campari.
- **Mezcal Negroni** — mezcal for gin. Smoky brilliance.

**Sell notes:** The Negroni kit (gin + Campari + sweet vermouth) is one of the best 3-bottle gift combos in the store. Add an orange and a large ice cube tray = complete gift under $80.
$md$, 'cocktail_recipes', 'Cocktails', 12, 2, 5, true, true, null),

('Aperol Spritz', 'The universal summer drink — Prosecco, Aperol, soda, orange.', $md$
**The Aperol Spritz** is the defining drink of the 2010s-2020s. Low-ABV, photogenic, crowd-pleasing.

**Classic recipe (3-2-1 ratio):**
- 3 oz Prosecco
- 2 oz Aperol
- 1 oz soda water (club soda)
- Orange slice garnish

**Steps:**
1. Fill a large wine glass with ice
2. Pour in the Prosecco
3. Add the Aperol
4. Top with soda
5. Stir gently once
6. Garnish with a big orange slice

**Glassware:** large wine glass (the classic Italian way) — NOT a flute, NOT a rocks glass

**ABV note:** An Aperol Spritz is roughly 8-11% ABV per glass — lower than most cocktails, closer to a glass of wine. That's part of its appeal: sessionable.

**Aperol vs. Campari:**
- **Aperol** = orange, gentian, mild bitterness. Approachable. 11% ABV.
- **Campari** = much more bitter, deeper red, 24% ABV. A Campari Spritz is the "grown-up" version.
- **Select** = Venetian aperitivo. Between Aperol and Campari in bitterness. The "local's choice" in Venice.

**Variations:**
- **Campari Spritz** — Campari instead of Aperol. More bitter, more adult.
- **Hugo** — elderflower syrup (or St-Germain) + Prosecco + soda + mint
- **Limoncello Spritz** — limoncello + Prosecco + soda
- **Negroni Sbagliato** — Campari + sweet vermouth + Prosecco

**Sell notes:** The Spritz aisle: Aperol ($25) + Prosecco ($12-18) + San Pellegrino or Fever-Tree club soda + oranges. Bundle as "Spritz Kit — $40." Massive summer seller. Stock heavily from April through September.

**Pro tip:** Pre-batch for parties. In a pitcher: 1 bottle Prosecco + ½ bottle Aperol + splash soda. Serve over ice with orange slices.
$md$, 'cocktail_recipes', 'Cocktails', 13, 2, 5, true, true, null),

('Whiskey Sour', 'The most forgiving cocktail template in existence.', $md$
**The Whiskey Sour** is the foundation of cocktail-making. Spirit + citrus + sweet. Master this and you understand 50% of all cocktails.

**Classic recipe:**
- 2 oz bourbon (Buffalo Trace, Woodford Reserve, Maker's Mark)
- ¾ oz fresh lemon juice
- ¾ oz simple syrup
- Optional: 1 egg white or 1 oz aquafaba (chickpea water) for foam
- Garnish: Angostura bitters drops on foam, Luxardo cherry

**Steps (without egg white):**
1. Shake bourbon, lemon juice, and simple syrup with ice
2. Strain into a rocks glass over fresh ice (or coupe, served up)
3. Garnish with cherry

**Steps (with egg white — "Boston Sour"):**
1. DRY SHAKE first: shake bourbon, lemon, simple, and egg white WITHOUT ice for 15 seconds (this builds the foam)
2. Add ice and shake again for 15 seconds
3. Strain into a coupe
4. Drop 3 dots of Angostura bitters on the foam, drag a toothpick through them for latte art effect

**Glassware:** rocks glass (on the rocks) or coupe (up, especially with foam)

**The foam changes everything.** Egg white (or aquafaba for vegan) gives the drink a silky, creamy texture and a visual wow-factor. It doesn't add egg flavor — the acid in lemon neutralizes it.

**Variations:**
- **New York Sour** — float ½ oz red wine on top. Dramatic, delicious.
- **Gold Rush** — honey syrup instead of simple. Warmer, more complex.
- **Penicillin** — Scotch + honey-ginger syrup + lemon + peated Scotch float. Modern classic.
- **Amaretto Sour** — amaretto + bourbon split + lemon + simple + egg white

**Why it's forgiving:** slightly too much lemon? The sugar balances it. Too much sugar? The lemon corrects it. Wrong proportions are hard to make truly bad with this template.

**Sell notes:** Bourbon + fresh lemons + Angostura bitters + simple syrup = home bar starter kit. Add egg white for the "fancy" version.
$md$, 'cocktail_recipes', 'Cocktails', 14, 2, 5, true, true, null),

('Tom Collins', 'Gin, lemon, sugar, soda — the original summer long drink.', $md$
**The Tom Collins** dates to the 1870s. It's a gin sour lengthened with soda water — light, tall, fizzy, perfect for a hot afternoon.

**Classic recipe:**
- 2 oz London Dry gin (Tanqueray, Beefeater, or Bombay)
- 1 oz fresh lemon juice
- ¾ oz simple syrup
- 3-4 oz club soda
- Lemon wheel + cherry garnish

**Steps:**
1. Add gin, lemon juice, and simple syrup to a shaker with ice
2. Shake briefly (~8 seconds — you want it cold but not over-diluted since the soda adds volume)
3. Strain into a tall Collins glass filled with ice
4. Top with club soda
5. Stir gently once from the bottom
6. Garnish with lemon wheel and a cherry

**Glassware:** Collins glass (tall, narrow) — literally named after this drink

**The Collins family:**
- **Tom Collins** = gin
- **John Collins** = bourbon
- **Vodka Collins** = vodka (also called a "Vodka Lemonade" essentially)
- **Pedro Collins** = rum
- **Juan Collins** = tequila
- **French 75** = gin Collins topped with champagne instead of soda (upgraded version)

**Why stock Collins-style:** They're easy to batch (just add soda to order), use base spirits you already stock, and customers find them approachable. "It's basically a fancy lemonade with gin."

**Pro tips:**
- Don't over-shake — the soda provides enough dilution
- Add soda LAST and stir gently — aggressive stirring kills the bubbles
- Use good soda water (Fever-Tree, Topo Chico) — flat soda = flat drink

**Sell notes:** Summer barbecue? Recommend gin + lemons + simple + soda. Every guest makes their own. Low effort, crowd-friendly.
$md$, 'cocktail_recipes', 'Cocktails', 15, 2, 5, true, true, null)

on conflict (title) where is_seed = true do nothing;
