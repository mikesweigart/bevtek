# Inventory Import & Enrichment — Spec

**Status:** design doc (not yet implemented)
**Scope:** how a store owner uploads a CSV, how we enrich each row so Gabby can recommend from it, the data model changes required, and how the enriched fields surface in Gabby's product detail view.
**Out of scope:** Gabby's decision tree or recommendation logic (already shipped — don't redesign).

---

## 1. Merchant-Facing CSV Upload UX

### 1.1 Where it lives

- **Entry point:** `apps/web/app/(app)/inventory/page.tsx`
  - Primary button in the header, next to the existing "Add item" control: **`📥 Upload inventory CSV`**
  - Also surfaced as a checklist item on the dashboard ("Upload your first inventory CSV → Gabby learns your catalog") so first-time owners are nudged there.

### 1.2 The upload modal / drawer

A slide-over drawer (not a full-page takeover — owners like to keep the current inventory list visible as a reference):

```
┌─────────────────────────────────────────────────────────┐
│  Upload your inventory                            ✕     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  One-time setup so Gabby can recommend your products.   │
│  Most imports take 1–3 minutes — we fetch images and    │
│  tasting notes for each bottle.                         │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │       📄  Drag your CSV here, or click to pick   │   │
│  │                                                  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  Not sure what a CSV should look like?                  │
│  ⬇ Download our sample template                         │
│                                                         │
│  What we need in your file                              │
│  • name           (required — the label)                │
│  • brand          (recommended)                         │
│  • size           (e.g. "750ml", "12 pk", "1.75L")     │
│  • category       (wine / beer / spirits / mixer)       │
│  • upc or sku     (optional — helps us match images)    │
│  • price          (optional)                            │
│  • stock_qty      (optional)                            │
│                                                         │
│  Columns we don't recognize are kept as-is — no harm.   │
│                                                         │
│  [ Upload & enrich ]                                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Copy rules:**

- Never say "SKU" alone without "UPC" — small owners know UPC, not SKU.
- Never mention scraping, OpenAI, or the enrichment provider. Owners see "we fetch images and tasting notes." That's it.
- The word "required" only appears next to `name`. Everything else is softened to "recommended" or "optional."

### 1.3 Sample template

Click **Download our sample template** → serves `bevtek-inventory-template.csv`:

```csv
name,brand,size,category,upc,price,stock_qty
"Silver Oak Cabernet Sauvignon",Silver Oak,750ml,wine,089832000012,89.99,12
"Tito's Handmade Vodka",Tito's,1.75L,spirits,619947000018,34.99,24
"Sierra Nevada Pale Ale",Sierra Nevada,"6 pk 12oz",beer,083783000011,10.99,40
```

Three rows covering the three most common categories so owners see the format for each.

### 1.4 Submission states

After clicking **Upload & enrich**:

#### State A — Validating (≤5 seconds)

```
┌──────────────────────────────────────┐
│  ⏳  Checking your file…              │
│                                      │
│  Making sure the columns line up     │
│  and rows are readable.              │
└──────────────────────────────────────┘
```

If the file fails validation (bad encoding, missing `name` column, zero rows), show errors **inline with row numbers**:

```
We couldn't import your file. Please fix these and try again:
  • Row 3: missing product name
  • Row 47: "category" must be wine / beer / spirits / mixer (got "winne")
  • 12 rows have blank prices — that's fine, we just wanted you to know.
