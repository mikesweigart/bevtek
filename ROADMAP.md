# BevTek.ai Roadmap

_Canonical roadmap as of the planning artifact — reconciled here on 2026-04-15._

## Headline

**The AI platform for beverage retail.** Five AI products that train staff, assist on the floor, answer customer calls, and guide shoppers — all built on Claude, deployed in weeks.

- **$130** — monthly cost to launch
- **5 weeks** — to first paying store
- **75%+** — gross margin per store

## Five Megan products

### 01 · Megan Trainer — Education
Gamified learning platform. Staff earn levels, stars, and badges mastering wine, spirits, beer, and cocktails through **44 bite-sized modules**.
- 44 modules — wine / spirits / beer / cocktails (see library breakdown below)
- 2-question quizzes with retry logic
- Level system — Newcomer to Elite
- Voice narration — listen while stocking
- Daily challenges + streak tracking
- Manager progress dashboard
- **$79 / location / mo** · ~85% gross margin

**Module library:**
- Wine — France (6): Bordeaux Reds, Burgundy Pinot Noir, French Chardonnay, Champagne & Sparkling, Rhône, Sancerre & Loire
- Wine — USA (6): Napa Cabernet, California Chardonnay, Oregon Pinot Noir, Washington Reds, Sonoma Whites, California Rosé
- Wine — World (4): Australian Shiraz, Argentine Malbec, Barolo, Spanish Rioja
- Spirits (12): Bourbon 101, American Rye, Scotch Single Malt, Scotch Blended, Tequila & Mezcal, Gin Essentials, Rum, Cognac & Brandy, Japanese Whisky, Irish Whiskey, Vodka Basics, Liqueurs & Amaro
- Beer (8): IPA Styles, Local Craft IPAs SE, Belgian Ales, Lagers & Pilsners, Stouts & Porters, Sours & Goses, Wheat Beers, Reading a Beer Label
- Cocktails (8): Old Fashioned, Negroni, Whiskey Sour Family, Martini, Margarita Family, Aperitivo & Spritzes, Classic Highballs, Food & Drink Pairings
- **Custom modules per-store**: owner uploads a PDF → Claude generates module + quiz automatically. Key retention feature for Enterprise.

### 02 · Megan Assistant — Floor Assistant
Live AI on the floor. Staff ask by text or voice — Megan answers from the store's real inventory.
- Text + voice Q&A in-app
- Knows store's real inventory (CSV upload or live POS API)
- Guided customer walk by voice (back-and-forth questioning)
- Query log for managers
- **$199 / location / mo** · ~77% gross margin

**Voice stack:** Staff speaks → Deepgram STT → Claude Sonnet 4.6 + store inventory → ElevenLabs TTS → Megan speaks back. Orchestrated by **VAPI**. Under 900ms total latency. Megan's knowledge base prompt-cached (90% cost reduction).

### 03 · Megan Receptionist — Inbound Calls
Store owner forwards their number to Megan. She answers 24/7 — hours, directions, inventory, hold requests, pairings.
- Store owner forwards existing number
- Answers in under 2 rings
- Hold requests logged + staff notified (push)
- Transfers to human if needed
- Call log in manager dashboard
- **+$49 add-on / mo** (not a tier — add-on to any plan) · ~63% margin on add-on

**Flow:**
1. Owner sets forwarding in dashboard (2 min, no hardware)
2. VAPI provisions dedicated local-area-code number
3. Megan handles call using Claude Sonnet 4.6 + live store data
4. Transfers or logs hold → staff push notification
5. Customer gets iMessage recap via Sendblue

### 04 · Megan Shopper — Customer App
Customer-facing web app. Browse inventory, ask Megan for pairings by voice or chat, tap "Hold this for me" — staff get instant push notification.
- Browse store inventory remotely
- AI pairing recommendations (voice + chat)
- "Hold this" request button — staff notified instantly
- Staff confirms hold → customer gets iMessage confirmation
- No download — runs in browser
- **$399 / location / mo** (Enterprise plan)

### 05 · Megan Texting — Customer Messaging
Personalized iMessage recap after every call or chat session.
- iMessage via **Sendblue** — no A2P needed
- Blue bubble (feels personal)
- **Claude Haiku 4.5** writes each summary individually
- Two-way conversation (customer can reply)
- RCS + SMS fallback for Android
- Contact card on first message
- **+$50 uplift → Pro Plus $249 / location / mo** · ~70% gross margin
- One BevTek Sendblue account, one dedicated line per store

## Pricing

