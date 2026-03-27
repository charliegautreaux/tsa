# 03 — SEO & Content Strategy for Ad Revenue Growth

**Site**: PreBoard.ai | **Date**: 2026-03-26

---

## The Opportunity

PreBoard.ai currently has ~400 airport data pages. These are valuable but thin from an SEO perspective — they display real-time data with minimal static text for Google to index. To maximize organic traffic (and therefore ad revenue), the site needs a content layer that wraps the live data with keyword-rich, high-value pages that rank in Google.

The travel-utility niche has exceptional SEO characteristics: high search volume, clear commercial intent, evergreen + seasonal demand, and relatively low competition for long-tail airport-specific queries.

---

## Content Pillar 1: Airport Guide Pages

### URL Pattern: `/airports/[code]/guide`

Create a templated-but-unique guide page for every airport. Target keywords like:

- "TSA wait times at [Airport Name]"
- "[IATA] airport security wait times"
- "how long is security at [Airport Name]"
- "best time to go through security at [IATA]"
- "[Airport Name] TSA PreCheck lane"

### Template Structure (1,500–2,500 words per page)

1. **H1**: "TSA Wait Times at [Airport Name] ([IATA]): Everything You Need to Know"
2. **Live data embed**: Pull current wait time widget from the data page (internal link to `/airports/[code]`)
3. **Peak hours analysis**: "When Are TSA Lines Longest at [IATA]?" — use historical data from the prediction engine to generate peak-hour charts (AM rush, midday, evening)
4. **Terminal-by-terminal breakdown**: Which checkpoints are fastest, which have PreCheck/CLEAR lanes
5. **Tips for faster screening at this airport**: Airport-specific advice (e.g., "ATL's North checkpoint is consistently faster than South during morning rush")
6. **TSA PreCheck & CLEAR availability**: Which lanes support PreCheck, where to find CLEAR kiosks at this airport, enrollment centers nearby
7. **Getting to the airport**: Brief section on transit, parking, rideshare drop-off — natural affiliate placement opportunities
8. **FAQ schema markup**: Structured data for featured snippets ("How long is security at LAX?" → direct answer)

### Production plan

- **Top 30 airports first** (ATL, LAX, ORD, DFW, DEN, JFK, SFO, SEA, LAS, MCO, CLT, PHX, MIA, IAH, BOS, MSP, FLL, DTW, PHL, LGA, BWI, SLC, DCA, IAD, SAN, TPA, PDX, HNL, STL, AUS) — these cover ~70% of US passenger volume
- **Remaining 370 airports**: Generate with templated structure, enhance with any airport-specific data available
- **Cadence**: 5 guide pages/week for the first 6 weeks (top 30), then batch-generate the long tail

### Estimated traffic per guide page

- Top 30 airports: 500–5,000 organic sessions/month each (ATL, LAX, ORD will be highest)
- Mid-tier airports: 50–500 sessions/month each
- Small airports: 10–50 sessions/month each
- **Total estimated guide page traffic at maturity (6+ months)**: 30,000–80,000 sessions/month

---

## Content Pillar 2: Editorial Blog Content

### URL Pattern: `/blog/[slug]`

High-value editorial content targeting competitive but lucrative keywords:

### Priority Articles (publish first 10 within 60 days of launch)

| Article | Target Keyword | Est. Monthly Volume | Commercial Value |
|---------|---------------|--------------------|--------------------|
| TSA PreCheck vs CLEAR: Which Is Worth It? | "tsa precheck vs clear" | 12,000 | Very High (affiliate) |
| Best Time to Go Through Airport Security | "best time airport security" | 8,000 | High |
| 10 Airports with the Worst TSA Wait Times | "worst airports tsa wait" | 5,000 | High (list = linkable) |
| How to Get TSA PreCheck: Complete Guide | "how to get tsa precheck" | 40,000 | Very High (affiliate) |
| What to Expect at TSA Security in 2026 | "tsa security rules 2026" | 15,000 | Medium |
| CLEAR Plus Review: Is It Worth $209/Year? | "clear plus review" | 6,000 | Very High (affiliate) |
| Airport Security Tips for First-Time Flyers | "airport security tips" | 10,000 | Medium |
| TSA PreCheck for Families: What Parents Need to Know | "tsa precheck kids family" | 4,000 | High (affiliate) |
| Real ID and TSA: What You Need to Know | "real id tsa requirements" | 20,000 | Medium |
| The Fastest TSA Lines in America (Live Rankings) | "fastest tsa lines" | 3,000 | High (data-driven, unique) |

