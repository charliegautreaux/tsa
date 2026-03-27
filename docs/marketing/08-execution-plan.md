# 08 — Phased Execution Plan: Marketing & Ad Revenue Strategy

**Site**: PreBoard.ai | **Date**: 2026-03-26 | **Synthesized from**: docs 01-07

---

## Overview

This document consolidates the 7 marketing strategy documents into a single, actionable, phased execution roadmap. Each task includes the specific file path to create or modify, estimated effort, dependencies, and the source document. All tasks are scoped for a solo developer on the existing Next.js 15 / Cloudflare Workers stack.

**Current state**: MVP live at `https://preboard.cgautreauxnc.workers.dev` with homepage, ~400 airport detail pages, report page, REST API, autonomous feed discovery, prediction engine, and hourly data rollups. No analytics, no ads, no content pages, no SEO optimization, no affiliate integrations.

---

## PHASE 1: Analytics & Foundation (Weeks 1-2)

**Goal**: Install measurement infrastructure, apply to ad networks, establish privacy compliance, and lay basic SEO groundwork. No revenue yet — this phase is pure instrumentation.

**Revenue milestone**: $0 (instrumentation only). Hosting break-even ($7/mo) targeted for month 2-3 per doc 05.

### Task 1.1 — Install Google Analytics 4

**Source**: Doc 06, Doc 01 | **Effort**: 2h | **Dependencies**: None

**Files**:
- Modify: `src/app/layout.tsx` — Add GA4 `<Script>` tags with `strategy="afterInteractive"`
- Create: `src/components/analytics/ga-provider.tsx` — `'use client'` wrapper for `gtag` initialization

**Details**:
- Create GA4 property, get measurement ID (G-XXXXXXXXXX)
- Store ID in `wrangler.jsonc` under `vars.NEXT_PUBLIC_GA_MEASUREMENT_ID`
- Track custom events: `page_type` (homepage/airport_detail/report), `airport_code`, `device_type`

### Task 1.2 — Cookie Consent Banner

**Source**: Doc 06 §1.3 | **Effort**: 3h | **Dependencies**: 1.1

**Files**:
- Create: `src/components/consent/cookie-banner.tsx` — Fixed bottom banner, Accept/Decline, `localStorage` persistence, glass morphism design
- Create: `src/lib/utils/consent.ts` — `getConsent()`, `setConsent()`, `hasConsented()`
- Modify: `src/app/layout.tsx` — Render `<CookieBanner />` after `<Footer />`

**Details**:
- Use Google Consent Mode v2 (`gtag('consent', 'default', { analytics_storage: 'denied' })`)
- Mediavine replaces this with their CMP after approval — build as replaceable component

### Task 1.3 — Basic SEO: Meta Tags, Sitemap, Robots

**Source**: Doc 03 | **Effort**: 4h | **Dependencies**: None

**Files**:
- Modify: `src/app/layout.tsx` — Add `metadataBase`, `robots`, `twitter` card metadata
- Modify: `src/app/page.tsx` — Page-specific title/description targeting "tsa wait times"
- Modify: `src/app/airports/[code]/page.tsx` — Enhanced `generateMetadata` with airport name
- Create: `src/app/sitemap.ts` — Dynamic sitemap from `getAllAirports(env.DB)`
- Create: `src/app/robots.ts` — Allow all crawlers, reference sitemap URL

**Details**:
- Normalize airport codes to prevent duplicate content (`/airports/atl` vs `/airports/ATL`)
- Submit sitemap to Google Search Console after deploy

### Task 1.4 — Apply to Journey by Mediavine

**Source**: Doc 01 §Phase 1 | **Effort**: 1h | **Dependencies**: 1.1 (GA4 must be live)

**External**: Apply at mediavine.com once GA4 shows 1K+ sessions/month. Journey requires 1K sessions tracked via Grow or GA4. Fallback: Google AdSense (no minimum, lower RPMs $2-5).

### Task 1.5 — Ad Slot Infrastructure (Pre-Approval)

**Source**: Doc 02, Doc 06 §2.1 | **Effort**: 4h | **Dependencies**: None

**Files**:
- Create: `src/components/ads/ad-slot.tsx` — Server component with `data-ad-slot`, pre-reserved `min-height`
- Create: `src/components/ads/lazy-ad.tsx` — `'use client'` with `IntersectionObserver` (200px rootMargin)
- Create: `src/components/ads/ad-config.ts` — Slot IDs and sizes per page type
- Modify: `src/app/page.tsx` — Reserve in-feed ad space after 8th and 16th `<AirportCard>`
- Modify: `src/app/airports/[code]/page.tsx` — Reserve sidebar (desktop 2-col layout), between-checkpoint, below-list slots
- Modify: `src/app/globals.css` — `.ad-slot-*` classes with `min-height` for CLS prevention

