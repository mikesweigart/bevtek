# BevTek.ai — Product Vision & Alignment

_Canonical one-pager. Last confirmed with founder: 2026-04-18._

## 1. Overall Vision

An AI-powered beverage-retail experience that serves both customers and
employees under the BevTek umbrella.

- **In-store:** Customers and staff walk the store and talk to Gabby for
  intuitive, step-by-step guidance on what to choose (whiskey-hero, but
  all beverage categories supported).
- **Remote:** The same intelligence is available at home through a mobile
  app (iOS + Android).

The goal is a simple, intuitive, guided experience that makes beverage
discovery easy, fun, and consistent — whether a customer is in the aisle
or on the couch.

## 2. Gabby — Customer & In-Store Assistant

**Primary role:** customer-facing guide, in-store and remote.

- Helps customers discover products based on taste, occasion, budget.
- Used side-by-side with an employee in the aisle, or directly by a
  customer on their own.
- Lives in the BevTek mobile app (iOS App Store + Google Play) and on the
  web storefront (`/shop/[slug]`).
- Customers can browse, learn, pair, gift, and hold/reserve products.
- Promotions and featured items are integrated but secondary — guidance
  always leads. [SPONSORED] items carry a mandatory verbal disclosure.

## 3. Megan — Employee Training & Enablement

**Primary role:** internal trainer + product-knowledge hub. Staff only.

- Self-paced, scenario-based learning in digestible sessions.
- Gamified: quizzes, challenges, streaks, leaderboards.
- Manager visibility: who's engaging, who's leveling up, where the
  knowledge gaps are — supports coaching and incentives.
- Shares the same underlying product/knowledge logic as Gabby, just
  oriented toward staff instead of customers.

## 4. Channels & Technology

- **Mobile app** (Expo / React Native) — role-based experiences for
  customers and employees from a single binary.
- **Web app** (Next.js) — shopper storefront + owner/manager portal.
- **AI voice** — users talk to Gabby (and eventually Megan) in a
  conversational, voice-first experience. TTS baseline via `expo-speech`;
  realtime conversational voice is a Phase-2 build.
- **In-store and remote are both first-class.** Not "mobile as an
  afterthought" and not "web-only with a companion app."

## 5. Future Extensions (roadmap, not current focus)

- **Inbound calling agent** — voice agent customers can call for
  recommendations, store info, product guidance. (Receptionist tier.)
- **E-commerce integration** — Gabby's logic wired into the retailer's
  online store so customers can get recommendations and add items
  directly to a cart.

## 6. Core Principles

- **Intuitive and guided** — feels like walking the store with a great,
  knowledgeable human guide.
- **Unified experience** — one brain powers Gabby (customer), Megan
  (staff), and future voice + online surfaces.
- **Support, not replace, staff** — employees become smarter, faster, and
  more confident with customers. Tools augment, never sideline.

## 7. Positioning notes

- **Whiskey-hero, all-beverage product.** Marketing leads with whiskey
  because that's the highest-margin discovery problem and the best demo,
  but the platform treats beer, wine, and spirits as first-class (Reviews
  Pass 3 routes to Vivino / Untappd / Distiller accordingly).
- **Vendors invisible to customers.** Retell, Sendblue, ElevenLabs, etc.
  are infrastructure — customers see only "BevTek.ai" and "Megan/Gabby."

## 8. Known gaps vs. this vision

Called out so they don't silently drift:

- **In-aisle hand-off UX** — today an employee just opens Gabby on their
  own device. No explicit "hand the session to the customer" flow (e.g.
  QR push). Needs a small design pass if side-by-side is a launch UX.
- **Conversational voice Gabby** — TTS primitives exist; realtime STT,
  barge-in, and interruption handling do not. Phase decision pending.
- **Manager analytics for Megan** — leaderboards ship; the "who's
  engaging, where are the gaps" manager dashboard is Tier 3 roadmap.
- **Voice-mode sponsored disclosure + responsible-drinking footer** —
  text-mode is done; voice replies still need the verbal cues wired.

## 9. What's shipped toward this vision (as of 2026-04-18)

- Two-persona architecture (Megan Trainer staff-only, Gabby everywhere
  customer-facing).
- Role-based mobile app (CustomerTabs vs EmployeeTabs).
- Web shopper storefront + owner/manager portal.
- Inventory enrichment pipeline with community review scores (Vivino /
  Untappd / Distiller) and FTC-compliant sponsored-boost in Gabby.
- Age gate (21+) on both web and mobile.
- Promotions loop: schema → Gabby boost → owner `/promotions` view →
  admin `/admin/promotions` CRUD.