| Plan | Price/mo | Included | Margin |
|---|---|---|---|
| **Starter** | $79 | Megan Trainer (up to 10 staff) | ~85% |
| **Pro** | $199 | + Megan Assistant (unlimited staff) | ~77% |
| **Pro Plus** | $249 | + Megan Texting (iMessage recaps) — **most popular** | ~70% |
| **Enterprise** | $399 | + Megan Shopper + live POS sync + multi-location | ~77% |

**Add-ons:**
- Megan Receptionist — $49/mo
- White-glove onboarding — $149 one-time
- Custom branded voice — $99 setup + $19/mo
- Extra module pack — $49/mo

**14-day free trial · No credit card to start.**

Billed via Stripe on the web. Apple / Google take zero (app is free to download; billing bypasses app stores).

## Unit economics

- Year 1 Metro Atlanta target: **23 stores** (8 Starter + 12 Pro Plus + 3 Enterprise) = **$4,525 MRR / $54,300 ARR** / ~$3,500/mo net profit
- Every additional store adds $175–310 in near-pure profit
- 2 Pro stores cover all operating costs

## Affiliate / partner program

**Three tiers:**

### Tier 1 — POS companies (20% recurring, 90-day cookie)
Lightspeed, KORONA, mPower, Bottle POS. Integrating with their POS makes BevTek a value-add.
- Example: 10 Pro Plus stores = $373.50/mo to partner

### Tier 2 — Payment processors (15% recurring, 60-day cookie)
Merchant services reps and ISOs.
- Example: 10 Pro Plus stores = $373.50/mo to partner

### Tier 3 — Store referrals ($150 one-time, 30-day cookie)
Happy store owners refer other stores. Referred store gets 30-day free trial.

### Customer-facing affiliate code
Every affiliate also has a personal 10% discount code. Customers save 10%, affiliate earns 15% recurring on that account. 90-day cookie.

## Technical architecture

**Stack layers:**
- **Customer layer:** Megan Trainer (iOS), Megan Shopper (web)
- **AI layer:** Claude Sonnet 4.6 (reasoning), Claude Haiku 4.5 (summaries), VAPI (voice orchestration), ElevenLabs (TTS), Deepgram (STT)
- **Data layer:** Supabase Postgres, file storage for CSVs
- **Business layer:** Manager dashboard on Vercel, Stripe billing
- **Messaging layer:** Sendblue iMessage, Expo Push (staff)

**Multi-tenant model:** every table has `store_id`. One database, all stores. Scales to 10,000 stores with zero infrastructure changes.

**Full tool stack:**
- Claude Max + Claude Code — $100/mo
- Supabase — $0–25/mo
- Vercel — $0–20/mo
- Stripe — 2.9% + $0.30
- **VAPI** — ~$0.05/min (voice AI orchestration — floor assistant + inbound receptionist, Claude as LLM)
- ElevenLabs — $5/mo+
- Sendblue — $29/line/mo
- Expo + React Native — free

## 5-week build roadmap

### Week 1 — Foundation + all 44 modules written
- Supabase schema, auth, staff invite system
- Claude writes all 44 training modules in one session (quizzes, flavor profiles, pairings)
- GitHub repo

### Week 2 — Owner portal + Stripe billing
- Self-serve signup at bevtek.ai
- Stripe checkout with 14-day trial
- 5-step onboarding wizard
- Automated welcome email sequence
- Affiliate portal via **Rewardful**

### Week 3 — Megan Assistant text floor mode
- Ask Megan tab
- Claude API + inventory context
- CSV inventory parser
- Floor query AI answers
- Query log
- Sendblue provisioning per store

### Week 4 — Voice AI + Megan Receptionist
- VAPI integration, ElevenLabs voice
- Mic button in app
- Guided walk flow
- Module narration
- VAPI inbound phone number per store
- Call transfer back to store

### Week 5 — App Store submit + first customers
- QA, App Store assets, Apple review submission
- Stripe go-live
- First 3 beta stores from Metro Atlanta network — Grapes & Grains contacts

### Weeks 6–8 — Megan Shopper
- Public web app, browse, AI pairing, hold requests, staff push

### Weeks 9–14 — Scale + POS integrations
- Live API connections to Lightspeed, KORONA, mPower
- Custom module builder (PDF upload)
- Multi-location dashboard
- Android publish
- Advanced analytics

## Build cost summary

- Claude Max (while building): $100/mo
- All other tools (free tiers): $0
- **Total to build entire platform: $400–600**
- vs. $60,000–120,000 from a dev agency
