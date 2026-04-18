# BevTek.ai — Staging Environment Runbook

A parallel copy of production you can break without a store manager
calling you at 7 AM. Not optional once you have real paying stores:
every prompt tweak, every migration, every third-party webhook change
gets tried here first.

**Scope of "staging" here:** one shared non-prod environment. Not
per-developer. Shared is fine — commits land in `staging` branch,
auto-deploy, team pokes at it, then promote to `main`.

---

## The mental model

```
  you push to `main`            you push to `staging`
          │                             │
          ▼                             ▼
  ┌───────────────┐             ┌───────────────┐
  │  Vercel prod  │             │ Vercel staging│
  │  bevtek-web   │             │  bevtek-web-  │
  │  .vercel.app  │             │  staging...   │
  └───────┬───────┘             └───────┬───────┘
          │                             │
          ▼                             ▼
  ┌───────────────┐             ┌───────────────┐
  │  Supabase     │             │  Supabase     │
  │  bevtek-prod  │             │ bevtek-staging│
  └───────────────┘             └───────────────┘
          │                             │
          ▼                             ▼
  ┌───────────────┐             ┌───────────────┐
  │ Anthropic key │             │ Anthropic key │
  │ (prod limits) │             │ (dev key,     │
  │               │             │  $10/day cap) │
  └───────────────┘             └───────────────┘
```

Same repo, same code, same schema. Separate DB rows, separate auth
users, separate API keys. **Nothing crosses the wall.**

---

## Prerequisites (one-time)

- [ ] Vercel project already exists (`bevtek-web`)
- [ ] Supabase prod project already exists
- [ ] Anthropic account with API key and spend cap
- [ ] GitHub access to `mikesweigart/bevtek`

Total setup time: ~45 minutes, mostly waiting for Supabase to
provision.

---

## Step 1 — Create `staging` branch

```bash
git checkout -b staging
git push -u origin staging
```

From now on, work flows: feature branch → `staging` → `main`.

---

## Step 2 — Create the staging Supabase project

1. Go to https://supabase.com/dashboard → **New project**
2. Org: same one as prod
3. Name: `bevtek-staging`
4. Region: match prod (lower latency for cross-env tests; same price)
5. DB password: use a password manager, store alongside prod
6. Wait ~2 minutes for provisioning

Once up, grab these from **Settings → API**:
- `NEXT_PUBLIC_SUPABASE_URL` (Project URL)
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon public key)
- `SUPABASE_SERVICE_ROLE_KEY` (service_role — **never commit**)

From **Settings → Database → Connection string** (Transaction pooler):
- `SUPABASE_DB_URL` — used by `pnpm db:apply`

---

## Step 3 — Apply schema to staging

From the repo root, with `SUPABASE_DB_URL` pointing at **staging**:

```bash
# PowerShell
$env:SUPABASE_DB_URL = "postgres://postgres.xxxxx:PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
pnpm db:apply:all
```

This runs every migration in `supabase/migrations/` in order and
records them in the `_migrations` ledger. You'll see:

```
[apply] 20260101000000_init.sql (fresh) … 1,240ms ✓
[apply] 20260105120000_inventory_enrichment.sql (fresh) … 380ms ✓
...
[apply] 20260418240000_support_tickets.sql (fresh) … 120ms ✓
```

**If the command fails halfway,** the transaction rolls back — safe to
re-run. If it says "hash mismatch," someone edited a migration file
that had already been applied; re-investigate before forcing anything.

Sanity-check RLS is on every table:

```bash
pnpm db:rls-check
```

Should print `✓ All N public tables have RLS enabled with ≥1 policy.`

---

## Step 4 — Seed staging data

Staging without data is useless — Gabby can't recommend from empty
shelves. Two options:

**Option A: Copy a single store from prod (recommended).**
In the Supabase SQL editor (prod), generate a one-store snapshot:

```sql
-- Pick a real store with real inventory
select id, name from stores order by created_at limit 5;
```

Use `pg_dump` or Supabase's export tool to pull just that store's rows
from `stores`, `inventory`, `users`. Import into staging via the SQL
editor. Re-anchor store_id/user_id foreign keys if needed.

