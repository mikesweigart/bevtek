-- Guided Logic Tree — inventory metadata columns.
--
-- The Gabby Guided Flow lets shoppers drill from broad category
-- (Wine/Spirits/Beer/Mixers) down to a short list of matching SKUs via
-- touch-button questions. Each node in the tree queries these columns.
--
-- All columns are nullable so existing stores don't break — Gabby falls
-- back to category/subcategory/tasting_notes when the richer columns are
-- unset. Owners can backfill over time via CSV or the inventory editor.

alter table public.inventory
  add column if not exists style            text[],   -- e.g. {cabernet, merlot}, {ipa, stout}
  add column if not exists flavor_profile   text[],   -- {fruity, oaky, spicy, crisp}
  add column if not exists is_local         boolean,
  add column if not exists intended_use     text[],   -- {gift, cocktail, sipping, bbq}
  add column if not exists hop_level        text,     -- 'low' | 'med' | 'high'
  add column if not exists sweetness        text,     -- 'dry' | 'off-dry' | 'sweet'
  add column if not exists body             text,     -- 'light' | 'medium' | 'full'
  add column if not exists proof            numeric,
  add column if not exists age_years        int,
  add column if not exists pack_size        int,
  add column if not exists description_short text,
  add column if not exists flavor_notes     text,
  add column if not exists is_staff_pick    boolean;

-- GIN indexes on the array columns make the matcher's `&&` overlap
-- queries O(n) on matching rows, not O(n) on the whole table.
create index if not exists inventory_style_gin           on public.inventory using gin (style);
create index if not exists inventory_flavor_profile_gin  on public.inventory using gin (flavor_profile);
create index if not exists inventory_intended_use_gin    on public.inventory using gin (intended_use);
create index if not exists inventory_staff_pick_idx      on public.inventory(store_id) where is_staff_pick;
