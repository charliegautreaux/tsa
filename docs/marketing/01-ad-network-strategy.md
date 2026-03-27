# 01 — Ad Network Selection & Tiering Strategy

**Site**: PreBoard.ai | **Date**: 2026-03-26 | **Author**: Research by Claude for Charlie Gautreaux

---

## Executive Summary

PreBoard.ai's travel-utility positioning places it in one of the highest-CPM display ad verticals. Travel niche websites on premium networks see session RPMs of $10–$25 (US-heavy traffic in Q2–Q4), with top performers exceeding $30 in peak travel season. The strategy below maps the network progression as PreBoard.ai scales from zero to 50K+ monthly sessions.

---

## Phase 1: Launch to 10K Monthly Sessions

### Recommended: Journey by Mediavine

As of January 2026, Mediavine's Journey program accepts sites with as few as **1,000 monthly sessions**, tracked via the Grow plugin. This is the optimal starting point for PreBoard.ai because:

- **Higher RPMs than AdSense**: Journey publishers report average session RPMs of ~$11, with travel sites often seeing $15–$20. Compare this to Google AdSense, which typically delivers $2–$5 RPMs for similar traffic.
- **Mediavine ad tech**: Even at the Journey tier, you get Mediavine's proprietary ad stack — lazy-loaded ads, automatic placement optimization, and ad refresh.
- **Revenue share**: 70% to publisher at the Journey tier.
- **No exclusivity lock-in**: Journey allows you to switch networks, unlike full Mediavine.
- **Growth path**: Once you hit $5,000/year in ad revenue, you automatically upgrade to Mediavine "Official" (75% revenue share).

**Alternative — Google AdSense**: No minimum traffic, but RPMs are significantly lower ($2–$5 for travel). AdSense also tends to degrade Core Web Vitals more than Mediavine. Use AdSense only if Journey rejects the application (unlikely for a quality Next.js site with original data content).

**Setup considerations for PreBoard.ai**: The Grow plugin is WordPress-native. Since PreBoard.ai is a Next.js app on Cloudflare, you'll integrate via the Mediavine script tag directly rather than the plugin. Journey supports non-WordPress sites — you'll paste the ad script into `layout.tsx`.

---

## Phase 2: 10K–50K Monthly Sessions

### Recommended: Stay on Mediavine Journey → Upgrade Path

At this traffic level, the best move is to stay on Journey and let the revenue accumulate toward the $5,000/year threshold for automatic upgrade to Mediavine Official. Here's why:

- At 25K sessions/month with a $15 RPM, you'd earn ~$375/month or ~$4,500/year — close to the upgrade threshold.
- Mediavine Official increases revenue share to **75%** and unlocks additional optimization tools.

### Alternative Evaluation

| Network | Min. Traffic | RPM (Travel) | Rev Share | Lock-in | Notes |
|---------|-------------|-------------|-----------|---------|-------|
| **Mediavine Journey** | 1K sessions | $11–$20 | 70% | None | Best early option |
| **Mediavine Official** | $5K/yr revenue | $15–$25 | 75% | Exclusive | Auto-upgrade from Journey |
| **Raptive (fmr. AdThrive)** | 25K pageviews | $15–$30 | 75% | Exclusive | Strong alternative at 25K PV |
| **Ezoic** | None | $5–$12 | Varies | None | AI-driven optimization, lower RPMs |
| **Monumetric** | 10K pageviews | $8–$15 | ~70% | 6-mo minimum | Mid-tier option |
| **SHE Media** | ~20K sessions | $8–$18 | ~75% | None | Lifestyle-focused |
| **Google AdSense** | None | $2–$5 | 68% | None | Fallback only |

**Raptive becomes viable** once PreBoard.ai hits 25,000 monthly pageviews (roughly 15–20K sessions depending on pages-per-session). Raptive requires 50% of traffic from US/UK/CA/AU/NZ — PreBoard.ai's US-airport focus virtually guarantees this. Raptive is worth evaluating head-to-head against Mediavine Official at this stage.

---

## Phase 3: 50K+ Monthly Sessions

### Recommended: Mediavine Official or Raptive (A/B test both)

