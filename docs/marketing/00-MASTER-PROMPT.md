# PreBoard.ai — Ad Revenue Maximization Research Prompt

**Created**: 2026-03-26
**Author**: Charlie Gautreaux
**Repo**: github.com/charliegautreaux/tsa
**Status**: Ready for execution

---

## Context

**PreBoard.ai** is a real-time TSA security wait times web application covering ~400 US commercial airports. The product is built on Next.js 15 / React 19 / Tailwind 4, deployed entirely on Cloudflare's edge stack (Workers, D1, KV, R2, Durable Objects) with a near-zero hosting cost (~$7/mo domain only). The site features:

- **Homepage**: Grid of airport cards sorted by worst current wait, color-coded severity (green → red), with search and dark mode.
- **Airport detail pages**: `/airports/[code]` — per-airport view showing live checkpoint data, lane types (Standard, TSA Pre✓, CLEAR), trend arrows, data tier badges, and source count.
- **Report page**: `/report` — crowdsourced wait time submission form (airport code, checkpoint, lane type, wait minutes, notes).
- **Prediction engine**: ML-based forecasting using historical patterns, weather, flight schedule, and feed data.
- **API layer**: RESTful `/api/v1/*` — airports, checkpoints, live data, history, predictions, national stats, map overview, worst-wait rankings.
- **Autonomous feed discovery**: Workers that scan, validate, and promote data sources through a lifecycle (pending → trial → active → degraded → dead).

**Key site characteristics for ad strategy**:
- ~400 unique airport landing pages (massive SEO surface area)
- Highly intent-driven traffic (travelers actively checking wait times before heading to the airport)
- Short session duration, high urgency (users want the number fast, then leave)
- Mobile-heavy audience (checking at home, in rideshare, at the airport)
- Repeat usage pattern (frequent travelers bookmark and return)
- Seasonal traffic spikes (holidays, spring break, summer travel)
- Geographic targeting potential (user is telling you which airport = which city)
- Crowdsourced engagement loop (report → return to check → report again)

---

## Objective

Produce a comprehensive, actionable ad revenue maximization plan for PreBoard.ai, stored as a set of detailed documents in `docs/marketing/`. The plan must be specific to THIS site's architecture, traffic patterns, and user behavior — not generic "how to monetize a website" advice.

---

## Required Deliverables

### 1. `01-ad-network-strategy.md` — Ad Network Selection & Tiering
Research and recommend the optimal ad network progression as PreBoard.ai scales:
- **Phase 1 (0–10K monthly sessions)**: What to start with and why (e.g., Google AdSense, alternatives)
- **Phase 2 (10K–50K sessions)**: Mid-tier networks (Ezoic, Monumetric, etc.) — eligibility thresholds, RPM comparison, approval requirements
- **Phase 3 (50K+ sessions)**: Premium networks (Mediavine, AdThrive/Raptive, etc.) — entry requirements, expected RPMs for travel-adjacent content, lock-in terms
- **Programmatic considerations**: Header bidding setup, SSP selection, direct deal potential with travel/airline advertisers
- Include a comparison table: network name, minimum traffic, RPM range (for travel niche), payment terms, exclusivity requirements, pros/cons

### 2. `02-ad-placement-blueprint.md` — Placement Strategy by Page Type
For each page type in PreBoard.ai, define exact ad placement recommendations:
- **Homepage (airport grid)**: Where ads go without destroying the card grid UX. In-feed native ads? Banner above grid? Sticky footer?
- **Airport detail page (`/airports/[code]`)**: This is the money page. Where do ads go around live checkpoint data? Consider: above-the-fold leaderboard, between checkpoint rows, sidebar (desktop), sticky bottom (mobile), interstitial on page load?
- **Report page**: Should this have ads at all? (Consider: user is contributing value — friction risk)
- **API responses**: Can the API be monetized (rate-limited free tier, paid tier for developers/apps)?
- Include wireframe-level descriptions of each placement (e.g., "728x90 leaderboard between the airport header and first checkpoint row")
- Address mobile vs desktop layouts explicitly
- Define ad density limits to avoid Google policy violations and UX damage

### 3. `03-seo-content-strategy.md` — Content Expansion for Ad Revenue
The site currently has ~400 airport pages with real-time data. To maximize ad revenue, it needs high-value content pages that rank and attract organic traffic:
- **Airport guide pages**: `/airports/[code]/guide` — "TSA Wait Times at ATL: Tips, Peak Hours, and How to Skip the Line" — templated content pages for each airport with estimated peak times, terminal maps, Pre✓ lane availability, CLEAR enrollment info, nearby TSA enrollment centers
- **Blog/editorial content**: Travel tips, TSA policy explainers, Pre✓ vs CLEAR comparison, seasonal travel forecasts, "worst airports for TSA waits" rankings
- **Programmatic SEO opportunities**: City-pair pages ("How early should I arrive at LAX for a flight to JFK?"), holiday-specific pages ("TSA Wait Times on Thanksgiving 2026"), terminal-specific pages
- Keyword research targets (long-tail travel intent keywords with commercial value)
- Internal linking strategy between data pages and content pages
- Content calendar / production cadence recommendation