### Task 1.6 — Web Vitals Monitoring

**Source**: Doc 06 §2.3 | **Effort**: 2h | **Dependencies**: 1.1

**Files**:
- Create: `src/components/analytics/web-vitals.tsx` — Reports LCP, CLS, INP to GA4
- Modify: `src/app/layout.tsx` — Render `<WebVitals />`

**Targets**: LCP < 2.5s, CLS < 0.10, INP < 200ms

### Phase 1 Summary

| Task | Effort | Depends On | Source |
|------|--------|-----------|--------|
| 1.1 GA4 | 2h | — | 06 |
| 1.2 Consent Banner | 3h | 1.1 | 06 |
| 1.3 SEO Meta + Sitemap | 4h | — | 03 |
| 1.4 Apply Mediavine | 1h | 1.1 | 01 |
| 1.5 Ad Slot Infrastructure | 4h | — | 02, 06 |
| 1.6 Web Vitals | 2h | 1.1 | 06 |
| **Total** | **16h** | | |

---

## PHASE 2: Content Engine (Weeks 3-6)

**Goal**: Build blog and guide page infrastructure, publish first 10 airport guides and 5 blog posts, implement structured data. This phase drives the organic traffic that all revenue depends on.

**Revenue milestone**: $0-37/mo (conservative-moderate per doc 05).

### Task 2.1 — Blog Infrastructure

**Source**: Doc 03 §Pillar 2, Doc 06 §4.1 | **Effort**: 6h | **Dependencies**: None

**Files**:
- Create: `src/content/blog/` — Markdown posts with YAML frontmatter
- Create: `src/lib/content/blog.ts` — Parse markdown + frontmatter at build time
- Create: `src/lib/types/content.ts` — `BlogPost`, `GuidePageData` types
- Create: `src/app/blog/page.tsx` — Blog index with post cards
- Create: `src/app/blog/[slug]/page.tsx` — Post page with `generateStaticParams`, ad slots
- Create: `src/components/blog/post-card.tsx` — Card component for blog index
- Create: `src/components/blog/markdown-renderer.tsx` — `'use client'` with Tailwind Typography
- Modify: `package.json` — Add `gray-matter`, `@tailwindcss/typography`
- Modify: `src/components/layout/top-nav.tsx` — Add Blog nav link
- Modify: `src/components/layout/footer.tsx` — Add Blog, Privacy, Disclosure links

### Task 2.2 — Airport Guide Page Infrastructure

**Source**: Doc 03 §Pillar 1, Doc 06 §4.1 | **Effort**: 8h | **Dependencies**: None

**Files**:
- Create: `src/app/airports/[code]/guide/page.tsx` — SSR guide page with:
  1. H1: "TSA Wait Times at {Name} ({IATA}): Everything You Need to Know"
  2. Live data widget from `getCurrentWaits(env.DB, code)`
  3. Peak hours chart from `getHistoricalAverages(env.DB, code)`
  4. Terminal-by-terminal breakdown from `getCheckpoints(env.DB, code)`
  5. PreCheck/CLEAR info with affiliate CTA placeholders
  6. FAQ section with schema markup
- Create: `src/components/guide/peak-hours-chart.tsx` — Heatmap of avg wait by hour
- Create: `src/components/guide/live-wait-widget.tsx` — Compact current wait, links to detail page
- Create: `src/components/guide/precheck-info.tsx` — Lane availability + affiliate placeholder
- Create: `src/content/guides/` — Airport-specific markdown overrides
- Modify: `src/app/airports/[code]/page.tsx` — Add "Read our guide" internal link

**Top 30**: ATL, LAX, ORD, DFW, DEN, JFK, SFO, SEA, LAS, MCO, CLT, PHX, MIA, IAH, BOS, MSP, FLL, DTW, PHL, LGA, BWI, SLC, DCA, IAD, SAN, TPA, PDX, HNL, STL, AUS

### Task 2.3 — Structured Data (JSON-LD)

**Source**: Doc 03, Doc 06 §4.3 | **Effort**: 3h | **Dependencies**: 2.1, 2.2

**Files**:
- Create: `src/components/seo/json-ld.tsx` — `ArticleJsonLd`, `FAQJsonLd`, `WebPageJsonLd`, `OrganizationJsonLd`
- Modify: `src/app/layout.tsx`, blog post page, guide page, airport detail page

