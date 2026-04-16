-- Rewrite key modules to the new educational standard:
-- History → Journey to America → Top Sellers with Prices → (Quiz follows)
-- Written as a master sommelier / certified bourbon steward would teach.

-- Irish Whiskey
update public.modules set content = $md$
**THE STORY**

Irish whiskey is the grandfather of all whiskey. Monks in Ireland were distilling "uisce beatha" (water of life) as early as the 1100s — centuries before Scotland. By the 1800s, Ireland was the world's largest whiskey producer, with over 30 distilleries running at full capacity.

Then came devastation. The Irish War of Independence, Prohibition in America (which killed exports), and two World Wars destroyed the industry. By the 1980s, only two distilleries remained in all of Ireland: Midleton (which makes Jameson) and Bushmills.

**HOW IT REACHED AMERICA**

Irish immigrants brought their love of whiskey to America in the 1800s. But it was Jameson's brilliant marketing push in the 1990s-2000s that reignited American interest. St. Patrick's Day became a commercial juggernaut, and Jameson rode the wave. Today Irish whiskey is the fastest-growing spirits category worldwide — from 2 distilleries in 1980 to over 40 operating today.

**WHAT MAKES IT DIFFERENT**

Most Irish whiskey is triple-distilled (Scotch is typically double), which creates a smoother, lighter spirit. Three distinct styles exist:

• **Single Pot Still** — uniquely Irish. Mix of malted + unmalted barley. Spicy, creamy, complex. This is the style sommeliers get excited about.
• **Single Malt** — 100% malted barley, one distillery. Like Scotch single malt but smoother.
• **Blended** — 90% of what you sell. Grain + malt whiskey combined. Easy, approachable.

**TOP SELLERS YOUR STAFF MUST KNOW**

1. **Jameson Original** — $30. The #1 Irish whiskey in the world. Smooth, vanilla, light fruit. The gateway bottle. Works neat, on ice, or in cocktails.

2. **Redbreast 12** — $75. The single pot still benchmark. Sherry-cask richness, baking spice, dried fruit, creamy mouthfeel. This is what you upsell Jameson drinkers into. "If you like Jameson, Redbreast will blow your mind."

3. **Bushmills 10** — $40. Single malt, honey and vanilla forward. The oldest licensed distillery (1608). Good for Scotch drinkers exploring Irish.

4. **Tullamore DEW** — $25. Triple-distilled blend. Lighter than Jameson, slightly sweeter. Budget-friendly alternative.

5. **Green Spot** — $65. Single pot still, originally made for one Dublin pub (Mitchell & Son). Apple, honey, toasted oak. A connoisseur's favorite.

**WHAT TO SAY ON THE FLOOR**

"Looking for something smooth? Jameson is the classic — $30 and everyone loves it. If you want to take a step up, Redbreast 12 at $75 is the bottle that converts casual whiskey drinkers into Irish whiskey fanatics."

"St. Patrick's Day gift? Jameson in a gift bag. Never wrong. Want to impress someone who already knows Jameson? Green Spot — they'll remember you for it."
$md$
where title = 'Irish Whiskey' and is_seed = true;

-- Bourbon 101
update public.modules set content = $md$
**THE STORY**

Bourbon is America's native spirit — literally. In 1964, Congress declared bourbon a "distinctive product of the United States." Its roots trace to the late 1700s when Scots-Irish settlers in Kentucky discovered that the local limestone-filtered water and abundant corn made exceptional whiskey.

The name "bourbon" likely comes from Bourbon County, Kentucky, though historians debate this. What's not debated: Kentucky's climate — hot, humid summers and cold winters — creates the dramatic barrel expansion and contraction that gives bourbon its distinctive caramel, vanilla, and oak character.

**THE LEGAL DEFINITION**

Bourbon isn't just marketing — it has the strictest legal definition of any American spirit:
1. Mash bill must be at least 51% corn
2. Aged in NEW charred American oak barrels (can never be reused for bourbon)
3. Distilled to no more than 160 proof
4. Entered the barrel at no more than 125 proof
5. Bottled at minimum 80 proof
6. No additives except water

**"Straight bourbon"** = aged at least 2 years. **"Bottled in Bond"** = aged 4+ years, one distiller, one distillation season, bottled at exactly 100 proof. The Bottled-in-Bond Act of 1897 was America's first consumer protection law.

**TOP SELLERS YOUR STAFF MUST KNOW**

1. **Buffalo Trace** — $25. The single most recommended bourbon in America. Vanilla, caramel, hint of orange peel. Works for everything: sipping, Old Fashioneds, gifting. This is your default answer to "what bourbon should I get?"

