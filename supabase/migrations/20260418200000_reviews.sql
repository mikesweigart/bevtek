-- Reviews Pass 3 — community review scores from Vivino / Untappd / Distiller.
--
-- Schema change only; the scraper + pipeline wiring lives in the app
-- layer (lib/enrichment/providers/reviews/). These columns hold the
-- final score + count + source so the shopper-facing surface (and
-- Gabby's prompt) can cite "4.3★ on Vivino (1,843 reviews)" without
-- needing to hit the provider at read time.
--
-- review_source matches the app-layer enum:
--   'vivino'    — wine
--   'untappd'   — beer / cider / hard seltzer
--   'distiller' — spirits
--
-- We leave room for future sources (retail_review, staff_pick) by
-- declining to add a CHECK constraint here — validation lives in the
-- TypeScript ReviewSource union, which is easier to evolve.

alter table inventory
  add column if not exists review_score numeric(3, 2),
  add column if not exists review_count integer,
  add column if not exists review_source text,
  add column if not exists review_url text;

-- Partial index so the shop page's "highest rated" sort + Gabby's
-- prioritization by review score stay fast on large catalogs.
create index if not exists idx_inventory_review_score
  on inventory (store_id, review_score desc nulls last)
  where review_score is not null;