At 50K+ sessions, PreBoard.ai qualifies for both premium networks. The decision between them:

**Mediavine Official**
- Proven track record in travel niche
- Session RPMs of $10–$25 for travel sites (higher for US-heavy traffic)
- Q4 RPMs can spike to $30–$40+ in travel
- Universal Media Player (video ads) adds ~34% RPM uplift
- Publisher-first culture, excellent dashboard and support
- Trellis theme not relevant (Next.js site), but ad tech is framework-agnostic

**Raptive**
- Historically higher RPMs than Mediavine (one comparison study showed Raptive earning more per pageview on a finance site)
- Guarantee to beat your current RPM by 20% if switching
- Slightly more responsive support per publisher reports
- Custom ad strategy at 100K+ pageviews

**Recommendation**: Start with Mediavine (since you'll already be on Journey), monitor RPMs for 3 months, then evaluate whether a Raptive switch makes sense. Both require exclusivity — you can only use one at a time.

---

## Programmatic & Header Bidding Considerations

At the 50K+ session level, consider supplementing your premium network with:

1. **Amazon Publisher Services (APS)**: Transparent Marketplace adds Amazon demand to your ad stack. Mediavine already integrates APS, but if you ever self-manage ads, APS header bidding is high-value for travel sites (Amazon travel products, luggage, electronics).

2. **Direct Deals with Travel Advertisers**: Once PreBoard.ai has 100K+ monthly sessions, approach airline, hotel, and airport parking advertisers directly. PreBoard.ai's unique value proposition — you know which airport the user is about to visit — enables hyper-targeted geo-contextual ads that command CPMs 3–5x standard programmatic rates.

3. **Video Ads**: Mediavine's Universal Media Player or Raptive's equivalent. Publishers report 23–34% RPM increases from enabling video ad units. For PreBoard.ai, a short looping video of airport checkpoint activity or a travel tip clip above the fold on airport detail pages would be a natural host for video ads.

---

## Seasonal RPM Patterns (Critical for Revenue Forecasting)

Travel display ad RPMs follow a predictable seasonal curve:

| Quarter | RPM Multiplier | Reason |
|---------|---------------|--------|
| **Q1 (Jan–Mar)** | 0.7x baseline | Post-holiday budget reset, lowest RPMs |
| **Q2 (Apr–Jun)** | 1.1x baseline | Spring/summer travel planning ramp |
| **Q3 (Jul–Sep)** | 1.0x baseline | Peak travel season, but ad budgets normalize |
| **Q4 (Oct–Dec)** | 1.4–1.6x baseline | Holiday travel + advertiser year-end spending |

For PreBoard.ai specifically, traffic and RPMs should correlate well: peak travel periods (Thanksgiving, Christmas, spring break, summer) drive both higher traffic *and* higher ad rates.

---

## Network Comparison Matrix

| Factor | AdSense | Journey | Mediavine | Raptive | Ezoic |
|--------|---------|---------|-----------|---------|-------|
| Min. Traffic | None | 1K sessions | $5K/yr rev | 25K PV | None |
| Travel RPM | $2–5 | $11–20 | $15–25 | $15–30 | $5–12 |
| Rev Share | 68% | 70% | 75%+ | 75% | Varies |
| CWV Impact | High | Low | Low | Low | Medium |
| Support | Self-serve | Forum | Dedicated | Dedicated | Tiered |
| Exclusivity | No | No | Yes | Yes | No |
| Best For | Pre-launch | 0–25K sessions | 25K+ sessions | 25K+ PV | Testing |

---

## Action Items

1. **Immediately**: Apply to Journey by Mediavine once PreBoard.ai is live and has 1,000+ sessions/month tracked via Grow script.
2. **At $5K/yr revenue**: Auto-upgrade to Mediavine Official. Monitor RPMs.
3. **At 50K sessions**: Evaluate Raptive's 20% RPM guarantee offer. Switch only if the numbers justify it.
4. **At 100K sessions**: Begin outreach for direct travel advertiser deals. Enable video ad units.
5. **Ongoing**: Track RPMs by page type (homepage vs. airport detail vs. guide pages) to identify optimization opportunities.