```

#### State B — Importing (1–3 minutes, the long one)

```
┌──────────────────────────────────────────────────┐
│  ☕  Importing 248 items…                         │
│                                                  │
│  Usually takes 1–3 minutes — we're fetching      │
│  product photos and tasting notes. Feel free     │
│  to close this window, we'll email you when      │
│  it's done.                                      │
│                                                  │
│  ████████████░░░░░░░░░░░░  102 / 248  (41%)      │
│                                                  │
│  ✓ 89 enriched with photos + notes               │
│  • 13 still looking for a photo                  │
│                                                  │
│  [ Keep this open ]    [ Email me when ready ]   │
└──────────────────────────────────────────────────┘
```

- Progress is real — driven by a `import_jobs` row polled every 2 seconds.
- The "close this window" reassurance matters: most owners are using this at night and don't want to babysit.
- If the user closes the tab, a toast confirms: _"We'll keep importing in the background. Check your email in a few minutes."_

#### State C — Success

```
┌──────────────────────────────────────────────────┐
│  🎉  Your products are ready for Gabby.          │
│                                                  │
│  Imported: 248 items                             │
│  Ready for recommendations: 231                  │
│  Needs a quick review: 17  (see below)           │
│                                                  │
│  [ Take me to inventory ]                        │
└──────────────────────────────────────────────────┘
```

Below the primary CTA, an expandable **"Needs a quick review"** list:

```
These 17 items are in your catalog, but Gabby won't recommend
them until you add a photo or tasting notes:

  • Generic House Vodka — no photo found (add one in inventory)
  • Local Farm Cider — no tasting notes found
  • Unknown Red Blend — no photo, no notes
  … [show all]   [ Fix these now → ]
```

Clicking **Fix these now** deep-links to `/inventory?filter=incomplete` so the owner can edit in-place.

### 1.5 Warnings tier (rows we skipped entirely)

If >0 rows couldn't be imported at all (missing `name`, malformed UPC, etc.), surface them in a yellow banner above the success state:

```
⚠ 4 rows were skipped because they were missing a product name.
  Rows: 12, 55, 112, 203.  [ Download skipped rows as CSV ]
```

Never block the whole import on a few bad rows — fix-what-you-can is better than all-or-nothing.

---

## 2. Enrichment Behavior

For every successfully parsed row, we run the following pipeline in **three passes** per product. Each pass is idempotent so a partial failure can be retried.

### 2.1 Image lookup (Pass 1)

Priority order — stop at the first hit:

1. **Exact UPC match** against our image cache (`product_image_cache` table keyed on UPC). If we've enriched this UPC for another store before, we already have a hosted image. Instant hit.
2. **Exact UPC match** against an external provider (launch with **UPC Database API** or **CellarTracker** for wine; Open Food Facts as a fallback for beer/mixers).
3. **Fuzzy name + brand match** — our resolver normalizes `name + brand + size` ("Silver Oak Cab 750ml" → "Silver Oak Cabernet Sauvignon 750ml") and queries the same providers by text.
4. **LLM vision fallback** — if the store uploaded a photo themselves via an optional `image_url` column, we trust it verbatim.

Every fetched image is:

- Downloaded server-side (never hotlinked)
- Rehosted in Supabase Storage at `inventory-images/{store_id}/{item_id}.jpg`
- Resized to two sizes: `thumb` (240px) and `full` (960px)

**If nothing found:** `image_url` stays `NULL`. Item is flagged `source_confidence = 'none'`. Gabby will not recommend it (see §4.3).

### 2.2 Tasting notes (Pass 2)

Priority order:

1. **Provider match by UPC** — CellarTracker and Distiller have structured tasting notes for hundreds of thousands of SKUs. If the UPC hits, we take their notes verbatim and attribute the source in `metadata.tasting_notes_source`.
2. **Brand/product page scrape** — official producer sites often have flavor descriptions. We have an allowlist of ~200 well-known producer domains for this.
3. **LLM generation from known metadata** — last resort. We pass `{name, brand, category, style, region, vintage}` to a short, carefully-constrained prompt that returns ≤2 sentences in BevTek's voice. These are flagged `tasting_notes_source = "generated"` so staff can review them.

Output is normalized into two fields:

- `tasting_notes` — structured, ≤200 chars, used by Gabby's ranker and the product detail sheet.
- `summary_for_customer` — friendlier, ≤280 chars, Gabby uses this verbatim in "I'd pick this because…" copy.

**If nothing found AND generation fails:** both fields stay `NULL`. Item is `source_confidence = 'partial'` (image exists but no notes) and Gabby won't recommend it.

### 2.3 Ratings & reviews (Pass 3)

Best-effort. Priority:

1. **Aggregator lookups** — Vivino (wine), Untappd (beer), Distiller (spirits), by UPC then by fuzzy name.
2. **Normalized to a 5-star scale** regardless of the source (Untappd is 5-star already; Distiller is 100-point → divide by 20).
3. **Review summary** — 1–2 sentences. If the aggregator exposes them we use their top review. Otherwise we skip — we never fabricate reviews.

Writes:

- `average_rating` numeric(3,2) — e.g., `4.32`
- `review_count` int
- `review_summary` text (optional)
- `review_source` text — `'vivino' | 'untappd' | 'distiller' | null`

**If nothing found:** all three fields stay `NULL`. Gabby still recommends the product (ratings are the bonus signal, not the bar).

### 2.4 "Gabby-ready" criteria

A product is eligible for Gabby recommendations when **all** of these are true:

| Field             | Requirement                                       |
| ----------------- | ------------------------------------------------- |
| `name`            | non-empty                                         |
| `category`        | one of `wine`, `beer`, `spirits`, `mixer`, `garnish` |
| `image_url`       | non-null AND the image loads (HEAD check on save) |
| `tasting_notes`   | non-null AND ≥20 chars                            |
| `is_active`       | true                                              |
| `stock_qty`       | `> 0` (out-of-stock items are hidden from Gabby; staff can still hold-request them) |

Nice-to-have (weights the ranker but not required):

- `summary_for_customer`
- `average_rating` + `review_count ≥ 5`
- `source_confidence ∈ ('high', 'verified')`

This is encoded in a single SQL view:

```sql
create or replace view public.gabby_ready_inventory as
select *
from public.inventory
where is_active = true
  and stock_qty > 0
  and name is not null
  and category in ('wine','beer','spirits','mixer','garnish')
  and image_url is not null
  and tasting_notes is not null
  and length(trim(tasting_notes)) >= 20;
