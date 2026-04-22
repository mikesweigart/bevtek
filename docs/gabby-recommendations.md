# Gabby Recommendations — Operating Guide

How to keep Gabby's recommend endpoint returning the right bottles, not
the first bottles. Covers the two layers that control quality:

1. **Metadata enrichment** (offline batch) — populates the guided-tree
   columns (`style[]`, `flavor_profile[]`, `intended_use[]`, `body`,
   `sweetness`, `hop_level`, `abv`) so the SQL filters land on the right
   rows in the first place.
2. **Optional LLM re-rank** (online, feature-flagged) — after the SQL
   filters produce a candidate list, Claude Haiku re-orders it so the
   best fit for the shopper's *soft* preferences surfaces first.

Together they're the difference between "we returned a bourbon because
your category said bourbon" and "we returned *this* bourbon because you
said beginner-friendly and fruity, and the producer's tasting notes say
caramel-and-honey on the nose."

---

## 1. Metadata enrichment script

**File:** `scripts/enrich-inventory-metadata.ts`
**Commands:** `pnpm enrich:metadata`, `pnpm enrich:metadata:dry`

### What it does

One Haiku call per batch of 8 inventory rows. For each row where the
guided-tree columns are NULL, the model infers canonical tokens from
the row's name + brand + varietal + category + tasting notes. Results
are written back to Supabase via `COALESCE` so existing hand-curated
values are never overwritten.

### What it never touches

- `is_local`, `is_staff_pick` — owner-specific judgement.
- `tasting_notes`, `summary_for_customer` — already covered by the
  tasting-notes enrichment provider.
- `price`, `stock_qty`, `name`, `brand`, `varietal` — POS-owned or
  covered by the `normalizeNames` pass.

### Required env

```
SUPABASE_DB_URL=postgresql://…service-role…@db.<ref>.supabase.co:5432/postgres
ANTHROPIC_API_KEY=sk-ant-…
```

Get `SUPABASE_DB_URL` from Supabase Dashboard → Settings → Database →
Connection string (URI). Treat it like a nuke code — it's service-role.

### Safe operating workflow

```bash
# 0. Read-only analyze to see the job size BEFORE any Haiku spend.
#    Reports NULL-column counts per store/category and a cost estimate.
#    No API key required.
SUPABASE_DB_URL=… pnpm enrich:metadata:analyze

# 1. Dry-run a 20-row sample to eyeball the output.
SUPABASE_DB_URL=… ANTHROPIC_API_KEY=… \
  pnpm enrich:metadata:dry

# 2. Inspect the audit file (NDJSON, one row per line, plus final summary).
cat scripts/eval-results/enrich-$(date +%Y-%m-%d).json | head -20

# 3. When the output looks sane, run --write for one store.
SUPABASE_DB_URL=… ANTHROPIC_API_KEY=… \
  pnpm enrich:metadata -- \
    --store-id=c7dd888e-94c3-430f-8e62-97603122b392 \
    --limit=50 \
    --write

# 4. Spot-check a few bottles in Gabby.
#    Open the mobile app, walk through whiskey flow, verify results.

# 5. Full catalog, all stores.
SUPABASE_DB_URL=… ANTHROPIC_API_KEY=… \
  pnpm enrich:metadata -- --write
```

### Cost

Haiku 4.5 at list price is ~$0.0005/row. A 6,000-row catalog costs
about $3. The audit file records exact token usage and an estimated
cost in the final summary object.

### Resumability

Rows are filtered on `style IS NULL OR flavor_profile IS NULL OR
intended_use IS NULL` (among others), so a re-run after a crash or
Ctrl+C only picks up the rows that still need work. Safe to re-run
nightly if you like — no-ops the already-filled rows.

### What to check after a run

- `estimated_cost_usd` in the summary matches expectations.
- `errors` is near-zero. Anthropic 529 (overloaded) happens — safe to
  re-run, the already-filled rows get skipped.
- Spot-check 3–5 rows in the audit NDJSON: did the model infer sane
  `style[]` for each? (A Caymus Cabernet should get `["cabernet
  sauvignon", "red blend"]` and a Maker's Mark should get `["bourbon"]`.
  If you see cross-category bleed, bump --batch-size down to 4 and
  re-run.)

