# BevTek.ai

AI platform for beverage retail liquor stores. The product is **Megan**, composed of five features:

- **Megan Trainer** — staff education modules with per-user progress
- **Megan Assistant** — natural-language inventory search on the floor
- **Megan Receptionist** — inbound calls answered by an AI agent via [Retell AI](https://retellai.com)
- **Megan Shopper** — public customer-facing web storefront with search + product pages
- **Megan Texting** — iMessage conversations via [Sendblue](https://sendblue.co)

## Stack

- **Database + auth**: [Supabase](https://supabase.com) (Postgres, RLS, Storage, Auth)
- **Web dashboard**: [Next.js 16](https://nextjs.org) (App Router, React 19, Tailwind v4) on [Vercel](https://vercel.com)
- **Voice**: Retell AI
- **iMessage**: Sendblue
- **Image enrichment** (free): Open Food Facts (GTIN → exact SKU) + Wikipedia (brand image)

## Repo layout

```
BevTek/
├── apps/
│   └── web/                  # Next.js dashboard + shopper storefront
│       ├── app/
│       │   ├── (app)/        # authenticated: dashboard, trainer, inventory, etc.
│       │   ├── (auth)/       # login, signup
│       │   ├── api/          # webhook endpoints for Retell + Sendblue
│       │   ├── auth/         # email confirm, signout
│       │   ├── invite/[token]/
│       │   └── s/[slug]/     # public customer storefront
│       ├── components/       # reusable client components (ImageUpload, ProductImage)
│       ├── lib/
│       │   ├── images/       # Wikipedia + Open Food Facts lookup
│       │   └── inventory/    # spreadsheet column detection
│       └── utils/supabase/   # SSR, browser, and proxy clients
├── packages/
│   └── shared/               # @bevtek/shared: design tokens, types
└── supabase/
    └── migrations/           # SQL migrations, numbered sequentially
```

## Local development

### Prerequisites
- Node 20+ (tested on 24)
- pnpm 10+

### Setup

```bash
pnpm install
```

Copy `.env.local` values into `apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Run migrations (in order) via the Supabase SQL Editor:
- See `supabase/migrations/` — timestamps determine order.

Start the dev server:
```bash
pnpm dev       # from repo root
# or
cd apps/web && pnpm dev
```

The dashboard runs at http://localhost:3000.

## Multi-tenancy & security

Every business table carries `store_id` and has RLS. The `public.current_store_id()` helper scopes all authenticated queries. Public storefront data is exposed via the `public_stores` and `public_inventory` views with `security_invoker = true`. Storage uploads are gated by path prefix (first folder segment must equal the user's store id).

## Webhook integrations

Receptionist and Texting are wired to external services via per-store rotatable webhook secrets. Owners configure them in-app at `/calls` and `/texts`. Webhooks post to:
- `POST /api/retell/webhook`
- `POST /api/sendblue/webhook`

Both routes validate the secret via `x-webhook-secret` header (or embedded in the body), then call a `SECURITY DEFINER` Postgres function that scopes the insert to the correct store.

## Deploy

Pushes to `main` auto-deploy via Vercel. Root directory is `apps/web`. Only two env vars are required (the Supabase URL + publishable key).

After every Supabase migration is applied, the site will pick up the new columns/functions automatically — migrations are not run during deploy, only by the operator in the SQL Editor.