```

The `/api/gabby/recommend` endpoint switches its `FROM public.inventory` → `FROM public.gabby_ready_inventory` as a one-line change.

---

## 3. Product Data Model

### 3.1 Current shape (from `public.inventory`)

Already present:

```
id, store_id, sku, name, brand, category, subcategory,
size_ml, abv, price, cost, stock_qty, description,
tasting_notes, metadata jsonb, is_active, updated_at, created_at
```

Plus fields added earlier for the guided tree: `style text[]`, `flavor_profile text[]`, `is_local`, `intended_use text[]`, `hop_level`, `sweetness`, `body`, `proof`, `age_years`, `pack_size`, `description_short`, `flavor_notes`, `is_staff_pick`, `image_url`.

### 3.2 Fields to add for enrichment

| Column                   | Type             | Purpose                                                                 |
| ------------------------ | ---------------- | ----------------------------------------------------------------------- |
| `upc`                    | text             | Raw UPC from the CSV. Indexed. Enables cross-store image cache hits.    |
| `size_label`             | text             | Human-readable "750ml" / "12 pk 12oz" — what we show the customer.       |
| `summary_for_customer`   | text             | Friendly ≤280 char blurb Gabby says out loud.                           |
| `average_rating`         | numeric(3,2)     | 0.00–5.00                                                               |
| `review_count`           | int              |                                                                         |
| `review_summary`         | text             | 1–2 sentences quoted from the source.                                   |
| `review_source`          | text             | `'vivino' \| 'untappd' \| 'distiller' \| null`                          |
| `source_confidence`      | text             | `'verified' \| 'high' \| 'medium' \| 'low' \| 'partial' \| 'none'`      |
| `enriched_at`            | timestamptz      | When the last enrichment pass completed. Null = never enriched.         |
| `enrichment_version`     | int              | Bump when we change the pipeline so we can reprocess old items.         |

`source_confidence` legend:

- `verified` — UPC match in our internal cache, image + notes both sourced
- `high` — UPC match to external provider for both image and notes
- `medium` — UPC match for one, fuzzy match for the other
- `low` — fuzzy match for both, or LLM-generated notes
- `partial` — image OR notes missing (not Gabby-eligible)
- `none` — both missing (not Gabby-eligible)

### 3.3 Which fields Gabby uses

| Field                  | Where Gabby uses it                                                       |
| ---------------------- | ------------------------------------------------------------------------- |
| `name`, `brand`        | Card header, voice line: _"You'll want the Silver Oak Cabernet."_         |
| `size_label`           | Card subtitle                                                              |
| `image_url`            | **Required** — the hero of the card                                        |
| `tasting_notes`        | **Required** — feeds the ranker's semantic match; shown under image        |
| `summary_for_customer` | Gabby's spoken line: _"I'd pick this because…"_. Falls back to `tasting_notes` |
| `average_rating` + `review_count` | Trust badge: _"4.3★ · 120 reviews"_                             |
| `review_summary`       | Expandable "What people say" section                                       |
| `source_confidence`    | Internal only — the ranker de-boosts `low` and hides `partial`/`none`      |

---

## 4. Connection to Gabby's Recommendation Flow

No changes to the decision tree or the ranker's inputs — just the product detail sheet and the query source.

### 4.1 Query source

`/api/gabby/recommend` changes one line:

```ts
// before
.from("inventory")
// after
.from("gabby_ready_inventory")
```

All existing filters (category, style_any, flavor_any, price_min/max, etc.) work unchanged because the view is a pure subset of `inventory` with the same columns.

### 4.2 Product detail sheet (mobile `ProductDetailModal`, web `/s/[slug]/product/[id]`)

Revised layout, top to bottom:

```
┌──────────────────────────────────────────────┐
│                                              │
│          [ 🖼 product image — full width ]    │
│                                              │
├──────────────────────────────────────────────┤
│  SILVER OAK                                  │  ← brand, uppercase muted
│  Cabernet Sauvignon                          │  ← name, bold
│  750ml · $89.99 · In stock                   │  ← size_label + price + stock
│                                              │
│  ★★★★☆  4.3   ·   120 reviews                │  ← only if we have them
│                                              │
│  TASTING NOTES                               │
│  Dark cherry, cocoa, and toasted oak.        │
│  Structured tannins with a long finish.      │  ← tasting_notes
│                                              │
│  💬  Gabby says                              │
│  "If you like bold reds that feel like       │
│   a steak dinner, this is the one."          │  ← summary_for_customer
│                                              │
│  ▸ What people say                           │  ← collapsed by default
│    (expands review_summary)                  │
├──────────────────────────────────────────────┤
│  [🛎️ Request hold]  [🛒 Add to cart]         │
│  [🎯 I found it]    [↺ More options]         │
│                                              │
└──────────────────────────────────────────────┘
```

Rendering rules:

- **No image → don't render the card at all.** Upstream the view already excluded the row; this is defense in depth.
- **No tasting notes → don't render.** Same reason.
- **No rating → hide the star row entirely** (no empty-star placeholder).
- **No `summary_for_customer` → fall back to the first sentence of `tasting_notes`** in the "Gabby says" box, since we already guaranteed tasting_notes exists.
- **`source_confidence = 'low'`** → small muted footer: _"Details auto-matched — flag if inaccurate."_ Staff gets a flag action; customers just see the note.

### 4.3 Guaranteed contract for Gabby

Gabby will **never** show a product that is missing:

1. A product image, OR
2. Tasting notes (≥20 chars)

No graceful fallback on either. The database view enforces it, the recommend endpoint queries the view, and the render layer double-checks as a belt-and-suspenders.

Ratings are **optional** — Gabby recommends without them, just without the star badge.

---

## 5. Migration / Tomorrow's Work — Checklist

Concrete, in order. Each step is independent enough to land as its own commit.

### 5.1 Database migration — `supabase/migrations/20260418000000_inventory_enrichment.sql`

```sql
-- Enrichment fields for CSV import + provider enrichment pipeline.

