-- Quiz questions for the final 15 modules (30 questions).
-- Grand total: 170 + 30 = 200 quiz questions across 100 modules.

with quizzes(title, position, question, opts, correct, expl) as (
  values
  ('Pinot Noir — A Global Tour', 0, 'Oregon Pinot Noir is closest in style to which other region?', '["Napa Valley","Burgundy","Australia","Chile"]'::jsonb, 1, 'Oregon Pinot Noir shares Burgundy''s earth + red-fruit + elegance profile. It''s the New World region most similar to Burgundy in style.'),
  ('Pinot Noir — A Global Tour', 1, 'A customer wants "fruity but not too heavy" Pinot Noir. Which region?', '["Burgundy","Oregon","California Sonoma Coast","New Zealand"]'::jsonb, 2, 'California Sonoma Coast Pinot is riper and fruitier than Burgundy/Oregon but still has elegance. The sweet spot for "fruity but not heavy."'),

  ('Sauvignon Blanc Around the World', 0, 'Which region''s Sauvignon Blanc is most restrained and mineral-driven?', '["New Zealand","California","Loire Valley (Sancerre)","Chile"]'::jsonb, 2, 'Loire Sauv Blanc (Sancerre, Pouilly-Fumé) is the most restrained: mineral, flinty, chalk, subtle citrus. NZ is the most explosive.'),
  ('Sauvignon Blanc Around the World', 1, 'A customer wants the best-value Sauvignon Blanc under $15. Which region?', '["Burgundy","Marlborough (New Zealand)","Sancerre","Napa Valley"]'::jsonb, 1, 'NZ Marlborough Sauv Blanc (Kim Crawford $14, Oyster Bay $12) offers distinctive quality at entry prices. Sancerre starts at $25+.'),

  ('Cabernet Sauvignon — A Global Tour', 0, 'Which country produces the best value Cabernet Sauvignon pound-for-pound?', '["France","USA","Chile","Australia"]'::jsonb, 2, 'Chile (Maipo, Colchagua) produces Cabernet that rivals $40+ wines from other regions at $10-25. Best value in Cab globally.'),
  ('Cabernet Sauvignon — A Global Tour', 1, 'Coonawarra in Australia is famous for Cabernet grown on what distinctive soil?', '["Volcanic rock","Limestone","Terra rossa (red soil)","Sandy loam"]'::jsonb, 2, 'Coonawarra''s "terra rossa" is a thin strip of red soil over limestone that produces minty, structured Cabernet Sauvignon unique to the region.'),

  ('Merlot — The Comeback', 0, 'What movie caused Merlot sales to drop in 2004?', '["The Godfather","Sideways","Bottle Shock","Somm"]'::jsonb, 1, 'In Sideways, Paul Giamatti''s character declares "I am NOT drinking Merlot!" — and real-world Merlot sales dropped 2% immediately.'),
  ('Merlot — The Comeback', 1, 'Which American Merlot is considered the benchmark?', '["Barefoot","Duckhorn Napa Valley Merlot","Yellow Tail","Bota Box"]'::jsonb, 1, 'Duckhorn Napa Valley Merlot (~$55) has been the American benchmark since 1978. Plum, cocoa, structured, age-worthy.'),

  ('Rosé — Year-Round, Not Just Summer', 0, 'How is rosé made?', '["Blending red and white wine","Short skin contact with red grapes (2-20 hours)","Adding food coloring to white wine","Fermenting pink grapes"]'::jsonb, 1, 'Rosé gets its color from brief contact between juice and red grape skins. Shorter contact = paler color. No blending (except in Champagne).'),
  ('Rosé — Year-Round, Not Just Summer', 1, 'Rosé is best consumed within how many years of the vintage?', '["5-10 years","3-5 years","1-2 years","10+ years"]'::jsonb, 2, 'Rosé is meant to be drunk fresh — within 1-2 years. Its bright fruit character fades quickly. Always sell the current vintage.'),

  ('German & Alsatian Riesling', 0, 'What does "Trocken" mean on a German wine label?', '["Sweet","Off-dry","Dry","Sparkling"]'::jsonb, 2, 'Trocken = dry. It''s the single most important label term for customers who say "I don''t want sweet Riesling."'),
  ('German & Alsatian Riesling', 1, 'Riesling is the best pairing for spicy food because:', '["High alcohol","Residual sweetness tames heat, high acid refreshes the palate","It''s red","Strong tannins"]'::jsonb, 1, 'Off-dry Riesling''s sugar calms capsaicin heat while its acid refreshes. This makes it the #1 wine for Thai, Indian, and Sichuan food.'),

  ('Wine Regions of Spain Beyond Rioja', 0, 'Ribera del Duero uses the same grape as Rioja (Tempranillo) but calls it:', '["Garnacha","Monastrell","Tinto Fino","Cariñena"]'::jsonb, 2, 'Tempranillo in Ribera del Duero is called "Tinto Fino" or "Tinta del País." Same grape, bolder style than Rioja — more Bordeaux-like.'),
  ('Wine Regions of Spain Beyond Rioja', 1, 'Albariño from Rías Baixas is the ideal pairing for:', '["Steak","Chocolate","Seafood — especially shellfish","Spicy food"]'::jsonb, 2, 'Albariño is crisp, saline, and citrusy — born on Spain''s Atlantic coast. It was made for seafood, especially oysters, shrimp, and grilled fish.'),

  ('Wine & Cheese Pairing', 0, 'What''s the classic pairing for goat cheese (chèvre)?', '["Cabernet Sauvignon","Sancerre (Sauvignon Blanc)","Port","Champagne"]'::jsonb, 1, 'Sancerre + chèvre is perhaps the most famous wine-cheese pairing in the world. Loire Valley goats + Loire Valley Sauvignon Blanc = centuries of co-evolution.'),
  ('Wine & Cheese Pairing', 1, 'Sweet + salty is a proven pairing principle. Which demonstrates it best?', '["Chardonnay + Cheddar","Sauternes + Roquefort (blue cheese)","Pinot Noir + Brie","Prosecco + Mozzarella"]'::jsonb, 1, 'Sauternes (honey-sweet) + Roquefort (salty, pungent blue) creates an electric contrast that''s one of wine''s greatest experiences.'),

  ('Bourbon Deep-Dive — Mash Bills & Flavor', 0, 'A "wheated bourbon" means:', '["Made entirely from wheat","Wheat replaces rye as the secondary grain — softer, sweeter profile","Served with wheat crackers","Aged in wheat barrels"]'::jsonb, 1, 'Wheated bourbons use wheat instead of rye after the corn. This creates a softer, sweeter, rounder whiskey. Maker''s Mark and Weller are the famous examples.'),
  ('Bourbon Deep-Dive — Mash Bills & Flavor', 1, 'Which cult-cheap bourbon has 80% corn and a devoted internet following?', '["Pappy Van Winkle","Blanton''s","Mellow Corn","Woodford Reserve"]'::jsonb, 2, 'Mellow Corn ($15, 80% corn, 100 proof, bottled in bond) has become an internet cult favorite. Sweet, simple, remarkably good for the price.'),

  ('Scotch — Peated vs. Unpeated', 0, 'Which Scotch region is famous for heavily-peated, smoky whiskies?', '["Speyside","Highland","Islay","Lowland"]'::jsonb, 2, 'Islay is the smoky island — home to Laphroaig, Lagavulin, Ardbeg, Bowmore, and Kilchoman. Not all Islay whiskies are peated, but most are.'),
  ('Scotch — Peated vs. Unpeated', 1, 'A customer wants to TRY smoky Scotch without going extreme. Best suggestion?', '["Laphroaig 10","Ardbeg Corryvreckan","Highland Park 12 — balanced smoke + honey","Octomore"]'::jsonb, 2, 'Highland Park 12 is the gateway peated Scotch — it balances honey and heather with moderate smoke. Not overwhelming, not absent. Perfect first step.'),

  ('Bourbon Cocktails — Beyond the Old Fashioned', 0, 'What cocktail uses equal parts bourbon, Aperol, Amaro Nonino, and lemon juice?', '["Boulevardier","Gold Rush","Paper Plane","Mint Julep"]'::jsonb, 2, 'The Paper Plane (Sam Ross, 2007) is ¾ oz each of bourbon, Aperol, Amaro Nonino, and lemon. Bittersweet, balanced, impressive.'),
  ('Bourbon Cocktails — Beyond the Old Fashioned', 1, 'A Gold Rush is essentially a Whiskey Sour with what substitution?', '["Rye instead of bourbon","Honey syrup instead of simple syrup","Grapefruit instead of lemon","Egg white is mandatory"]'::jsonb, 1, 'A Gold Rush replaces simple syrup with honey syrup (2:1 honey + water). Warmer, rounder, more complex than a standard Whiskey Sour.'),

  ('World Whiskey — Canada, India, Taiwan', 0, 'Amrut Fusion is a world-acclaimed single malt from which country?', '["Scotland","Japan","India","Taiwan"]'::jsonb, 2, 'Amrut (from Bangalore, India) produces Fusion — a blend of Indian and Scottish barley single malts. It''s won blind tastings against top Scotch.'),
  ('World Whiskey — Canada, India, Taiwan', 1, 'Kavalan whisky, which won "World''s Best Single Malt," is from:', '["Japan","South Korea","Taiwan","Thailand"]'::jsonb, 2, 'Kavalan from Taiwan won multiple world whisky awards. Tropical climate aging creates rapid, intense maturation — remarkable quality for a young distillery.'),

  ('Home Bar Essentials', 0, 'What are the 6 base spirits every home bar should have?', '["Vodka, gin, rum, tequila, bourbon, rye","Vodka, gin, rum, tequila, Scotch, brandy","Only bourbon and vodka","Gin, absinthe, mezcal, pisco, grappa, sake"]'::jsonb, 0, 'Vodka, gin, white rum, blanco tequila, bourbon, and rye cover virtually every classic cocktail. Everything else is a nice-to-have.'),
  ('Home Bar Essentials', 1, 'What''s the total approximate cost to set up a complete home bar from this module''s list?', '["$50-75","$150-200","$300-350","$500+"]'::jsonb, 2, '6 spirits + 5 modifiers + bitters + tools + fresh ingredients = approximately $300-350 total. A meaningful investment, but covers every classic cocktail.')

)
insert into public.quiz_questions (module_id, position, question, options, correct_index, explanation)
select m.id, q.position, q.question, q.opts, q.correct, q.expl
from quizzes q
join public.modules m on m.is_seed = true and m.title = q.title
on conflict do nothing;
