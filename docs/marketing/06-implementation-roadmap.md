# 06 — Technical Implementation Roadmap

**Site**: PreBoard.ai | **Date**: 2026-03-26

---

## Architecture Context

PreBoard.ai runs on:
- **Frontend**: Next.js 15 (App Router), React 19, Tailwind 4
- **Runtime**: Cloudflare Workers (edge runtime)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV
- **Deployment**: OpenNext.js → Cloudflare Pages/Workers

All ad integrations must be compatible with this stack. Key constraints: no traditional Node.js server-side rendering, edge-first execution, client-side ad loading only.

---

## Phase 1: Foundation (Week 1–2)

### 1.1 Apply to Journey by Mediavine

**When**: As soon as PreBoard.ai hits 1,000 sessions/month (tracked via Grow).

**Integration steps for Next.js App Router**:

```tsx
// src/app/layout.tsx — Add Mediavine script wrapper
// Mediavine provides a single script tag after approval

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Mediavine ad script — loads asynchronously */}
        <script
          data-noptimize="1"
          data-cfasync="false"
          src="//scripts.mediavine.com/tags/preboard.js"
          async
        />
      </head>
      <body>...</body>
    </html>
  );
}
```

**CLS prevention**: Add placeholder containers for each ad slot:

```tsx
// src/components/ads/ad-slot.tsx
export function AdSlot({ 
  id, 
  size 
}: { 
  id: string; 
  size: 'leaderboard' | 'medium-rectangle' | 'mobile-banner' 
}) {
  const dimensions = {
    'leaderboard': { minHeight: '90px', width: '728px' },
    'medium-rectangle': { minHeight: '250px', width: '300px' },
    'mobile-banner': { minHeight: '50px', width: '320px' },
  };
  
  return (
    <div 
      id={id}
      className="mx-auto flex items-center justify-center"
      style={dimensions[size]}
      data-ad-slot={id}
    />
  );
}
```

### 1.2 Set Up Google Analytics 4

**Required for**: Network applications (all networks verify traffic via GA4).

```tsx
// src/app/layout.tsx — Add GA4
<Script
  src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"
  strategy="afterInteractive"
/>
<Script id="gtag-init" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-XXXXXXXXXX');
  `}
</Script>
```

### 1.3 Privacy & Consent Framework

**CCPA (California)**: Required for US sites with ads.
**GDPR**: Required if any EU visitors (likely, given international travelers).

**Implementation**: Mediavine provides a built-in Consent Management Platform (CMP) compatible with TCF 2.0 and Google's Consent Mode v2. When you join Journey, their CMP auto-integrates with the ad script.

For the interim (pre-Mediavine), add a minimal consent banner:

```tsx
// src/components/consent/cookie-banner.tsx
// Simple CCPA/GDPR banner — replace with Mediavine CMP after approval
'use client';
import { useState, useEffect } from 'react';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  
  useEffect(() => {
    if (!localStorage.getItem('consent')) setVisible(true);
  }, []);
  
  if (!visible) return null;
  
  return (
    <div className="fixed bottom-0 inset-x-0 bg-gray-900 text-white p-4 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <p className="text-sm">
          We use cookies to serve ads and improve your experience.
        </p>
        <div className="flex gap-2">
          <button onClick={() => { localStorage.setItem('consent', 'rejected'); setVisible(false); }}
            className="text-sm text-gray-400 hover:text-white">Decline</button>
          <button onClick={() => { localStorage.setItem('consent', 'accepted'); setVisible(false); }}
            className="bg-blue-600 px-4 py-1.5 rounded text-sm font-medium">Accept</button>
        </div>
      </div>
    </div>
  );
}
```

---

## Phase 2: Ad Placement & Optimization (Month 1–3)

### 2.1 Implement Ad Slots by Page Type

Follow the placement blueprint (doc 02). Create a reusable `<AdSlot>` component and place it in:

- `src/app/page.tsx` — homepage (in-feed ads between airport cards)
- `src/app/airports/[code]/page.tsx` — airport detail (sidebar, between checkpoints)
- `src/app/airports/[code]/guide/page.tsx` — guide pages (in-content every 3–4 paragraphs)
- `src/app/blog/[slug]/page.tsx` — blog posts (in-content)

### 2.2 Lazy Loading with IntersectionObserver

```tsx
// src/components/ads/lazy-ad.tsx
'use client';
import { useRef, useEffect, useState } from 'react';

export function LazyAd({ id, size }: { id: string; size: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="ad-container" style={{ minHeight: size === 'leaderboard' ? 90 : 250 }}>
      {visible && <div data-ad-unit={id} />}
    </div>
  );
}
```

*Note: Mediavine manages its own lazy loading. This component is for custom ad implementations or A/B testing. With Mediavine, their script handles lazy loading automatically based on the ad container `data-` attributes.*

### 2.3 Core Web Vitals Monitoring

Set up Web Vitals tracking to ensure ads don't degrade performance:

```tsx
// src/app/layout.tsx — Web Vitals reporting
import { useReportWebVitals } from 'next/web-vitals';