### Task 2.4 — Publish First 10 Airport Guides

**Source**: Doc 03 | **Effort**: 10h | **Dependencies**: 2.2

**Files**: Create `src/content/guides/{ATL,LAX,ORD,DFW,DEN,JFK,SFO,SEA,LAS,MCO}.md`

### Task 2.5 — Publish First 5 Blog Posts

**Source**: Doc 03 §Pillar 2, Doc 04 | **Effort**: 12h | **Dependencies**: 2.1

**Files**:
- `src/content/blog/tsa-precheck-vs-clear.md` — 12K monthly volume, very high affiliate value
- `src/content/blog/how-to-get-tsa-precheck.md` — 40K volume, cornerstone affiliate page
- `src/content/blog/worst-airports-tsa-wait-times.md` — 5K volume, high linkability
- `src/content/blog/best-time-airport-security.md` — 8K volume
- `src/content/blog/tsa-security-rules-2026.md` — 15K volume

### Phase 2 Summary

| Task | Effort | Depends On | Source |
|------|--------|-----------|--------|
| 2.1 Blog Infrastructure | 6h | — | 03, 06 |
| 2.2 Guide Page Infrastructure | 8h | — | 03, 06 |
| 2.3 Structured Data | 3h | 2.1, 2.2 | 03 |
| 2.4 First 10 Guides | 10h | 2.2 | 03 |
| 2.5 First 5 Blog Posts | 12h | 2.1 | 03, 04 |
| **Total** | **39h** | | |

---

## PHASE 3: Monetization Integration (Weeks 7-12)

**Goal**: Activate ad revenue, integrate affiliate programs, add contextual CTAs. First real revenue.

**Revenue milestone**: $98-183/mo by end of month 3 (conservative-moderate per doc 05).

### Task 3.1 — Activate Mediavine Ad Script

**Source**: Doc 01, Doc 06 §1.1 | **Effort**: 2h | **Dependencies**: 1.4 approved, 1.5 built

**Files**:
- Modify: `src/app/layout.tsx` — Add Mediavine `<script src="//scripts.mediavine.com/tags/preboard.js" async />`
- Modify: `src/components/consent/cookie-banner.tsx` — Replace with Mediavine's built-in CMP

### Task 3.2 — Page-Specific Ad Placement Activation

**Source**: Doc 02 (full blueprint) | **Effort**: 6h | **Dependencies**: 3.1

**Files to modify** (all ad slots from Task 1.5 get activated):
- `src/app/page.tsx` — Homepage: leaderboard below H1, in-feed after cards 8/16, mobile adhesion
- `src/app/airports/[code]/page.tsx` — Sidebar sticky 300x250, between-checkpoint 728x90 fluid, below-list 336x280, mobile adhesion. Pass `data-airport={code}` for geo-targeting.
- `src/app/airports/[code]/guide/page.tsx` — Leaderboard above H2, in-content every 3-4 paragraphs, sidebar skyscraper, end-of-article rectangle (4-6 units)
- `src/app/blog/[slug]/page.tsx` — Same as guide pages
- Report page — Sidebar only during form, PreCheck CTA on thank-you screen

### Task 3.3 — Affiliate Account Setup & CTA Components

**Source**: Doc 04, Doc 06 §3 | **Effort**: 8h | **Dependencies**: None

**External**: Apply to CJ Affiliate, Amex affiliate, Bankrate, FlexOffers, Travelpayouts

**Files**:
- Create: `src/components/affiliate/precheck-cta.tsx` — Contextual CTA when wait > 15 min
- Create: `src/components/affiliate/clear-cta.tsx` — CTA on checkpoints with `has_clear`
- Create: `src/components/affiliate/credit-card-cta.tsx` — Sidebar CTA for guide/blog pages
- Create: `src/components/affiliate/parking-cta.tsx` — Guide page parking section
- Create: `src/components/affiliate/disclosure.tsx` — FTC-required disclosure component
- Create: `src/app/disclosure/page.tsx` — Full affiliate disclosure page
- Create: `src/app/privacy/page.tsx` — Privacy policy page
- Modify: `src/app/airports/[code]/page.tsx` — Render PreCheck/CLEAR CTAs
- Modify: `src/components/layout/footer.tsx` — Add Disclosure, Privacy links

### Task 3.4 — Affiliate Click Tracking

**Source**: Doc 06 §5.1 | **Effort**: 3h | **Dependencies**: 3.3, 1.1