alter table public.inventory
  add column if not exists upc                  text,
  add column if not exists size_label           text,
  add column if not exists summary_for_customer text,
  add column if not exists average_rating       numeric(3,2),
  add column if not exists review_count         int,
  add column if not exists review_summary       text,
  add column if not exists review_source        text,
  add column if not exists source_confidence    text
    check (source_confidence in
      ('verified','high','medium','low','partial','none')
      or source_confidence is null),
  add column if not exists enriched_at          timestamptz,
  add column if not exists enrichment_version   int not null default 0;

create index if not exists inventory_upc_idx
  on public.inventory(upc) where upc is not null;

create index if not exists inventory_enriched_idx
  on public.inventory(store_id, enriched_at)
  where enriched_at is not null;

-- Gabby-ready view: single source of truth for "recommendable" products.
create or replace view public.gabby_ready_inventory as
select *
from public.inventory
where is_active = true
  and stock_qty > 0
  and name is not null
  and category in ('wine','beer','spirits','mixer','garnish')
  and image_url is not null
  and tasting_notes is not null
  and length(trim(tasting_notes)) >= 20;

grant select on public.gabby_ready_inventory to authenticated, anon;

-- Shared image cache so we don't re-fetch the same UPC for every store.
create table if not exists public.product_image_cache (
  upc          text primary key,
  image_url    text not null,
  source       text not null,
  fetched_at   timestamptz not null default now()
);