// In a client component wrapper:
useReportWebVitals((metric) => {
  // Send to GA4 or custom analytics
  gtag('event', metric.name, {
    value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    event_label: metric.id,
    non_interaction: true,
  });
});
```

**Target thresholds** (do not let ads push below these):
- LCP: < 2.5 seconds
- CLS: < 0.10
- INP: < 200ms

---

## Phase 3: Affiliate Integration (Month 2–4)

### 3.1 CJ Affiliate & Bankrate Setup

1. Apply to CJ Affiliate (cj.com) — largest network for travel credit card offers
2. Apply to specific advertiser programs: Chase, Amex, Capital One
3. Apply to Bankrate's affiliate program (high-converting landing pages)

### 3.2 Affiliate Link Components

```tsx
// src/components/affiliate/precheck-cta.tsx
export function PreCheckCTA({ airportCode }: { airportCode?: string }) {
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
        Skip the line with TSA PreCheck
      </p>
      <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
        PreCheck members wait under 5 minutes on average. Many travel cards 
        reimburse the enrollment fee.
      </p>
      <a 
        href="/blog/best-travel-cards-tsa-precheck" 
        className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
      >
        See cards that cover PreCheck →
      </a>
      <p className="mt-2 text-[10px] text-gray-400">
        Affiliate disclosure: We may earn a commission from card applications.
      </p>
    </div>
  );
}
```

### 3.3 Disclosure Requirements

FTC requires clear affiliate disclosure. Add to:
- Every page with affiliate links (near the top)
- A site-wide `/disclosure` page linked from the footer
- Inline near each affiliate CTA

---

## Phase 4: Content Publishing Pipeline (Month 1–6)

### 4.1 Blog & Guide Page Architecture

```
src/app/
  airports/[code]/
    page.tsx          ← existing live data page
    guide/
      page.tsx        ← NEW: SEO guide page (SSG with ISR)
  blog/
    page.tsx          ← blog index
    [slug]/
      page.tsx        ← individual blog post
  routes/
    [pair]/
      page.tsx        ← NEW: city-pair programmatic pages
```

### 4.2 Content Management

For the initial phase, store blog content as markdown files in the repo (`src/content/blog/`) and use Next.js `generateStaticParams` to build at deploy time. This keeps the stack simple (no CMS) and content deploys via git push.

For guide pages, generate programmatically from the airport database in D1 + a markdown template.

### 4.3 Structured Data (JSON-LD)

Add to every page for rich snippets:

```tsx
// src/components/seo/json-ld.tsx
export function ArticleJsonLd({ title, description, datePublished, url }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
      description,
      datePublished,
      url,
      publisher: { "@type": "Organization", name: "PreBoard.ai" }
    })}} />
  );
}
```

---

## Phase 5: A/B Testing & Optimization (Month 3+)

### 5.1 Ad Placement Testing

Use Cloudflare Workers to serve different ad layouts to different users:

- **Test A**: Leaderboard above checkpoints vs. below airport header
- **Test B**: Sidebar ad vs. in-content ad on airport detail page
- **Test C**: Affiliate CTA prominence (subtle vs. prominent)

Track via GA4 custom events: `ad_placement_variant`, `affiliate_click`, `affiliate_conversion`.

### 5.2 RPM Tracking by Page Type

Create a custom GA4 report that segments RPM by page template:
- `/airports/[code]` pages
- `/airports/[code]/guide` pages
- `/blog/*` pages
- Homepage

This data drives decisions about where to invest in content.

---

## Phase 6: Advanced Monetization (Month 6+)

### 6.1 API Rate Limiting & Pricing

Implement tiered API access using Cloudflare Workers + KV:

```ts
// API key validation middleware
const apiKey = request.headers.get('X-API-Key');
const usage = await env.CACHE.get(`api:${apiKey}:count`);
const tier = await env.CACHE.get(`api:${apiKey}:tier`);

const limits = { free: 100, developer: 10000, business: 100000 };
if (parseInt(usage || '0') >= limits[tier || 'free']) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 6.2 Ad Blocker Detection

~42% of desktop users use ad blockers. Track the rate (don't gate content):

```tsx
// Detect ad blocker — track the rate for revenue forecasting
useEffect(() => {
  const testAd = document.createElement('div');
  testAd.innerHTML = '&nbsp;';
  testAd.className = 'adsbox';
  document.body.appendChild(testAd);
  setTimeout(() => {
    if (testAd.offsetHeight === 0) {
      gtag('event', 'ad_blocker_detected');
    }
    document.body.removeChild(testAd);
  }, 100);
}, []);
```

---

## Implementation Timeline Summary

| Week | Action |
|------|--------|
| **1** | Set up GA4. Apply to Journey by Mediavine. Add consent banner. |
| **2** | Create AdSlot components. Integrate Mediavine script. Reserve ad space in layout to prevent CLS. |
| **3–4** | Publish first 5 airport guide pages (ATL, LAX, ORD, DFW, JFK). Apply to CJ Affiliate. |
| **5–8** | Publish 2 blog posts/week. Add affiliate CTAs to airport pages. Build 25 more guide pages. |
| **Month 3** | Review RPM data by page type. Begin A/B testing placements. Enable video ads if available. |
| **Month 4** | Launch city-pair programmatic pages (top 100 routes). Add parking affiliates to guide pages. |
| **Month 6** | Evaluate Mediavine Official upgrade (should have $5K/yr by now in moderate scenario). Launch API pricing tiers. |
| **Month 9** | Review network options (Mediavine Official vs. Raptive). Direct advertiser outreach if at 100K+ sessions. |
| **Month 12** | Full optimization review. Plan Year 2 content calendar. Consider video content strategy. |