**Files**:
- Create: `src/lib/utils/affiliate-tracking.ts` — `trackAffiliateClick(provider, placement, page)` → GA4 events
- Modify: All affiliate CTA components — Add `onClick` handler

### Task 3.5 — Blog Posts 6-10

**Source**: Doc 03 | **Effort**: 12h | **Dependencies**: 2.1, 3.3

**Files**: Create 5 more blog posts:
- `clear-plus-review.md` (6K volume), `airport-security-tips-first-time-flyers.md` (10K), `tsa-precheck-families.md` (4K), `real-id-tsa-requirements.md` (20K), `fastest-tsa-lines-america.md` (3K)

### Task 3.6 — Guide Pages 11-30

**Source**: Doc 03 | **Effort**: 10h | **Dependencies**: 2.2

**Files**: Create `src/content/guides/{CLT,PHX,MIA,IAH,BOS,MSP,FLL,DTW,PHL,LGA,BWI,SLC,DCA,IAD,SAN,TPA,PDX,HNL,STL,AUS}.md`

### Phase 3 Summary

| Task | Effort | Depends On | Source |
|------|--------|-----------|--------|
| 3.1 Activate Mediavine | 2h | 1.4, 1.5 | 01, 06 |
| 3.2 Page-Specific Ads | 6h | 3.1 | 02 |
| 3.3 Affiliate Setup + CTAs | 8h | — | 04, 06 |
| 3.4 Affiliate Tracking | 3h | 3.3, 1.1 | 06 |
| 3.5 Blog Posts 6-10 | 12h | 2.1, 3.3 | 03 |
| 3.6 Guide Pages 11-30 | 10h | 2.2 | 03 |
| **Total** | **41h** | | |

---

## PHASE 4: Scale & Optimize (Months 4-6)

**Goal**: Expand content to full coverage, launch programmatic SEO pages, implement API pricing, A/B test ad placements, enable video ads.

**Revenue milestone**: $313-427/mo by month 6 (moderate per doc 05).

### Task 4.1 — Batch-Generate Remaining ~370 Guide Pages

**Source**: Doc 03 | **Effort**: 6h | **Dependencies**: 2.2

- Create: `scripts/generate-guides.ts` — Queries all airports, generates template content for those without manual overrides
- Modify: `src/app/airports/[code]/guide/page.tsx` — Graceful fallback to DB-only template

### Task 4.2 — City-Pair Programmatic Pages

**Source**: Doc 03 §Pillar 3 | **Effort**: 8h | **Dependencies**: 2.2

- Create: `src/app/routes/[pair]/page.tsx` — "/routes/lax-to-jfk" programmatic pages
- Create: `src/lib/data/top-routes.ts` — Top 500 domestic routes
- Create: `src/components/routes/arrival-recommendation.tsx` — "Arrive X hours before your flight"

### Task 4.3 — Holiday/Seasonal Pages

**Source**: Doc 03 §Pillar 3 | **Effort**: 8h | **Dependencies**: 2.1

- Create: `src/app/travel/[slug]/page.tsx` — Seasonal content pages
- Create: `src/content/seasonal/thanksgiving-2026.md`, `christmas-2026.md`, `summer-travel-2026.md`
- Publish 4-6 weeks before each holiday

### Task 4.4 — API Rate Limiting & Pricing Tiers

**Source**: Doc 02 §5, Doc 06 §6.1, Doc 07 (FlightAware model) | **Effort**: 12h

- Create: `migrations/0003_api_keys.sql` — `api_keys` table
- Create: `src/app/api/v1/middleware.ts` — Rate limiting via KV
- Create: `src/app/api/v1/keys/route.ts` — Key creation (email signup)
- Create: `src/app/api-docs/page.tsx` — Public API documentation

| Tier | Rate Limit | Price |
|------|-----------|-------|
| Free | 100/day | $0 (email required) |
| Developer | 10K/day | $29/mo |
| Business | 100K/day | $199/mo |
| Enterprise | Unlimited | Custom |

### Task 4.5 — A/B Testing Ad Placements

**Source**: Doc 06 §5.1 | **Effort**: 6h | **Dependencies**: 3.1, 1.1

- Create: `src/lib/utils/ab-test.ts` — Variant assignment via cookie
- Modify: `src/app/airports/[code]/page.tsx` — Test leaderboard position, sidebar vs in-content

### Task 4.6 — Video Ad Integration

**Source**: Doc 01 §Phase 3, Doc 02 §2 | **Effort**: 3h | **Dependencies**: 3.1