2. **Maker's Mark** — $28. Wheated bourbon (wheat replaces rye in the mash bill). Softer, rounder, slightly sweet. Red wax seal is iconic. "If you want something smooth, not spicy — this is it."

3. **Woodford Reserve** — $35. Double-distilled in copper pot stills. Rich, smooth, well-oaked. The go-to premium gift bourbon. Beautiful bottle.

4. **Wild Turkey 101** — $23. 101 proof, high-rye mash bill. The bartender's bourbon. Bold, spicy, stands up in any cocktail. Incredible value for the quality.

5. **Four Roses Small Batch** — $32. Blend of 4 different bourbon recipes from one distillery. Complex, fruity, floral. The "hidden gem" recommendation for customers who want something different.

**BONUS: THE "ALLOCATED" BOTTLES**

These are the ones customers will ask about but you probably can't get:
• **Pappy Van Winkle** (15, 20, 23 year) — $100-$300 retail, $1,000+ secondary market
• **Blanton's** — $65 retail (the horse-stopper cap)
• **Eagle Rare** — $35 retail (Buffalo Trace's 10-year)
• **Weller** (any expression) — same mash bill as Pappy

When someone asks for these: "We get limited allocations — I can put your name on the list. In the meantime, Buffalo Trace is from the same distillery as Pappy and drinks beautifully at $25."

**WHAT TO SAY ON THE FLOOR**

"Never had bourbon? Start with Buffalo Trace or Maker's Mark — both under $30 and universally loved."

"Making Old Fashioneds? Wild Turkey 101 — bartenders swear by it. Grab Angostura bitters and a jar of Luxardo cherries while you're here."

"Gift? Woodford Reserve in a box. $35, looks like $60, tastes like $70."
$md$
where title = 'Bourbon 101' and is_seed = true;

-- Scotch — Single Malt
update public.modules set content = $md$
**THE STORY**

Scotch whisky (no "e" — the Scottish spelling) has been distilled in Scotland since at least the 1400s. The earliest written record is from 1494: a tax record showing "eight bolls of malt to Friar John Cor wherewith to make aqua vitae."

For centuries, Scotch was a rough, rural spirit. The modern industry emerged in the 1800s when continuous distillation (for blends) made Scotch accessible worldwide, and the phylloxera epidemic destroyed French vineyards — sending brandy drinkers to whisky instead.

**THE FIVE REGIONS**

Scotland's whisky regions aren't just geography — they're flavor maps:

• **Speyside** (over half of all single malts) — sweet, fruity, honeyed. The approachable region. This is where beginners start and where most best-sellers live.

• **Highland** — the biggest, most diverse region. Can be light and floral (Glenmorangie) or bold and robust (Dalmore). Hard to generalize.

• **Islay** (pronounced "EYE-la") — the smoky island. Peated, maritime, medicinal. Love-it-or-hate-it whiskies. The region with the most passionate fans.

• **Campbeltown** — tiny (3 distilleries). Salty, briny, complex. Springbank is the star — whisky collectors worship it.

• **Lowland** — light, grassy, easy. Glenkinchie, Auchentoshan. Good gateway Scotch.

**HOW IT REACHED AMERICA**

Scottish immigrants brought whisky-making knowledge to America (which became bourbon and rye). But Scotch as a luxury import took off in the early 1900s through the "Scotch and soda" cocktail culture. Post-WWII, Scotch became the aspirational gentleman's drink. Johnnie Walker's "Striding Man" advertising campaign (1908-present) is one of the longest-running in history.

**TOP SELLERS YOUR STAFF MUST KNOW**

1. **Glenfiddich 12** — $45. The world's best-selling single malt. Pear, apple, honey, light oak. The safe recommendation for any Scotch beginner.

2. **Glenlivet 12** — $45. Speyside classic. Citrus, vanilla, tropical fruit. Slightly fruitier than Glenfiddich. Equally safe.

3. **Macallan 12 (Sherry Oak)** — $70. Rich, dried fruit, sherry, toffee. The prestige name in Scotch. Gift-ready. "The Macallan" carries weight.

4. **Lagavulin 16** — $85. The definitive peated Scotch. Deep smoke, sea salt, dried fruit, leather. Ron Swanson's Scotch (Parks & Rec). "For someone who wants smoky, this is the one."

5. **Balvenie 14 DoubleWood** — $65. Aged in bourbon casks, then finished in sherry casks. Honey, vanilla, dried fruit. A crowd-pleaser that impresses enthusiasts.

**THE PEAT QUESTION**

The #1 thing to ask any Scotch customer: "Do you like smoky, or not smoky?" This divides the entire category:
• **Not smoky** → Speyside (Glenfiddich, Glenlivet, Balvenie, Macallan)
• **A little smoky** → Highland Park 12, Talisker 10, Oban 14
• **Very smoky** → Lagavulin 16, Laphroaig 10, Ardbeg 10

**WHAT TO SAY ON THE FLOOR**

"First Scotch? Glenfiddich 12 or Glenlivet 12 — both $45, both gentle and approachable."

"Gift for a Scotch lover? Macallan 12 — the name alone says 'I put thought into this.' Or Balvenie 14 DoubleWood if they appreciate craft."

"You want the smoky stuff? Lagavulin 16 is the gold standard — $85 but you'll understand why after one sip."
$md$
where title = 'Scotch — Single Malt' and is_seed = true;

-- Update the quizzes to reference specific content from the rewritten modules

-- Irish Whiskey quiz updates
update public.quiz_questions set
  question = 'According to the module, what happened to the Irish whiskey industry by the 1980s?',
  options = '["Over 100 distilleries were running","Only 2 distilleries remained in all of Ireland","Ireland had banned whiskey production","Irish whiskey had become the world''s most popular spirit"]'::jsonb,
  correct_index = 1,
  explanation = 'By the 1980s, war, Prohibition, and economic devastation had reduced Ireland from 30+ distilleries to just 2: Midleton (Jameson) and Bushmills. Today there are over 40 again.'
where module_id = (select id from public.modules where title = 'Irish Whiskey' and is_seed = true)
  and position = 0;

update public.quiz_questions set
  question = 'Redbreast 12 is what style of Irish whiskey, and how much does it retail for?',
  options = '["Blended — $30","Single Malt — $50","Single Pot Still — $75","Grain Whiskey — $40"]'::jsonb,
  correct_index = 2,
  explanation = 'Redbreast 12 is a Single Pot Still Irish whiskey at $75. Single Pot Still (malted + unmalted barley, triple-distilled) is the uniquely Irish style that sommeliers get excited about.'
where module_id = (select id from public.modules where title = 'Irish Whiskey' and is_seed = true)
  and position = 1;

-- Bourbon 101 quiz updates
update public.quiz_questions set
  question = 'According to the module, what is the single most recommended bourbon in America and its price?',
  options = '["Maker''s Mark — $28","Jack Daniel''s — $25","Buffalo Trace — $25","Woodford Reserve — $35"]'::jsonb,
  correct_index = 2,
  explanation = 'Buffalo Trace at $25 is the default answer to "what bourbon should I get?" — vanilla, caramel, works for sipping and cocktails alike.'
where module_id = (select id from public.modules where title = 'Bourbon 101' and is_seed = true)
  and position = 0;

update public.quiz_questions set
  question = 'The module mentions "Bottled in Bond" bourbon. What are its specific legal requirements?',
  options = '["Aged 2+ years, 80 proof","Aged 4+ years, one distiller, one season, exactly 100 proof","Aged 10+ years, single barrel","Made only in Kentucky, 90 proof"]'::jsonb,
  correct_index = 1,
  explanation = 'Bottled in Bond = 4+ years old, 100 proof exactly, one distillery, one distillation season. The Bottled-in-Bond Act of 1897 was America''s first consumer protection law.'
where module_id = (select id from public.modules where title = 'Bourbon 101' and is_seed = true)
  and position = 1;

-- Scotch Single Malt quiz updates
update public.quiz_questions set
  question = 'According to the module, which Scotch region produces over half of all single malts and is described as "sweet, fruity, honeyed"?',
  options = '["Islay","Highland","Lowland","Speyside"]'::jsonb,
  correct_index = 3,
  explanation = 'Speyside produces over half of all single malts — sweet, fruity, honeyed, approachable. It''s where beginners start and where most best-sellers (Glenfiddich, Glenlivet, Macallan) live.'
where module_id = (select id from public.modules where title = 'Scotch — Single Malt' and is_seed = true)
  and position = 0;

update public.quiz_questions set
  question = 'The module names Lagavulin 16 as "the definitive peated Scotch." What is its retail price?',
  options = '["$45","$65","$85","$120"]'::jsonb,
  correct_index = 2,
  explanation = 'Lagavulin 16 retails for $85. Deep smoke, sea salt, dried fruit, leather. Also famously Ron Swanson''s Scotch on Parks & Recreation.'
where module_id = (select id from public.modules where title = 'Scotch — Single Malt' and is_seed = true)
  and position = 1;
