-- Canonical 12-bucket category grouping for inventory. Keeps the raw
-- `category` + `subcategory` + `varietal` columns intact (those power
-- the enrichment pipeline and search) — this new column is a stable
-- grouping for UI filter chips + promotion targeting.
--
-- Values are constrained by a CHECK so the app can trust the enum
-- without a FK to a separate table. The classifier in
-- lib/inventory/categoryGroup.ts is the only writer — owners don't edit
-- this field directly.

alter table inventory
  add column if not exists category_group text;

alter table inventory
  drop constraint if exists inventory_category_group_check;

alter table inventory
  add constraint inventory_category_group_check
  check (
    category_group is null
    or category_group in (
      'Beer & Cider',
      'RTDs & Hard Seltzers',
      'Whiskey & Whiskey-Based',
      'Vodka & Vodka-Based',
      'Rum & Rum-Based',
      'Tequila & Mezcal',
      'Gin & Gin-Based',
      'Liqueurs & Cordials',
      'Wine & Sparkling',
      'Non-Alcoholic Beverages',
      'Cigars & Tobacco',
      'General Non-Food'
    )
  );

create index if not exists idx_inventory_category_group
  on inventory (store_id, category_group)
  where category_group is not null;