---

## 2. LLM re-rank (feature-flagged)

**File:** `apps/web/lib/gabby/rerank.ts`
**Env flag:** `GABBY_RERANK_ENABLED`
**Default:** OFF (inert in every deploy until flipped on).

### What it does

After the `/api/gabby/recommend` relaxation cascade produces its list
of candidates, the re-rank hands the list to Haiku with the shopper's
filter bag as context, and Claude re-orders them so the best soft-match
surfaces first. The response also gains a `justifications` map keyed
by product id so the UI can show a one-line reason next to each top
pick ("Eagle Rare — matches your beginner-friendly + fruity pick").

### When re-rank fires

- `GABBY_RERANK_ENABLED=true` on the deployment
- `ANTHROPIC_API_KEY` is configured
- The candidate list has 3–20 items (fewer has nothing to reorder; more
  blows the input-token budget)
- At least one *soft* preference is set (`flavor_any`, `intended_use_any`,
  `pairing_any`, `body`, `sweetness`, `hop_level`). If the shopper only
  gave hard filters, the default SQL order is already fine.

If any of those fails, the response falls through with `reranked: false`
and the original SQL order.

### Failure handling

If Claude errors, times out (2.5 s cap), or returns unparseable output,
`rerankCandidates` silently falls back to the original order and logs
`[gabby.rerank] {"ok":false,"error":"…"}` to the function log. Shoppers
never see a broken page because of this.

### How to turn it on

1. Run the enrichment script first. Re-rank quality is a multiplier on
   metadata quality — without populated `flavor_profile[]` and
   `intended_use[]`, the model has nothing to ground on.
2. Set the env var in Vercel:
   ```
   vercel env add GABBY_RERANK_ENABLED production
   # enter: true
   ```
3. Redeploy. Watch `[gabby.rerank]` log lines for the first hour:
   - `ok: true` with sane token counts → working.
   - High `AbortError` rate → bump `TIMEOUT_MS` in `rerank.ts` or
     reduce the candidate window (`--limit` on queries upstream).
4. To kill instantly: `vercel env rm GABBY_RERANK_ENABLED production`,
   redeploy. Route handler is idempotent on flag absence.

### Cost

~$0.005 per recommend call (input + output tokens). At 1,000
recommends/day per store, that's ~$5/store/day ceiling. Real number
will be lower because many requests won't clear the "≥3 candidates +
soft signals" gate.

---

## 3. Observability

Both layers log to Vercel's function logs with structured JSON:

- `[claude.call]` — covers Megan/Gabby chat and module generation.
  Fields: `feature`, `prompt_version`, `model`, `latency_ms`, token
  counts.
- `[gabby.rerank]` — re-rank outcomes. `ok`, `count`, `input_tokens`,
  `output_tokens` on success; `ok: false, error` on failure.
- `[gabby.hallucination]` — flagged (not blocked) when Gabby names a
  product that isn't in the inventory block she was given. Review
  periodically; high volume on a prompt version suggests a regression.

No PII in any of these lines. Safe to grep through cold storage.

---

## 4. The cascade, ranked by ROI

If you ever need to raise quality further, try in this order:

1. **Fix metadata first** — run the enrichment script. 80% of quality
   gains. $3 one-time.
2. **Turn on re-rank** — 10–15% more lift, $5/store/day cap.
3. **Track click-throughs** — log which recommended SKU the shopper
   tapped/added. That's your only actual ground truth. After 2–3 weeks
   you can tune the ranker's prompt on signal, not intuition.
4. **Embedding-based pre-trim** — only worth it above ~200 candidates
   per recommend. We haven't hit that ceiling yet; skip until you do.
5. **Licensed external review data** — Whisky Advocate, Distiller,
   Wine & Spirits APIs. Expensive ($$$/month), worth it *only* if
   you're positioning BevTek as the "expert-curated" store platform.
   The unlicensed/scraping version of this is not worth the legal
   + operational tax. Don't do it.