- Modify: airport detail, guide, blog pages — Add Mediavine Universal Media Player
- Expected 23-34% RPM increase on pages with video units

### Task 4.7 — Ad Blocker Detection

**Source**: Doc 06 §6.2 | **Effort**: 2h | **Dependencies**: 1.1

- Create: `src/components/analytics/ad-block-detect.tsx` — Track rate to GA4 (no content gating)

### Task 4.8 — Evaluate Network Upgrade

**Source**: Doc 01 §Phase 2-3 | **Effort**: 2h | **Dependencies**: 3-6 months RPM data

- At $5K/yr revenue → auto-upgrade to Mediavine Official (75% rev share)
- At 25K+ pageviews → evaluate Raptive's 20% RPM guarantee

### Phase 4 Summary

| Task | Effort | Depends On | Source |
|------|--------|-----------|--------|
| 4.1 Remaining 370 Guides | 6h | 2.2 | 03 |
| 4.2 City-Pair Pages | 8h | 2.2 | 03 |
| 4.3 Seasonal Pages | 8h | 2.1 | 03 |
| 4.4 API Pricing | 12h | — | 02, 06, 07 |
| 4.5 A/B Testing | 6h | 3.1, 1.1 | 06 |
| 4.6 Video Ads | 3h | 3.1 | 01, 02 |
| 4.7 Ad Block Detect | 2h | 1.1 | 06 |
| 4.8 Network Eval | 2h | RPM data | 01 |
| **Total** | **47h** | | |

---

## Timeline Overview

| Week | Phase | Key Deliverables |
|------|-------|-----------------|
| 1 | 1 | GA4, consent banner, sitemap, robots.txt |
| 2 | 1 | Ad slot infrastructure, Web Vitals, Mediavine application |
| 3-4 | 2 | Blog + guide infrastructure, structured data, first 5 guides |
| 5-6 | 2 | First 5 blog posts, 5 more guides |
| 7-8 | 3 | Mediavine activated, page-specific ads, affiliate applications |
| 9-10 | 3 | Affiliate CTAs, disclosure page, blog posts 6-10 |
| 11-12 | 3 | Guide pages 11-30, affiliate tracking |
| 13-16 | 4 | Remaining 370 guides, city-pair pages, seasonal pages |
| 17-20 | 4 | API pricing, A/B testing, video ads |
| 21-24 | 4 | Ad blocker tracking, network upgrade eval |

---

## Revenue Projection by Phase (Moderate Scenario)

| Phase End | Month | Sessions/mo | Display Rev | Affiliate Rev | Total |
|-----------|-------|-------------|------------|--------------|-------|
| Phase 1 | 1 | 1,000 | $0 | $0 | **$0** |
| Phase 2 | 2 | 3,000 | $31 | $6 | **$37** |
| Phase 3 end | 3 | 8,000 | $82 | $16 | **$98** |
| Phase 4 start | 4 | 15,000 | $153 | $30 | **$183** |
| Phase 4 mid | 5 | 22,000 | $269 | $44 | **$313** |
| Phase 4 end | 6 | 30,000 | $367 | $60 | **$427** |

**Year 1 total**: ~$7,438 | **Year 2 annualized**: $50-60K | **$100K annualized**: 24-30 months

---

## Total Effort

| Phase | Duration | Hours | New Files | Modified Files |
|-------|----------|-------|-----------|---------------|
| 1 | Weeks 1-2 | 16h | ~8 | ~5 |
| 2 | Weeks 3-6 | 39h | ~20 | ~6 |
| 3 | Weeks 7-12 | 41h | ~10 | ~10 |
| 4 | Months 4-6 | 47h | ~12 | ~10 |
| **Total** | **6 months** | **143h** | **~50** | **~31** |

At ~10 hours/week, Phases 1-3 (critical revenue-enabling work) complete in ~10 weeks.

---

## Risk Register

| Risk | Prob. | Impact | Mitigation |
|------|-------|--------|-----------|
| Mediavine rejects (insufficient traffic) | Med | High | Fallback to AdSense. Build traffic via Phase 2 content, reapply. |
| CLS degrades with ads | Med | High | Pre-reserved `min-height` (1.5). Web Vitals monitoring (1.6). Roll back if CLS > 0.10. |
| Guide pages rank slowly | Med | Med | Focus top 30 airports first. Internal linking from data pages. |
| Affiliate programs reject | Low | Med | Multiple programs per category. CJ/Bankrate have low rejection rates. |
| Edge runtime ad script issues | Low | High | All ad scripts are client-side only — no server-side execution needed. |
