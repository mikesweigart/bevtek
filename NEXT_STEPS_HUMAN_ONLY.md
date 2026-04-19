# Next Steps — Human-Only

Everything in this file requires you (Harry/Mike) to act. Claude can't do any of it — it's accounts, keys, legal, store submissions, and external services. Grouped by urgency.

Last updated: 2026-04-18

---

## 🔴 CRITICAL — Blocks App Store submission

### 1. Apple Developer Program enrollment ($99/year)
- https://developer.apple.com/programs/enroll/
- **Org account** needs a **DUNS number** (free, ~2 business days):
  https://developer.apple.com/support/D-U-N-S/
- **Individual account** is faster (no DUNS) but ties the app to your personal name on the store listing. For BevTek as an LLC, use org.
- After approval you get access to App Store Connect.

### 2. App Store Connect — create app record
- https://appstoreconnect.apple.com
- Create a new iOS app with:
  - **Bundle ID**: `ai.bevtek.app` (must match `apps/mobile/app.json`)
  - **SKU**: `bevtek-ios-001` (any unique string)
  - **Primary language**: English (U.S.)
  - **Category**: Food & Drink (matches `LSApplicationCategoryType` already set)

### 3. App Review metadata (all required fields)
- **Support URL**: `https://bevtek.ai/support` (or `bevtek-web.vercel.app/support`)
- **Privacy Policy URL**: `https://bevtek.ai/privacy`
- **Marketing URL** (optional): `https://bevtek.ai`
- **App subtitle** (30 chars max): e.g. "Your AI bev concierge"
- **App description** (4000 chars): Customer-facing copy. **Do NOT mention Retell/Sendblue/ElevenLabs** — hide vendor names per `feedback_vendor_branding.md`.
- **Keywords** (100 chars): `wine,bourbon,beer,cocktails,liquor,store,recommendations,AI,bottle,spirits`
- **Promotional text** (170 chars): Changeable between releases.
- **What's new in this version**: Release notes.

### 4. Screenshots (required, all at exact dimensions)
- **6.7" Display** (iPhone 15 Pro Max): 1290 × 2796 — **REQUIRED**, minimum 3
- **6.5" Display** (iPhone 11 Pro Max): 1242 × 2688 — optional
- **5.5" Display** (iPhone 8 Plus): 1242 × 2208 — only if supporting older devices
- Suggest: Home, Ask Gabby result, Product detail, Learning module, Profile

### 5. App Privacy self-disclosure (Data & Privacy tab)
Apple makes you tick exactly what you collect and whether it's linked to identity or used for tracking. For BevTek, these are accurate:
- **Contact Info — Email**: Linked to user, Used for App Functionality
- **User Content — Other (saved products, holds)**: Linked, App Functionality
- **Identifiers — User ID**: Linked, App Functionality
- **Usage Data — Product Interaction**: Linked, Analytics
- **Diagnostics — Crash Data**: NOT linked, App Functionality (Sentry)
- **Tracking**: **No** — we don't cross-app track

### 6. Reviewer notes (hidden from public, shown to App Review)
Draft copy — paste into the Reviewer Notes field:
```
BevTek is a free B2B2C app. End customers download it to shop at brick-and-
mortar beverage stores that subscribe to BevTek on the web (bevtek.ai).

• No purchases happen inside the iOS app. All transactions happen in-store
  or on the merchant's web storefront. The app only lets customers browse,
  save picks, request in-store holds, and chat with Gabby (our AI assistant).
• Retailer subscriptions (paid by store owners) happen only on the web at
  bevtek.ai — never in the iOS app.
• To demo the full experience, please sign in with:
    Email: <create a demo customer account>
    Password: <set a demo password>
  This account is pre-seeded with a test store "Grapes & Grains" so the
  shop, holds, and Gabby chat flows are all exercised.
• Age gate: The app prompts for DOB on first launch (21+ required per U.S.
  alcohol law). To bypass for testing, delete & reinstall — state is stored
  in the Secure Enclave via expo-secure-store.
• AI disclosure: Gabby is AI-powered. Disclosure is shown on first interaction
  and an "AI" badge is pinned to every response.
```