**Option B: Fresh synthetic store.**
Sign up on the staging deploy, go through onboarding, import a sample
CSV from `docs/sample-inventory.csv` (create one if it doesn't exist).
Slower but cleaner.

Either way, create a **staging-only test manager account** so you can
hit `/dashboard` without affecting prod data.

---

## Step 5 — Create a Vercel preview environment

Vercel terminology: prod is one "environment," and you can point a
non-main branch at a *separate* set of env vars using the Vercel CLI
or dashboard.

1. In the Vercel project → **Settings → Git**
2. Ensure **Production Branch** is `main`
3. Any other branch auto-deploys as a *Preview* — we're piggybacking
   on the `staging` branch's Preview URL

4. In **Settings → Environment Variables**, add each staging value
   **scoped to "Preview" only** (not Production):

   ```
   NEXT_PUBLIC_SUPABASE_URL            = <staging url>
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = <staging anon key>
   SUPABASE_SERVICE_ROLE_KEY           = <staging service role>
   ANTHROPIC_API_KEY                   = <separate dev key, $10/day cap>
   UPSTASH_REDIS_REST_URL              = <separate Upstash DB or leave unset>
   UPSTASH_REDIS_REST_TOKEN            = <same>
   NEXT_PUBLIC_SENTRY_DSN              = <staging Sentry project DSN>
   SENTRY_DSN                          = <same>
   SENTRY_ENVIRONMENT                  = staging
   RETELL_API_KEY                      = <retell dev/sandbox key if available>
   SENDBLUE_API_KEY                    = <sendblue dev key>
   STRIPE_SECRET_KEY                   = sk_test_… (Stripe test mode!)
   STRIPE_WEBHOOK_SECRET               = <test-mode webhook secret>
   ```

   **Critical:** Stripe must be in **test mode** on staging. Real-money
   subscriptions from a staging test run would be a support fire.

5. Push `staging` branch:
   ```bash
   git push origin staging
   ```
   Vercel assigns a stable URL like:
   `bevtek-web-git-staging-mikesweigart.vercel.app`

6. Lock that URL: **Project → Settings → Domains →** add
   `staging.bevtek.ai` (or similar) pointing at the `staging` branch.

---

## Step 6 — Wire third-party webhooks to staging

Anything that pushes into BevTek (not just our outbound calls):

- **Stripe** → dashboard → Developers → Webhooks → Add endpoint
  `https://staging.bevtek.ai/api/webhooks/stripe`. Use test-mode keys.
- **Retell** → if you use it, create a separate test agent that
  callbacks to staging's `/api/retell/...` routes.
- **Sendblue** → separate test number, webhook pointed at staging.

If a third party only supports ONE webhook URL, park it on prod and
fake the inbound in staging manually (curl) — not worth splitting real
phone numbers.

---

## Step 7 — Mobile pointing at staging

Two options, in order of preference:

**A. EAS build profiles (production setup).**
In `apps/mobile/eas.json` (create it):

```json
{
  "build": {
    "staging": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "<staging url>",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "<staging anon>",
        "EXPO_PUBLIC_WEB_BASE_URL": "https://staging.bevtek.ai",
        "EXPO_PUBLIC_SENTRY_DSN": "<staging mobile DSN>",
        "EXPO_PUBLIC_ENV": "staging"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "<prod url>",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "<prod anon>",
        "EXPO_PUBLIC_WEB_BASE_URL": "https://bevtek-web.vercel.app",
        "EXPO_PUBLIC_SENTRY_DSN": "<prod mobile DSN>",
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  }
}
```

Then: `eas build --profile staging --platform ios` for a TestFlight
build that talks to staging.

**B. Local `.env.staging` (dev use).**
Copy `apps/mobile/.env` to `.env.staging`, swap the URLs/keys. Start
with `cp .env.staging .env && pnpm start`. Bad for team workflows but
fine for a quick personal sanity check.

---

## Daily workflow

```
            feature branch
                  │
                  ▼
          open PR → `staging`
                  │
                  ▼
       Vercel preview builds, team tests
                  │
                  ▼
    if green: PR `staging` → `main`
                  │
                  ▼
             Vercel prod
```

**Migrations:** apply to staging first (`pnpm db:apply <file>` with
staging `SUPABASE_DB_URL`), smoke-test, then apply to prod. NEVER the
other way around.

**Prompts:** edit prompt + bump `PROMPT_VERSIONS` in
`apps/web/lib/ai/claude.ts`, push to `staging`, run
`BEVTEK_EVAL_STORE_ID=<staging store> pnpm eval:gabby` against the
staging URL. If the eval passes, promote.

---

## Cost control

Staging costs add up if you let them. Keep these caps in place:

| Service    | Staging cap          | Notes                              |
|------------|----------------------|------------------------------------|
| Anthropic  | **$10/day**          | Separate API key. Never share with prod. |
| Supabase   | Free tier (500 MB)   | Plenty for a single seed store.    |
| Vercel     | Hobby/free           | Preview deploys don't count toward bandwidth cap if low-traffic. |
| Upstash    | Free tier or skipped | Rate limiter fail-opens if unset — fine for staging. |
| Sentry     | Free tier (5k events)| Separate project so staging noise doesn't eat prod quota. |

**Nuke and repave.** Once a quarter, wipe staging Supabase and
re-apply all migrations + re-seed. Catches drift between `migrations/`
and reality.

---

## When staging goes wrong

**"Staging isn't deploying."**
Check Vercel → Deployments. Filter by branch `staging`. If the build
errored, it'll be red. The "Git" tab in Project Settings confirms the
branch is connected.

**"Env var changes aren't picked up."**
Env var edits only apply to *new* builds. Trigger a redeploy: Vercel
→ the latest staging deployment → `⋯` → **Redeploy**.

**"Staging DB schema drifted from prod."**
Run `pnpm db:dry-run` against each to diff what the ledger knows vs.
what's in `supabase/migrations/`. The ledger is the source of truth
for what was applied; anything in the folder not in the ledger is
pending.

**"I accidentally hit prod from staging."**
Check Vercel env vars first — it's almost always a wrong
`NEXT_PUBLIC_SUPABASE_URL` scoped to the wrong environment. Fix, redeploy,
and consider whether any staging test data leaked into prod (unlikely
because of the anon key mismatch, but worth a `select count(*) from
stores` check).

---

## Minimum viable staging (if you don't have time for the full setup)

Strip down to just:

1. `staging` branch with auto-deploy
2. Separate Supabase project
3. Separate Anthropic key with tight spend cap
4. Stripe in test mode

Skip Sentry, skip Upstash, skip mobile EAS build. You can layer those
on once you've proved the staging/prod split holds under a real
release. The point isn't perfection — it's **never applying an
untested migration to a store's production data.**