-- Import job tracking.
create table if not exists public.import_jobs (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  uploaded_by    uuid references public.users(id) on delete set null,
  filename       text,
  status         text not null
    check (status in ('queued','validating','importing','enriching','done','failed')),
  total_rows     int,
  imported_rows  int default 0,
  enriched_rows  int default 0,
  skipped_rows   int default 0,
  errors_jsonb   jsonb default '[]'::jsonb,
  started_at     timestamptz,
  finished_at    timestamptz,
  created_at     timestamptz not null default now()
);

alter table public.import_jobs enable row level security;

drop policy if exists import_jobs_select on public.import_jobs;
create policy import_jobs_select on public.import_jobs
  for select to authenticated
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.store_id = import_jobs.store_id
        and u.role in ('owner','manager')
    )
  );
```

### 5.2 Backfill existing inventory

One-time script (`apps/web/scripts/backfill-enrichment.ts`):

1. For every row where `enriched_at is null`, queue it into the same enrichment pipeline the CSV importer uses.
2. Respect provider rate limits — batch in groups of 10, 1-second delay between batches.
3. Report: before/after counts of `gabby_ready_inventory`.
4. Safe to re-run — idempotent because each enrichment pass only writes when its field is still null.

```bash
# run from project root after DB migration lands
npx tsx apps/web/scripts/backfill-enrichment.ts --dry-run     # preview
npx tsx apps/web/scripts/backfill-enrichment.ts --store=<id>  # single store
npx tsx apps/web/scripts/backfill-enrichment.ts               # all stores
```

### 5.3 Enrichment service

`apps/web/lib/enrichment/` — new module:

- `enrichProduct.ts` — the orchestrator. Runs the three passes in order.
- `providers/upcLookup.ts` — UPC-by-provider resolver.
- `providers/imageFetch.ts` — download + resize + rehost to Supabase Storage.
- `providers/tastingNotes.ts` — structured lookup → producer-page fallback → LLM fallback.
- `providers/reviews.ts` — Vivino / Untappd / Distiller.
- `confidence.ts` — scores `source_confidence` from what each pass returned.

Each provider is a pure async function `(productCore) => Partial<EnrichmentResult>` so we can unit-test them and swap providers without rewiring the orchestrator.

### 5.4 CSV upload endpoint

`apps/web/app/api/inventory/import/route.ts`:

- POST multipart/form-data with the CSV file.
- Server-side validation (encoding, required columns, row-level errors).
- Inserts rows into `inventory` with `enriched_at = null`, `source_confidence = null`.
- Creates an `import_jobs` row, status = `'queued'`.
- Kicks off enrichment via a background queue (Vercel Cron + a per-store worker, or Supabase Edge Function).
- Returns `{ job_id }` immediately — the client polls `/api/inventory/import/status?job_id=...` every 2s.

Per-row errors go into `import_jobs.errors_jsonb` as `[{ row: 12, reason: "missing name" }, ...]`.

### 5.5 Gabby wiring — one-line swap

`apps/web/app/api/gabby/recommend/route.ts`:

```diff
- .from("inventory")
+ .from("gabby_ready_inventory")
```

Nothing else changes. The filter cascade works unchanged because the view has the same column shape.

### 5.6 UI — inventory page additions

`apps/web/app/(app)/inventory/page.tsx`:

- Add the **Upload inventory CSV** button and drawer described in §1.
- Add a column showing `source_confidence` as a small badge: `✓ Verified` / `Generated` / `⚠ Needs review`.
- Add a filter chip: **`Needs review`** — shows items where `image_url is null OR tasting_notes is null` (i.e., not Gabby-ready).
- Clicking a "Needs review" row opens the existing edit drawer pre-focused on the missing field.

### 5.7 ProductDetailModal + web shopper detail page

- Render `size_label` under the name.
- Render the rating row **only if `average_rating` and `review_count >= 1`**.
- Use `summary_for_customer ?? firstSentence(tasting_notes)` in the "Gabby says" box.
- Add the muted `source_confidence === 'low'` footer.

### 5.8 QA checklist before shipping

- [ ] Migration runs clean on a copy of prod
- [ ] Uploading the sample CSV produces 3 ready-for-Gabby rows
- [ ] Uploading a CSV with a missing-name row surfaces it as a warning, not a hard fail
- [ ] `gabby_ready_inventory` count is roughly what we expect for the demo store
- [ ] `/api/gabby/recommend` returns only rows with image + notes (hit the endpoint directly and eyeball)
- [ ] ProductDetailModal renders cleanly when rating fields are null
- [ ] `import_jobs` progress polling updates the UI in real time
- [ ] Closing the browser mid-import doesn't stall the job — reopen, progress is still live

---

## Appendix — Friendly copy library

Use these verbatim where the spec calls for them.

| Surface                           | Copy                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------- |
| Upload button                     | **Upload inventory CSV**                                                                        |
| Drawer heading                    | **Upload your inventory**                                                                       |
| Drawer subhead                    | One-time setup so Gabby can recommend your products. Most imports take 1–3 minutes.            |
| Importing headline                | ☕ Importing 248 items…                                                                         |
| Importing reassurance             | Usually takes 1–3 minutes — we're fetching product photos and tasting notes.                   |
| Can-close nudge                   | Feel free to close this window, we'll email you when it's done.                                |
| Done headline                     | 🎉 Your products are ready for Gabby.                                                           |
| Needs-review header               | These items are in your catalog, but Gabby won't recommend them until you add a photo or notes.|
| Skipped-rows warning              | ⚠ {N} rows were skipped because they were missing a product name.                               |
| Low-confidence footer on card     | Details auto-matched — flag if inaccurate.                                                      |

---

_End of spec. Nothing in this document changes the decision tree or ranker — those stay as-shipped. All new behavior lives in the import pipeline, the enrichment service, the `inventory` table extensions, and the `gabby_ready_inventory` view._