### 7. Age Rating questionnaire
- **Alcohol, Tobacco, or Drug Use or References**: **Frequent/Intense** → pushes to 17+
- Everything else: None
- Result: 17+

### 8. Build & submit via EAS
Claude can write the Expo config but you must run these:
```bash
cd apps/mobile
npx eas login              # first time only
npx eas build:configure    # first time only
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```
Requires an `eas.json` (Claude can generate this — ask).

### 9. TestFlight internal testers
- Add 1–5 of your team emails as "Internal Testers" in App Store Connect.
- They install TestFlight, accept the invite, and exercise the app for ~48h.
- Good smoke test before hitting "Submit for Review".

---

## 🟠 HIGH PRIORITY — Infra & keys

### 10. Vercel environment variables
Set on the `bevtek-web` project:

| Name | Purpose | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ already set | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ already set | Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ already set | Supabase API (⚠️ secret) |
| `ANTHROPIC_API_KEY` | ✅ already set | console.anthropic.com |
| `STRIPE_SECRET_KEY` | billing | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | webhook verification | Stripe → Webhooks → endpoint |
| `SENTRY_DSN` | error tracking | Sentry project settings |
| `SENTRY_AUTH_TOKEN` | source map upload | Sentry user settings |
| `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | enrichment pass 1e | console.cloud.google.com |
| `UNSPLASH_ACCESS_KEY` | module image backfill | unsplash.com/developers |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | rate limiting (currently fail-open) | console.upstash.com |
| `CRON_SECRET` | protects /api/cron/* (once we add retention) | generate with `openssl rand -hex 32` |
| `RESEND_API_KEY` or `SENDGRID_API_KEY` | transactional email | chosen provider |

### 11. GitHub repo secrets (for CI-gated eval)
`Settings → Secrets and variables → Actions`:
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `BEVTEK_EVAL_STORE_ID` — UUID of the test store the eval hits

### 12. Supabase migrations
Claude writes them to `supabase/migrations/`. You apply them via SQL Editor in the Supabase dashboard — paste each new file's SQL and Run. Claude verifies via REST afterward.

### 13. Sentry project
- https://sentry.io/signup/
- Create a Next.js project named `bevtek-web`.
- Copy DSN into `SENTRY_DSN` Vercel env var.
- Generate an auth token with `project:write` scope for sourcemap upload.

### 14. Upstash Redis (for rate limiting)
- https://console.upstash.com
- Create a free-tier Redis DB in the same region as Vercel (iad1 for us-east).
- Copy the REST URL + token into Vercel.
- Without this, `ratelimit.ts` fails open (no enforcement) — fine for now but tighten before go-live.

### 15. Email deliverability (privacy@, security@, support@)
- Current privacy policy + support page advertise:
  `support@bevtek.ai`, `privacy@bevtek.ai`, `security@bevtek.ai`
- These need to resolve. Options:
  - Google Workspace ($6/user/mo)
  - Fastmail / Proton
  - Forwarding aliases via your domain registrar (cheapest)
- Set up **SPF** + **DKIM** + **DMARC** DNS records so replies don't land in spam.

### 16. Uptime monitoring (/api/health)
- https://betteruptime.com (free tier, 3-min checks) OR
- https://statuscake.com OR
- https://uptimerobot.com
- Monitor: `https://bevtek-web.vercel.app/api/health`
- Alert channel: SMS + email to you.

---

## 🟡 MEDIUM PRIORITY — External vendors (for when features go live)

### 17. Retell AI account (phone receptionist feature)
- https://retellai.com — not on the critical path until a store actually activates Receptionist.
- You'll need per-store phone numbers provisioned.

### 18. Sendblue account (SMS feature)
- https://sendblue.co — iMessage + SMS through one API. Same story: only needed when a store flips on Texting.

### 19. ElevenLabs account (voice cloning for Megan/Gabby)
- https://elevenlabs.io — Pro tier for commercial use.