### Ongoing content cadence

- **2 blog posts/week** for the first 3 months
- **1 blog post/week** after month 3 (shift focus to updating existing content)
- **Seasonal content**: Pre-Thanksgiving, Pre-Christmas, Spring Break, Summer Travel guides (publish 4–6 weeks before each travel peak)

---

## Content Pillar 3: Programmatic SEO Pages

### City-Pair Pages

**URL Pattern**: `/routes/[origin]-to-[destination]`

Example: `/routes/lax-to-jfk` → "Flying LAX to JFK? Here's How Early to Arrive Based on Current TSA Wait Times"

These pages combine:
- Current wait time at the origin airport
- Historical average wait by time of day
- A recommendation: "Based on current conditions, arrive X hours before your flight"
- Affiliate links for PreCheck/CLEAR enrollment

**Scale**: Top 500 domestic routes = 500 pages, each targeting "[origin] to [destination] how early to arrive" queries.

### Holiday-Specific Pages

**URL Pattern**: `/travel/[holiday]-[year]`

Examples:
- `/travel/thanksgiving-2026` → "Thanksgiving 2026 TSA Wait Times: When to Fly and What to Expect"
- `/travel/christmas-2026` → "Christmas 2026 Airport Security: Live Wait Times and Predictions"
- `/travel/spring-break-2026` → "Spring Break 2026: Airport Security Wait Time Forecast"

These are high-volume seasonal queries with huge traffic spikes. Publish 4–6 weeks before each holiday. Update annually.

### Terminal-Specific Pages

**URL Pattern**: `/airports/[code]/terminal/[terminal]`

For major airports with multiple terminals (ATL, LAX, ORD, JFK, DFW):
- Per-terminal checkpoint details
- Which airlines operate from which terminal
- Terminal-specific tips

---

## Internal Linking Strategy

```
Homepage (/)
  └── Airport Card → /airports/[code]         (live data)
        └── Link to → /airports/[code]/guide   (SEO guide)
        └── Link to → /airports/[code]/terminal/[t] (terminal page)

Blog posts link to:
  ├── Relevant airport guide pages (contextual internal links)
  ├── The live data page (/airports/[code])
  └── Other related blog posts

Guide pages link to:
  ├── Live data page (above-fold widget)
  ├── Report page (/report) — "Traveling through [IATA] now? Report your wait time"
  └── Affiliate CTAs (PreCheck, CLEAR, parking)
```

Every page on the site should be within 3 clicks of every other page. The airport guide pages serve as hub pages connecting live data, editorial content, and affiliate placements.

---

## Technical SEO for Next.js on Cloudflare

1. **Server-side rendering**: Airport guide pages must be SSR (not client-side rendered) for Google indexing. Use `generateStaticParams` for the top 30 airports and ISR (`revalidate: 3600`) for the rest.

2. **Structured data (JSON-LD)**: Add FAQ schema to guide pages, LocalBusiness schema for airport data, and Article schema for blog posts.

3. **Sitemap**: Generate a dynamic sitemap at `/sitemap.xml` including all airport pages, guide pages, blog posts, and route pages. Submit to Google Search Console.

4. **Meta tags**: Every page needs unique `<title>` and `<meta name="description">`. Template: `"TSA Wait Times at [Airport Name] ([IATA]) — PreBoard.ai"`

5. **Canonical URLs**: Ensure no duplicate content between `/airports/atl` and `/airports/ATL` (normalize to uppercase).

6. **Page speed**: Guide pages with ads must maintain LCP < 2.5s, CLS < 0.1, INP < 200ms. Lazy-load ads and images below the fold.

---

## Content ROI Projection

| Content Type | Pages | Est. Traffic/mo (mature) | RPM | Monthly Revenue |
|-------------|-------|-------------------------|-----|----------------|
| Airport guide pages | 400 | 50,000 sessions | $18 | $900 |
| Blog posts (20 articles) | 20 | 30,000 sessions | $22 | $660 |
| Holiday pages | 6 | 15,000 sessions (seasonal avg) | $20 | $300 |
| City-pair pages | 500 | 20,000 sessions | $12 | $240 |
| **Total content layer** | **926** | **115,000 sessions** | **~$18 blended** | **~$2,100/mo** |

This content layer alone could generate $25K+/year in display ad revenue at maturity — on top of the revenue from the live data pages.