### 4. `04-affiliate-revenue-layer.md` — Affiliate & Partnership Monetization
Identify affiliate and partnership revenue opportunities native to the TSA/travel context:
- **TSA PreCheck enrollment**: Affiliate link to TSA PreCheck application ($78–$85 enrollment fee — is there an affiliate program? Research actual programs like IDEMIA/Telos)
- **CLEAR membership**: CLEAR Plus referral/affiliate program details, commission structure
- **Travel insurance**: Contextually relevant when travelers are already thinking about their trip
- **Airport lounge access**: Priority Pass, Plaza Premium affiliate programs
- **Rideshare/parking**: Airport parking aggregators (SpotHero, The Parking Spot), rideshare referral codes
- **Travel credit cards**: Cards with TSA PreCheck/Global Entry credit (high CPA: $50–200+ per approval)
- For each: program name, commission structure, how it integrates into PreBoard.ai's UX, expected conversion rate, revenue potential per 1K pageviews

### 5. `05-monetization-projections.md` — Revenue Modeling
Build a bottoms-up revenue projection model:
- **Traffic assumptions**: Model three scenarios (conservative, moderate, aggressive) for monthly sessions over 12 months post-launch, benchmarked against comparable travel utility sites
- **RPM assumptions**: Display ad RPMs by page type and traffic tier, broken out by desktop vs mobile
- **Affiliate conversion assumptions**: Click-through rates and conversion rates for each affiliate category
- **Blended revenue per session**: Combine display + affiliate + API monetization
- **Monthly revenue projections**: Table showing months 1–12 for each scenario
- **Break-even analysis**: When does ad revenue cover the ~$7/mo hosting? When does it become meaningful ($100/mo, $1K/mo, $10K/mo)?
- **Sensitivity analysis**: What levers matter most (traffic vs RPM vs affiliate conversion)?

### 6. `06-implementation-roadmap.md` — Technical Implementation Plan
Specific to PreBoard.ai's Next.js/Cloudflare architecture:
- **Ad tag integration**: How to add Google AdSense / ad network tags to Next.js App Router with edge runtime. Lazy loading ads, avoiding CLS (Cumulative Layout Shift) penalties, handling server-side rendering
- **Consent management**: GDPR/CCPA compliance — cookie consent banner implementation, TCF 2.0 framework if targeting EU travelers
- **Core Web Vitals protection**: Ad loading strategy that preserves LCP, FID, CLS scores (critical for SEO rankings)
- **A/B testing framework**: How to test ad placements and measure impact on both revenue and user engagement
- **Ad blocker detection**: Strategy and whether to gate content or just track the rate
- **Analytics setup**: GA4 + ad network reporting, custom events for ad viewability, RPM tracking by page type
- Phased implementation timeline (what to do in week 1, month 1, month 3, month 6)

### 7. `07-competitive-intelligence.md` — Competitor Ad Strategy Analysis
Research how comparable travel utility sites monetize:
- **MyTSA (TSA's official app)**: Does it have ads? What's its UX?
- **FlightAware**: Ad placement strategy, network used, estimated traffic/revenue
- **Airport-specific sites**: Do major airport websites (ATL, LAX, ORD) show ads on their wait time pages?
- **Google Flights / Google Travel**: How does Google display TSA info and what ads appear alongside?
- **Waze / Google Maps**: How do travel-adjacent apps monetize utility data?
- Identify gaps and opportunities where PreBoard.ai can do better

---

## Research Guidelines

- **Be specific, not generic.** Every recommendation should reference PreBoard.ai's actual page structure, tech stack, or user flow. "Add display ads" is not useful. "Place a 300x250 medium rectangle between the checkpoint list and the forecast chart on `/airports/[code]`, lazy-loaded after the first viewport paint" is useful.
- **Cite sources.** Link to ad network documentation, affiliate program pages, and industry benchmarks.
- **Think mobile-first.** PreBoard.ai's audience is disproportionately mobile. Every placement must be specified for both form factors.
- **Respect the UX.** The site's value is speed — users want the wait time number instantly. Ads must not delay this. Any recommendation that materially degrades time-to-first-useful-data should be flagged as high-risk.
- **Consider the Cloudflare edge architecture.** The site runs on Workers/D1/KV with edge runtime. Ad implementations must be compatible with this stack (no traditional Node.js server-side ad serving).
- **Revenue per mille (RPM) estimates should be travel-niche specific.** Generic web RPMs ($2–5) don't apply; travel intent keywords command premium CPMs.

---

## Output Format

All deliverables go in `docs/marketing/` as numbered markdown files (01 through 07). Each document should be self-contained, detailed, and actionable. Include tables, specific dollar amounts, and implementation code snippets where relevant.

---

## Execution Command

> Use this prompt with web search enabled to research current (2026) ad network requirements, affiliate program terms, travel niche RPM benchmarks, and competitor strategies. Produce all 7 deliverables in sequence.
