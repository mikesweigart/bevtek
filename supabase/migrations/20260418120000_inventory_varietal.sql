-- Varietal = grape / spirit type / beer style.
--
-- Our CSV imports arrive as a single ALL-CAPS `name` field
-- ("SUTTER HOME PINOT GRIGIO 1.5 L") with no separated brand, type,
-- or size. Before enrichment can find images / notes / reviews, we
-- need to parse those names into structured fields.
--
-- `varietal` is the primary *selector* Gabby uses when a customer
-- asks "what Pinot Grigio do you carry?" or "show me bourbons under
-- $40." The existing `category` column is too coarse (just wine /
-- beer / spirits / mixer); varietal is the next level down and is
-- populated by lib/enrichment/normalizeNames.ts.

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS varietal text;

-- Frequent filter target: "all Bourbon rows at this store."
CREATE INDEX IF NOT EXISTS idx_inventory_varietal
  ON inventory (store_id, varietal)
  WHERE varietal IS NOT NULL;