### 20. Stripe live mode
- Activate Stripe account fully (bank, tax ID, etc.).
- Rotate keys: switch `STRIPE_SECRET_KEY` from test to live in Vercel.
- **Create a new webhook endpoint in live mode** pointing to `/api/stripe/webhook` and copy the new signing secret to `STRIPE_WEBHOOK_SECRET`.
- Update pricing products/prices in the live Stripe dashboard to match ROADMAP.md tiers.

---

## 🟢 LEGAL / COMPLIANCE — Before public launch

### 21. Privacy policy legal review
- `apps/web/app/(marketing)/privacy/page.tsx` is a solid GDPR/CCPA draft but was written by Claude, not a lawyer. Have a startup-familiar attorney review (~$500–$1500).
- Main things to verify:
  - §3 legal bases (GDPR Art. 6)
  - §11 children under 13/21 wording
  - Address in §1 and §13 (currently "3000 Old Alabama Road, Alpharetta, Georgia, USA" — confirm correct)
  - Data Protection Officer designation (§13) — currently "privacy@bevtek.ai" with no named DPO; for EU residents ≥250 you'd need a named one.

### 22. Terms of Service
- `/terms` page exists — also Claude-drafted. Same legal review pass.

### 23. State-by-state alcohol law check (U.S.)
- Minimum age: 21 is universal for spirits/liquor, but some states let 18-20-year-olds buy beer/wine under specific conditions (e.g., Louisiana).
- Our age gate sets `MIN_AGE = 21` globally. Legal should confirm this is acceptable vs. running a state-specific rule. Easier to defend 21-everywhere.
- Dram shop laws: BevTek doesn't serve, sell, or deliver alcohol — we surface inventory info. Low exposure, but worth a memo.

### 24. Trademark search
- "BevTek" and "BevTek.ai" — run a TESS search at https://tmsearch.uspto.gov/
- Apply for word mark in Class 42 (software) and Class 35 (retail services).
- ~$250–$350 per class, DIY via USPTO.

### 25. LLC / entity formation
- If not already done, form an LLC in DE or your home state before taking money.
- Get an EIN.
- Open a business bank account — Stripe payouts should land there, not a personal account.

---

## 🔵 NICE-TO-HAVE — Post-launch polish

### 26. App Store Connect — App Preview video
- 15–30 sec screen recording of the core flow, added as an "App Preview" in each screenshot slot.
- Bumps conversion rate by ~15% per App Store data.

### 27. Apple Search Ads (App Store discovery)
- Budget ~$500/mo for keyword buys ("wine store app", "bourbon finder", etc.).

### 28. Play Store submission
- Bundle ID is already configured (`ai.bevtek.app`).
- Google Play Developer account: one-time $25.
- Reviewer is much more lenient than Apple — plan ~1 week of effort.

### 29. Apple Business Manager / VPP
- If large retailer chains want to push BevTek to their store iPads via MDM, you'd enroll here. Skip until it comes up.

### 30. SOC 2 Type I (for enterprise retailer customers)
- Drata / Vanta / Tugboat Logic — ~$7k–$15k/yr for the platform + ~$15k for the audit. Don't start this until you have a deal on the table that requires it.

---

## Quick sanity-check checklist for the day of submission

- [ ] `apps/mobile/app.json` version bumped (e.g. `"version": "1.0.1"`)
- [ ] `buildNumber` incremented
- [ ] Privacy URL, Support URL, demo login all working in prod
- [ ] `/api/health` returning green
- [ ] Sentry has received at least one test event
- [ ] Age gate tested on fresh install (expo-secure-store cleared)
- [ ] Delete-account flow tested end-to-end with a throwaway account
- [ ] TestFlight build passes on at least one physical device
- [ ] Reviewer demo account seeded with realistic data
- [ ] Screenshots updated to current UI

---

**If anything here is out of date, ping Claude with "update NEXT_STEPS_HUMAN_ONLY.md — X is done" and it'll mark it off.**
