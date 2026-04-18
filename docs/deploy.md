# BevTek.ai — Deploy & "Where Do I See It?" Guide

Two separate deploy pipelines. Knowing which is which saves an hour of
confusion every time something's "missing from the app."

## Web (Next.js) — automatic

Repo: `mikesweigart/bevtek` · Root: `apps/web` · Host: Vercel
URL: **https://bevtek-web.vercel.app**

Every push to `main` auto-deploys in ~2 minutes. Check status:

- https://vercel.com/dashboard (build/deploy log)
- The commit's "Deployments" checkmark on GitHub

### What lives on web

- Owner/manager portal (`/dashboard`, `/inventory`, `/trainer`, `/promotions`, `/trainer/analytics`, `/admin/promotions`)
- Public shopper storefront (`/shop/[slug]`, `/s/[slug]`)
- All API routes (`/api/gabby/chat`, `/api/assist/...`, `/api/webhooks/...`)
- The QR-handoff customer continuation page (`/s/[slug]/assist/[id]`)

**If it's behind a URL, it's probably web — and it's probably already live.**

## Mobile (Expo / React Native) — manual push

Repo path: `apps/mobile` · Framework: Expo SDK 54
Binary: distributed via EAS Build (iOS TestFlight + Android APK / Play)
OTA updates: via `eas update`

Every push to `main` is **committed but not published.** The mobile app in
your pocket keeps running whatever JS bundle it was last built with until
you run one of these:

### 1. Local dev — see changes instantly

```bash
cd apps/mobile
pnpm install   # first time only
pnpm start     # opens Expo dev server + QR code in terminal
```

Scan that QR with the **Expo Go** app on your phone (App Store / Play).
Hot reloads on save. This is the fastest way to validate mobile work.

### 2. OTA update for existing installs — pushes the new JS bundle

```bash
cd apps/mobile
eas update --branch production --message "what you changed"
```

Anyone already running the installed BevTek app gets the update next
time they open it. Use this for JS-only changes (screens, logic,
copy). **Not** for changes that add a native dependency — those need
a new build.

### 3. New native build — TestFlight / Play

```bash
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production
```

Takes ~15–25 min per platform. Needed when a native dep is added
(camera, location, new payment lib, etc.) or for the first install
before OTA is possible.

## "Where do I see X?"

| Change | Where it shows up | Requires |
|---|---|---|
| Web page, component, API route | bevtek-web.vercel.app | push to main |
| Mobile screen, component, native wire-up | Installed BevTek app | `eas update` or new build |
| Supabase migration | Everywhere | Paste SQL into Supabase Editor |
| Claude system prompt (Gabby/Megan) | Web + mobile (both hit web API) | push to main |
| Env var | Takes effect on next Vercel deploy | set in Vercel dashboard |

## Quick scan-and-see

Dashboard: https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=2&data=https%3A%2F%2Fbevtek-web.vercel.app%2Fdashboard

Shopper storefront for a specific store: grab the QR already generated
on the dashboard (the big gold one). That URL encodes your slug and is
what a real customer would scan.

## Gotchas

- **Vercel preview deployments** run on every PR branch but have a
  different URL — only `main` deploys to `bevtek-web.vercel.app`.
- **Supabase migrations don't run automatically.** `supabase/migrations/*.sql`
  files are committed but you need to paste them into the SQL Editor
  yourself. Check the bottom of this file list for the newest ones:
  `ls supabase/migrations | tail -5`.
- **`EXPO_PUBLIC_*` env vars** have to be set at Expo build time, not
  runtime — re-running `eas build` is required after changing them.
- **BEVTEK_ADMIN_EMAILS** must be set in Vercel for `/admin/promotions`
  to be reachable; otherwise the page 404s.
