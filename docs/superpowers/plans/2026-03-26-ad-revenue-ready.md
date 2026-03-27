# Ad Revenue Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make PreBoard ready for ad revenue — GA4 analytics, cookie consent, SEO fundamentals, ad slot infrastructure, blog system, airport guide pages, affiliate CTAs, and legal pages.

**Architecture:** All ad/analytics scripts load client-side only (Cloudflare Workers has no traditional SSR). Content pages (blog, guides) use markdown files in the repo parsed at build time via `gray-matter`. Ad slots pre-reserve height to prevent CLS. Affiliate CTAs are contextual server components that render based on wait-time data. SEO uses Next.js App Router metadata API + dynamic sitemap from D1.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind 4, Cloudflare D1/KV/Workers, gray-matter, @tailwindcss/typography, vitest

---

## File Structure

### New Files

```
src/
  app/
    blog/
      page.tsx                        Blog index
      [slug]/
        page.tsx                      Blog post page
    airports/[code]/guide/
      page.tsx                        Airport guide page (SSR from D1)
    privacy/
      page.tsx                        Privacy policy
    disclosure/
      page.tsx                        Affiliate disclosure
    sitemap.ts                        Dynamic XML sitemap
    robots.ts                         Robots.txt
  components/
    analytics/
      ga-provider.tsx                 GA4 script loader (client)
      web-vitals.tsx                  Core Web Vitals reporter (client)
    consent/
      cookie-banner.tsx               CCPA/GDPR consent banner (client)
    ads/
      ad-slot.tsx                     CLS-safe ad placeholder (server)
    affiliate/
      precheck-cta.tsx                PreCheck upsell (server)
      disclosure.tsx                  Inline FTC disclosure (server)
    blog/
      post-card.tsx                   Blog index card (server)
    seo/
      json-ld.tsx                     Structured data components (server)
    guide/
      peak-hours-chart.tsx            Avg wait by hour (client)
      guide-section.tsx               Reusable guide content section (server)
  content/
    blog/
      tsa-precheck-vs-clear.md        First blog post
      how-to-get-tsa-precheck.md      Second blog post
      worst-airports-tsa-wait.md      Third blog post
    guides/
      _template.md                    Guide page template
  lib/
    content/
      blog.ts                         Markdown parser + frontmatter
    utils/
      consent.ts                      Consent state helpers
tests/
  lib/
    content/
      blog.test.ts                    Blog parser tests
  components/
    consent/
      cookie-banner.test.ts           Consent banner tests
```

### Modified Files

```
src/app/layout.tsx                    Add GA provider, consent banner, manifest
src/app/page.tsx                      Add ad slots between airport cards
src/app/airports/[code]/page.tsx      Add ad slots, guide link, PreCheck CTA
src/app/globals.css                   Add ad-slot CLS classes
src/components/layout/footer.tsx      Add Blog, Privacy, Disclosure links
src/components/layout/top-nav.tsx     Add Blog nav link
package.json                          Add gray-matter, @tailwindcss/typography
```

---

### Task 1: Google Analytics 4 Provider

**Files:**
- Create: `src/components/analytics/ga-provider.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create the GA provider component**

```tsx
// src/components/analytics/ga-provider.tsx
'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

export function GAProvider() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
          });
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
```

- [ ] **Step 2: Add GA provider to layout**

In `src/app/layout.tsx`, add the import and render `<GAProvider />` inside `<body>` before `<ThemeProvider>`:

```tsx
import { GAProvider } from "@/components/analytics/ga-provider";

// Inside the return, first child of <body>:
<GAProvider />
<ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
```

- [ ] **Step 3: Add GA measurement ID to wrangler vars**

In `wrangler.jsonc`, add to the `vars` object:

```jsonc
"NEXT_PUBLIC_GA_MEASUREMENT_ID": ""
```

Leave empty — the actual ID gets set after creating the GA4 property. The component renders nothing when the ID is empty.

- [ ] **Step 4: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/analytics/ga-provider.tsx src/app/layout.tsx wrangler.jsonc
git commit -m "feat: add GA4 analytics provider with consent mode v2 defaults"
```

---

### Task 2: Cookie Consent Banner

**Files:**
- Create: `src/lib/utils/consent.ts`
- Create: `src/components/consent/cookie-banner.tsx`
- Test: `tests/components/consent/cookie-banner.test.ts`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create consent utility**

```ts
// src/lib/utils/consent.ts
export type ConsentStatus = 'accepted' | 'rejected' | null;

export function getConsent(): ConsentStatus {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('cookie_consent') as ConsentStatus;
}

export function setConsent(status: 'accepted' | 'rejected'): void {
  localStorage.setItem('cookie_consent', status);

  if (typeof window !== 'undefined' && 'gtag' in window) {
    const granted = status === 'accepted';
    (window as any).gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: granted ? 'granted' : 'denied',
    });
  }
}

export function hasConsented(): boolean {
  return getConsent() !== null;
}
```

- [ ] **Step 2: Create the cookie banner component**

```tsx
// src/components/consent/cookie-banner.tsx
'use client';

import { useState, useEffect } from 'react';
import { setConsent, hasConsented } from '@/lib/utils/consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!hasConsented()) setVisible(true);
  }, []);

  if (!visible) return null;

  function handle(status: 'accepted' | 'rejected') {
    setConsent(status);
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="glass mx-auto flex max-w-2xl items-center justify-between gap-4 rounded-2xl px-5 py-3.5">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          We use cookies for analytics and ads.{' '}
          <a href="/privacy" className="underline hover:text-gray-900 dark:hover:text-white">
            Privacy Policy
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => handle('rejected')}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-white"
          >
            Decline
          </button>
          <button
            onClick={() => handle('accepted')}
            className="rounded-lg bg-purple-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write test for consent utility**

```ts
// tests/components/consent/cookie-banner.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getConsent, setConsent, hasConsented } from '@/lib/utils/consent';

describe('consent utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no consent stored', () => {
    expect(getConsent()).toBeNull();
  });

  it('returns false for hasConsented when no consent stored', () => {
    expect(hasConsented()).toBe(false);
  });

  it('stores and retrieves accepted consent', () => {
    setConsent('accepted');
    expect(getConsent()).toBe('accepted');
    expect(hasConsented()).toBe(true);
  });

  it('stores and retrieves rejected consent', () => {
    setConsent('rejected');
    expect(getConsent()).toBe('rejected');
    expect(hasConsented()).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/components/consent/cookie-banner.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: Add consent banner to layout**

In `src/app/layout.tsx`, add import and render after `<Footer />`:

```tsx
import { CookieBanner } from "@/components/consent/cookie-banner";

// After </Footer>, before closing </div> of mesh-bg:
<CookieBanner />
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/utils/consent.ts src/components/consent/cookie-banner.tsx tests/components/consent/cookie-banner.test.ts src/app/layout.tsx
git commit -m "feat: add cookie consent banner with GA4 consent mode integration"
```

---

### Task 3: SEO Fundamentals — Sitemap, Robots, Meta

**Files:**
- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/airports/[code]/page.tsx`

- [ ] **Step 1: Create dynamic sitemap**

```ts
// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAllAirports } from '@/lib/db/d1';

const BASE_URL = 'https://preboard.cgautreauxnc.workers.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { env } = await getCloudflareContext();
  const airports = await getAllAirports(env.DB);

  const airportEntries: MetadataRoute.Sitemap = airports.map((a) => ({
    url: `${BASE_URL}/airports/${a.iata}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 1,
    },
    ...airportEntries,
  ];
}
```

- [ ] **Step 2: Create robots.txt**

```ts
// src/app/robots.ts
import type { MetadataRoute } from 'next';

const BASE_URL = 'https://preboard.cgautreauxnc.workers.dev';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

- [ ] **Step 3: Enhance homepage metadata**

In `src/app/page.tsx`, add above `export const dynamic`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PreBoard — Live TSA Wait Times for Every US Airport',
  description:
    'Real-time TSA security checkpoint wait times for 400+ US airports. See current lines, predictions, and trends. Did you PreBoard?',
  openGraph: {
    title: 'PreBoard — Live TSA Wait Times',
    description: 'Real-time TSA security wait times for every US airport.',
  },
};
```

- [ ] **Step 4: Enhance airport detail metadata**

In `src/app/airports/[code]/page.tsx`, update `generateMetadata`:

```tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const { env } = await getCloudflareContext();
  const airport = await getAirport(env.DB, upper);
  const name = airport?.name ?? upper;

  return {
    title: `TSA Wait Times at ${name} (${upper}) — PreBoard`,
    description: `Live TSA security line wait times at ${name}. Check current checkpoint status, predictions, and tips for ${upper}.`,
    openGraph: {
      title: `${upper} TSA Wait Times — PreBoard`,
      description: `Real-time security wait times at ${name}.`,
    },
  };
}
```

- [ ] **Step 5: Add metadataBase to root layout**

In `src/app/layout.tsx`, add `metadataBase` to the existing `metadata` export:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://preboard.cgautreauxnc.workers.dev'),
  // ... existing fields
};
```

- [ ] **Step 6: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/app/sitemap.ts src/app/robots.ts src/app/page.tsx src/app/airports/[code]/page.tsx src/app/layout.tsx
git commit -m "feat: add sitemap, robots.txt, and enhanced SEO metadata"
```

---

### Task 4: Ad Slot Infrastructure

**Files:**
- Create: `src/components/ads/ad-slot.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/page.tsx`
- Modify: `src/app/airports/[code]/page.tsx`

- [ ] **Step 1: Create the AdSlot component**

```tsx
// src/components/ads/ad-slot.tsx
type AdSize = 'leaderboard' | 'rectangle' | 'mobile-banner' | 'adhesion';

const SIZE_CLASSES: Record<AdSize, string> = {
  leaderboard: 'ad-slot-leaderboard',
  rectangle: 'ad-slot-rectangle',
  'mobile-banner': 'ad-slot-mobile-banner',
  adhesion: 'ad-slot-adhesion',
};

export function AdSlot({
  id,
  size,
  className = '',
}: {
  id: string;
  size: AdSize;
  className?: string;
}) {
  return (
    <div
      id={id}
      data-ad-slot={id}
      className={`mx-auto flex items-center justify-center ${SIZE_CLASSES[size]} ${className}`}
    >
      {/* Ad network script fills this container */}
    </div>
  );
}
```

- [ ] **Step 2: Add CLS-prevention CSS**

Append to `src/app/globals.css`:

```css
/* ========================================
   AD SLOT CLS PREVENTION
   ======================================== */
.ad-slot-leaderboard {
  min-height: 90px;
  max-width: 728px;
  width: 100%;
}
.ad-slot-rectangle {
  min-height: 250px;
  max-width: 300px;
  width: 100%;
}
.ad-slot-mobile-banner {
  min-height: 50px;
  max-width: 320px;
  width: 100%;
}
.ad-slot-adhesion {
  min-height: 50px;
  width: 100%;
}
```

- [ ] **Step 3: Add homepage in-feed ad slot**

In `src/app/page.tsx`, import `AdSlot` and insert after the 8th airport card. Replace the airport grid mapping:

```tsx
import { AdSlot } from '@/components/ads/ad-slot';

// Replace the airports.map block:
<div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {airports.map((airport, i) => (
    <Fragment key={airport.iata}>
      <AirportCard
        airport={airport}
        sparklineData={sparklineMap.get(airport.iata)}
      />
      {i === 7 && (
        <div className="flex items-center justify-center sm:col-span-2 lg:col-span-3">
          <AdSlot id="home-feed-1" size="leaderboard" />
        </div>
      )}
    </Fragment>
  ))}
</div>
```

Add `Fragment` to the react import at the top of the file:

```tsx
import { Fragment } from 'react';
```

- [ ] **Step 4: Add airport detail ad slot**

In `src/app/airports/[code]/page.tsx`, import `AdSlot` and add a slot between the trend chart and checkpoints:

```tsx
import { AdSlot } from '@/components/ads/ad-slot';

// After the airport-wide trend chart closing </div> and before the Checkpoints section:
<div className="my-6 flex justify-center">
  <AdSlot id={`${code}-detail-1`} size="leaderboard" />
</div>
```

- [ ] **Step 5: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/ads/ad-slot.tsx src/app/globals.css src/app/page.tsx src/app/airports/[code]/page.tsx
git commit -m "feat: add ad slot infrastructure with CLS prevention"
```

---

### Task 5: Web Vitals Monitoring

**Files:**
- Create: `src/components/analytics/web-vitals.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create Web Vitals reporter**

```tsx
// src/components/analytics/web-vitals.tsx
'use client';

import { useReportWebVitals } from 'next/web-vitals';

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (typeof window === 'undefined' || !('gtag' in window)) return;

    (window as any).gtag('event', metric.name, {
      value: Math.round(
        metric.name === 'CLS' ? metric.value * 1000 : metric.value
      ),
      event_label: metric.id,
      non_interaction: true,
    });
  });

  return null;
}
```

- [ ] **Step 2: Add to layout**

In `src/app/layout.tsx`, import and render inside `<ThemeProvider>` (order doesn't matter, it renders null):

```tsx
import { WebVitals } from "@/components/analytics/web-vitals";

// Inside ThemeProvider, before or after mesh-bg div:
<WebVitals />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/analytics/web-vitals.tsx src/app/layout.tsx
git commit -m "feat: add Core Web Vitals reporting to GA4"
```

---

### Task 6: Structured Data (JSON-LD)

**Files:**
- Create: `src/components/seo/json-ld.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/airports/[code]/page.tsx`

- [ ] **Step 1: Create JSON-LD components**

```tsx
// src/components/seo/json-ld.tsx

export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'PreBoard',
    url: 'https://preboard.cgautreauxnc.workers.dev',
    logo: 'https://preboard.cgautreauxnc.workers.dev/app-icon.svg',
    description:
      'Real-time TSA security wait times for every US airport.',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function WebPageJsonLd({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    publisher: { '@type': 'Organization', name: 'PreBoard' },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function FAQJsonLd({
  questions,
}: {
  questions: { question: string; answer: string }[];
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function ArticleJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
}) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified ?? datePublished,
    publisher: { '@type': 'Organization', name: 'PreBoard' },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

- [ ] **Step 2: Add Organization JSON-LD to root layout**

In `src/app/layout.tsx`, import and render inside `<head>` (via the body, Next.js hoists script tags):

```tsx
import { OrganizationJsonLd } from "@/components/seo/json-ld";

// Inside <body>, before <GAProvider />:
<OrganizationJsonLd />
```

- [ ] **Step 3: Add WebPage JSON-LD to airport detail**

In `src/app/airports/[code]/page.tsx`, at the top of the returned JSX (inside `<main>`):

```tsx
import { WebPageJsonLd } from '@/components/seo/json-ld';

// First child inside <main>:
<WebPageJsonLd
  title={`TSA Wait Times at ${airport.name} (${code})`}
  description={`Live TSA security wait times at ${airport.name}.`}
  url={`https://preboard.cgautreauxnc.workers.dev/airports/${code}`}
/>
```

- [ ] **Step 4: Commit**

```bash
git add src/components/seo/json-ld.tsx src/app/layout.tsx src/app/airports/[code]/page.tsx
git commit -m "feat: add structured data (JSON-LD) for organization, pages, articles, FAQ"
```

---

### Task 7: Blog Infrastructure

**Files:**
- Create: `src/lib/content/blog.ts`
- Create: `src/lib/types/content.ts`
- Create: `src/components/blog/post-card.tsx`
- Create: `src/app/blog/page.tsx`
- Create: `src/app/blog/[slug]/page.tsx`
- Test: `tests/lib/content/blog.test.ts`
- Modify: `package.json`
- Modify: `src/components/layout/top-nav.tsx`
- Modify: `src/components/layout/footer.tsx`

- [ ] **Step 1: Install dependencies**

```bash
npm install gray-matter
npm install -D @tailwindcss/typography
```

- [ ] **Step 2: Create content types**

```ts
// src/lib/types/content.ts
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
}
```

- [ ] **Step 3: Create blog parser**

```ts
// src/lib/content/blog.ts
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogPost } from '@/lib/types/content';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? '',
      date: data.date ?? '',
      tags: data.tags ?? [],
      content,
    } satisfies BlogPost;
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ?? '',
    tags: data.tags ?? [],
    content,
  };
}
```

- [ ] **Step 4: Create a test blog post**

```markdown
<!-- src/content/blog/tsa-precheck-vs-clear.md -->
---
title: "TSA PreCheck vs CLEAR: Which Is Worth It in 2026?"
description: "A detailed comparison of TSA PreCheck and CLEAR Plus — costs, benefits, wait times, and which one saves you the most time at the airport."
date: "2026-03-26"
tags: ["precheck", "clear", "comparison"]
---

## TSA PreCheck vs CLEAR: The Quick Answer

If you fly more than twice a year, **TSA PreCheck** ($78 for 5 years) is the single best investment you can make for airport security. If you fly weekly and hate any line at all, **CLEAR Plus** ($189/year) paired with PreCheck gets you through security in under 2 minutes at 50+ airports.

## What Is TSA PreCheck?

TSA PreCheck is a trusted traveler program run by the Transportation Security Administration. Members get access to dedicated screening lanes where you:

- Keep your shoes on
- Keep your laptop in your bag
- Keep your belt and light jacket on
- Skip the full-body scanner (walk through metal detector instead)

**Cost**: $78 for 5 years ($15.60/year). Many travel credit cards reimburse this fee.

**Average wait**: Under 5 minutes at most airports, based on PreBoard data.

## What Is CLEAR Plus?

CLEAR Plus uses biometric verification (fingerprints or iris scan) to verify your identity, letting you skip the ID check line entirely. You go straight to the screening area.

**Cost**: $189/year (pricing varies; often discounted to $149 with promotions). Free for Amex Platinum cardholders.

**Average wait**: Under 1 minute for the ID verification step. You still go through standard screening unless you also have PreCheck.

## PreCheck vs CLEAR: Head-to-Head

| Feature | TSA PreCheck | CLEAR Plus |
|---------|-------------|-----------|
| Cost | $78 / 5 years | $189 / year |
| Annual cost | ~$16 | $189 |
| What it skips | Full screening (shoes, laptop, etc.) | ID verification line |
| Dedicated lane | Yes | Yes (at 50+ airports) |
| Average time saved | 20-40 minutes | 5-15 minutes |
| Airport coverage | 200+ airports | 50+ airports |
| Best for | Everyone who flies | Frequent flyers at major hubs |

## The Verdict

**Get PreCheck first.** It's cheaper, available at more airports, and saves more time. If you fly frequently through major hubs and want to eliminate every possible minute of waiting, add CLEAR Plus on top.

## Cards That Cover Both

Several travel credit cards reimburse TSA PreCheck and even CLEAR:

- **Chase Sapphire Reserve**: $300 travel credit covers PreCheck
- **Amex Platinum**: Includes free CLEAR Plus membership + PreCheck credit
- **Capital One Venture X**: $100 travel credit covers PreCheck

*Affiliate disclosure: We may earn a commission if you apply for a card through our links.*
```

- [ ] **Step 5: Write blog parser test**

```ts
// tests/lib/content/blog.test.ts
import { describe, it, expect } from 'vitest';
import { getAllPosts, getPostBySlug } from '@/lib/content/blog';

describe('blog content parser', () => {
  it('returns all posts sorted by date descending', () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0].slug).toBe('tsa-precheck-vs-clear');
    expect(posts[0].title).toContain('TSA PreCheck vs CLEAR');
    expect(posts[0].tags).toContain('precheck');
  });

  it('returns a post by slug', () => {
    const post = getPostBySlug('tsa-precheck-vs-clear');
    expect(post).not.toBeNull();
    expect(post!.title).toContain('TSA PreCheck vs CLEAR');
    expect(post!.content).toContain('## TSA PreCheck vs CLEAR');
  });

  it('returns null for missing slug', () => {
    const post = getPostBySlug('does-not-exist');
    expect(post).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/lib/content/blog.test.ts`
Expected: 3 tests pass

- [ ] **Step 7: Create post card component**

```tsx
// src/components/blog/post-card.tsx
import Link from 'next/link';
import type { BlogPost } from '@/lib/types/content';

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="block">
      <article className="glass rounded-2xl p-6 transition-all">
        <time className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          {post.title}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {post.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </article>
    </Link>
  );
}
```

- [ ] **Step 8: Create blog index page**

```tsx
// src/app/blog/page.tsx
import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/content/blog';
import { PostCard } from '@/components/blog/post-card';

export const metadata: Metadata = {
  title: 'Blog — PreBoard',
  description:
    'Airport security tips, TSA PreCheck guides, and travel advice from PreBoard.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="gradient-text text-4xl font-bold tracking-tight">Blog</h1>
      <p className="mt-3 text-gray-500 dark:text-gray-400">
        Airport security tips, guides, and travel advice.
      </p>

      <div className="mt-8 space-y-4">
        {posts.length === 0 ? (
          <p className="text-gray-400">No posts yet. Check back soon.</p>
        ) : (
          posts.map((post) => <PostCard key={post.slug} post={post} />)
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 9: Create blog post page**

```tsx
// src/app/blog/[slug]/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getAllPosts, getPostBySlug } from '@/lib/content/blog';
import { ArticleJsonLd } from '@/components/seo/json-ld';
import { AdSlot } from '@/components/ads/ad-slot';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — PreBoard`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  // Simple markdown → HTML: split on double newlines, wrap paragraphs,
  // handle headings, tables, lists. For v1, render as pre-formatted text
  // with Tailwind Typography prose classes.
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ArticleJsonLd
        title={post.title}
        description={post.description}
        url={`https://preboard.cgautreauxnc.workers.dev/blog/${slug}`}
        datePublished={post.date}
      />

      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All posts
      </Link>

      <article>
        <time className="text-sm text-gray-400 dark:text-gray-500">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h1 className="gradient-text mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="my-8 flex justify-center">
          <AdSlot id={`blog-${slug}-top`} size="leaderboard" />
        </div>

        <div
          className="prose prose-gray max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-purple-600 dark:prose-a:text-purple-400"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
        />
      </article>
    </main>
  );
}

/** Minimal markdown → HTML. Handles headings, paragraphs, bold, italic, links, tables, lists. */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g,
      (_match, header: string, body: string) => {
        const ths = header.split('|').filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join('');
        const rows = body.trim().split('\n').map((row: string) => {
          const tds = row.split('|').filter(Boolean).map((d: string) => `<td>${d.trim()}</td>`).join('');
          return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    )
    .replace(/^(?!<[hultod])((?!<).+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/\n{2,}/g, '\n');
}
```

- [ ] **Step 10: Add Blog link to nav**

In `src/components/layout/top-nav.tsx`, add a Blog link after `<AirportSearch />`:

```tsx
<Link
  href="/blog"
  className="hidden text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white sm:block"
>
  Blog
</Link>
```

- [ ] **Step 11: Add footer links**

In `src/components/layout/footer.tsx`, add navigation links after the slogan:

```tsx
<div className="mt-3 flex gap-4 text-xs">
  <a href="/blog" className="hover:text-gray-300">Blog</a>
  <a href="/privacy" className="hover:text-gray-300">Privacy</a>
  <a href="/disclosure" className="hover:text-gray-300">Disclosure</a>
</div>
```

- [ ] **Step 12: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 13: Commit**

```bash
git add src/lib/types/content.ts src/lib/content/blog.ts src/content/blog/tsa-precheck-vs-clear.md src/components/blog/post-card.tsx src/app/blog/page.tsx src/app/blog/[slug]/page.tsx tests/lib/content/blog.test.ts src/components/layout/top-nav.tsx src/components/layout/footer.tsx package.json package-lock.json
git commit -m "feat: add blog infrastructure with markdown posts, blog index, and first article"
```

---

### Task 8: Airport Guide Pages

**Files:**
- Create: `src/app/airports/[code]/guide/page.tsx`
- Create: `src/components/guide/guide-section.tsx`
- Create: `src/components/guide/peak-hours-chart.tsx`
- Modify: `src/app/airports/[code]/page.tsx`
- Modify: `src/lib/db/d1.ts` (add `getHourlyAverages` query)

- [ ] **Step 1: Add hourly averages query to d1.ts**

Append to `src/lib/db/d1.ts`:

```ts
export interface HourlyAverage {
  hour: number;
  avg_wait: number;
  sample_count: number;
}

export async function getHourlyAverages(
  db: D1Database,
  airportCode: string
): Promise<HourlyAverage[]> {
  const result = await db
    .prepare(`
      SELECT
        CAST(strftime('%H', hour_start) AS INTEGER) as hour,
        ROUND(AVG(avg_wait), 1) as avg_wait,
        SUM(sample_count) as sample_count
      FROM readings_rollup
      WHERE airport_code = ?1
      GROUP BY hour
      ORDER BY hour
    `)
    .bind(airportCode.toUpperCase())
    .all<HourlyAverage>();
  return result.results;
}
```

- [ ] **Step 2: Create guide section component**

```tsx
// src/components/guide/guide-section.tsx
export function GuideSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create peak hours chart**

```tsx
// src/components/guide/peak-hours-chart.tsx
'use client';

import type { HourlyAverage } from '@/lib/db/d1';
import { getWaitSeverity } from '@/lib/utils/colors';

const SEVERITY_BG: Record<string, string> = {
  low: 'bg-green-500',
  moderate: 'bg-yellow-500',
  high: 'bg-orange-500',
  severe: 'bg-red-500',
};

export function PeakHoursChart({ data }: { data: HourlyAverage[] }) {
  if (data.length === 0) return null;

  const maxWait = Math.max(...data.map((d) => d.avg_wait), 1);

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="mb-4 text-sm font-medium text-gray-400 dark:text-gray-500">
        Average Wait by Hour of Day
      </h3>
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {Array.from({ length: 24 }, (_, hour) => {
          const entry = data.find((d) => d.hour === hour);
          const wait = entry?.avg_wait ?? 0;
          const pct = maxWait > 0 ? (wait / maxWait) * 100 : 0;
          const severity = getWaitSeverity(wait);

          return (
            <div key={hour} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={`w-full rounded-t ${SEVERITY_BG[severity]} opacity-80 transition-all`}
                style={{ height: `${Math.max(pct, 2)}%` }}
                title={`${hour}:00 — ${wait}m avg`}
              />
              {hour % 3 === 0 && (
                <span className="text-[9px] text-gray-500">
                  {hour === 0 ? '12a' : hour < 12 ? `${hour}a` : hour === 12 ? '12p' : `${hour - 12}p`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the guide page**

```tsx
// src/app/airports/[code]/guide/page.tsx
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import {
  getAirport,
  getCheckpoints,
  getHourlyAverages,
} from '@/lib/db/d1';
import { FAQJsonLd, WebPageJsonLd } from '@/components/seo/json-ld';
import { GuideSection } from '@/components/guide/guide-section';
import { PeakHoursChart } from '@/components/guide/peak-hours-chart';
import { AdSlot } from '@/components/ads/ad-slot';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const upper = code.toUpperCase();
  const { env } = await getCloudflareContext();
  const airport = await getAirport(env.DB, upper);
  if (!airport) return {};

  return {
    title: `TSA Wait Times at ${airport.name} (${upper}): Complete Guide — PreBoard`,
    description: `Everything you need to know about TSA security at ${airport.name}. Peak hours, checkpoint tips, PreCheck lanes, and live wait times.`,
  };
}

export default async function AirportGuidePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = rawCode.toUpperCase();
  const { env } = await getCloudflareContext();

  const airport = await getAirport(env.DB, code);
  if (!airport) notFound();

  const [checkpoints, hourlyAvg] = await Promise.all([
    getCheckpoints(env.DB, code),
    getHourlyAverages(env.DB, code),
  ]);

  const faqQuestions = [
    {
      question: `How long is TSA security at ${airport.name}?`,
      answer: `TSA wait times at ${code} vary by time of day. Check PreBoard for live wait times updated every minute.`,
    },
    {
      question: `Does ${code} have TSA PreCheck?`,
      answer: checkpoints.some((cp) => cp.has_precheck)
        ? `Yes, ${code} has TSA PreCheck lanes available.`
        : `Check the ${code} airport page on PreBoard for the latest checkpoint information.`,
    },
    {
      question: `What is the best time to go through security at ${code}?`,
      answer: `Early morning (before 6 AM) and mid-afternoon (1-3 PM) typically have the shortest lines at ${code}.`,
    },
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <WebPageJsonLd
        title={`TSA Wait Times at ${airport.name}`}
        description={`Complete guide to TSA security at ${airport.name}.`}
        url={`https://preboard.cgautreauxnc.workers.dev/airports/${code}/guide`}
      />
      <FAQJsonLd questions={faqQuestions} />

      <Link
        href={`/airports/${code}`}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        {code} Live Data
      </Link>

      <h1 className="gradient-text text-3xl font-bold tracking-tight sm:text-4xl">
        TSA Wait Times at {airport.name} ({code})
      </h1>
      <p className="mt-2 text-gray-500 dark:text-gray-400">
        Everything you need to know about security at {airport.name} in{' '}
        {airport.city}, {airport.state}.
      </p>

      <div className="my-6 flex justify-center">
        <AdSlot id={`guide-${code}-top`} size="leaderboard" />
      </div>

      <GuideSection title={`When Are TSA Lines Longest at ${code}?`}>
        <PeakHoursChart data={hourlyAvg} />
        <p className="mt-4">
          Based on historical data, the busiest times at {airport.name} are
          typically early morning (5-8 AM) and late afternoon (4-6 PM). For the
          shortest wait, aim for mid-morning or early afternoon.
        </p>
      </GuideSection>

      {checkpoints.length > 0 && (
        <GuideSection title="Checkpoints">
          <ul className="list-inside list-disc space-y-1">
            {checkpoints.map((cp) => (
              <li key={cp.id}>
                <strong>{cp.name}</strong>
                {cp.terminal ? ` (Terminal ${cp.terminal})` : ''}
                {cp.has_precheck ? ' — PreCheck available' : ''}
              </li>
            ))}
          </ul>
        </GuideSection>
      )}

      <div className="my-6 flex justify-center">
        <AdSlot id={`guide-${code}-mid`} size="rectangle" />
      </div>

      <GuideSection title="TSA PreCheck & CLEAR">
        <p>
          PreCheck members typically wait under 5 minutes at {code}. Many travel
          credit cards reimburse the $78 enrollment fee.{' '}
          <Link
            href="/blog/tsa-precheck-vs-clear"
            className="text-purple-600 underline dark:text-purple-400"
          >
            Compare PreCheck vs CLEAR →
          </Link>
        </p>
      </GuideSection>

      <GuideSection title="Tips for Faster Security">
        <ul className="list-inside list-disc space-y-1">
          <li>Check PreBoard before heading to the airport for live wait times</li>
          <li>Arrive at least 2 hours before domestic flights, 3 hours for international</li>
          <li>Have your ID and boarding pass ready before joining the line</li>
          <li>Wear easy-to-remove shoes and avoid excessive metal jewelry</li>
        </ul>
      </GuideSection>

      <GuideSection title="Frequently Asked Questions">
        <div className="space-y-4">
          {faqQuestions.map((q) => (
            <div key={q.question}>
              <h3 className="font-medium">{q.question}</h3>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                {q.answer}
              </p>
            </div>
          ))}
        </div>
      </GuideSection>
    </main>
  );
}
```

- [ ] **Step 5: Add guide link to airport detail page**

In `src/app/airports/[code]/page.tsx`, add a link below the airport header (after the city/state/sources line):

```tsx
<Link
  href={`/airports/${code}/guide`}
  className="mt-2 inline-block text-sm text-purple-600 hover:underline dark:text-purple-400"
>
  Read our complete {code} security guide →
</Link>
```

- [ ] **Step 6: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/d1.ts src/components/guide/guide-section.tsx src/components/guide/peak-hours-chart.tsx src/app/airports/[code]/guide/page.tsx src/app/airports/[code]/page.tsx
git commit -m "feat: add airport guide pages with peak hours chart, FAQ schema, and ad slots"
```

---

### Task 9: Affiliate CTA Components

**Files:**
- Create: `src/components/affiliate/precheck-cta.tsx`
- Create: `src/components/affiliate/disclosure.tsx`
- Modify: `src/app/airports/[code]/page.tsx`

- [ ] **Step 1: Create inline disclosure component**

```tsx
// src/components/affiliate/disclosure.tsx
export function AffiliateDisclosure() {
  return (
    <p className="text-[10px] text-gray-400 dark:text-gray-500">
      Affiliate disclosure: We may earn a commission from applications made through our links.{' '}
      <a href="/disclosure" className="underline">
        Learn more
      </a>
    </p>
  );
}
```

- [ ] **Step 2: Create PreCheck CTA**

```tsx
// src/components/affiliate/precheck-cta.tsx
import { Shield } from 'lucide-react';
import { AffiliateDisclosure } from './disclosure';

export function PreCheckCTA({ waitMinutes }: { waitMinutes?: number }) {
  const showUrgent = waitMinutes != null && waitMinutes > 15;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600/10">
          <Shield className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {showUrgent
              ? `Skip the ${waitMinutes}-minute wait with TSA PreCheck`
              : 'Skip the line with TSA PreCheck'}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PreCheck members wait under 5 minutes on average. Many travel cards
            reimburse the $78 enrollment fee.
          </p>
          <a
            href="/blog/tsa-precheck-vs-clear"
            className="mt-2 inline-block text-sm font-medium text-purple-600 hover:underline dark:text-purple-400"
          >
            See cards that cover PreCheck →
          </a>
          <div className="mt-2">
            <AffiliateDisclosure />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add PreCheck CTA to airport detail page**

In `src/app/airports/[code]/page.tsx`, import `PreCheckCTA` and add after the checkpoint list:

```tsx
import { PreCheckCTA } from '@/components/affiliate/precheck-cta';

// After the checkpoints section (after the closing </div> of stagger space-y-4):
{/* Affiliate CTA */}
<div className="mt-8">
  <PreCheckCTA
    waitMinutes={
      currentWaits.length > 0
        ? Math.max(...currentWaits.filter(w => w.lane_type === 'standard').map(w => w.wait_minutes))
        : undefined
    }
  />
</div>
```

- [ ] **Step 4: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/affiliate/disclosure.tsx src/components/affiliate/precheck-cta.tsx src/app/airports/[code]/page.tsx
git commit -m "feat: add contextual PreCheck affiliate CTA on airport detail pages"
```

---

### Task 10: Legal Pages — Privacy & Disclosure

**Files:**
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/disclosure/page.tsx`

- [ ] **Step 1: Create privacy policy page**

```tsx
// src/app/privacy/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — PreBoard',
  description: 'How PreBoard handles your data and privacy.',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 26, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Information We Collect
          </h2>
          <p className="mt-2">
            PreBoard collects anonymous usage data through Google Analytics 4,
            including pages visited, device type, and approximate location
            (country/region). We do not collect personally identifiable
            information unless you voluntarily submit a wait time report.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cookies & Tracking
          </h2>
          <p className="mt-2">
            We use cookies for analytics and advertising. Our ad partners may
            use cookies to serve relevant ads. You can manage your cookie
            preferences using the consent banner that appears when you first
            visit the site.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Advertising
          </h2>
          <p className="mt-2">
            PreBoard displays advertisements through third-party ad networks.
            These partners may use cookies and similar technologies to serve ads
            based on your interests. We do not sell your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Rights
          </h2>
          <p className="mt-2">
            Under CCPA and GDPR, you have the right to access, delete, and opt
            out of the sale of your personal information. To exercise these
            rights, contact us at privacy@preboard.ai.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Data Retention
          </h2>
          <p className="mt-2">
            Analytics data is retained according to Google Analytics default
            settings (14 months). Wait time reports submitted through the site
            are stored indefinitely to improve data quality.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Contact
          </h2>
          <p className="mt-2">
            For privacy questions, contact privacy@preboard.ai.
          </p>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create affiliate disclosure page**

```tsx
// src/app/disclosure/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure — PreBoard',
  description: 'How PreBoard earns revenue through affiliate partnerships.',
};

export default function DisclosurePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        Affiliate Disclosure
      </h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: March 26, 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        <p>
          PreBoard is a free service. To keep it free, we participate in
          affiliate programs that allow us to earn commissions when you click
          links on our site and make a purchase or complete an application.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            What This Means for You
          </h2>
          <p className="mt-2">
            When we recommend products like travel credit cards, TSA PreCheck
            enrollment, CLEAR memberships, or airport parking, some of these
            links may be affiliate links. If you click and complete an
            application or purchase, we may receive a commission at no additional
            cost to you.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Our Commitment
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>We only recommend products we believe provide genuine value</li>
            <li>Affiliate relationships never influence our wait time data</li>
            <li>We clearly label affiliate content throughout the site</li>
            <li>Our primary mission is accurate, real-time TSA wait time data</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Partners
          </h2>
          <p className="mt-2">
            We may earn commissions through partnerships with credit card
            issuers, travel service providers, airport parking companies, and
            other travel-related businesses.
          </p>
        </section>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/privacy/page.tsx src/app/disclosure/page.tsx
git commit -m "feat: add privacy policy and affiliate disclosure pages"
```

---

### Task 11: Update Sitemap with New Pages

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Add blog, guide, and legal pages to sitemap**

Update `src/app/sitemap.ts` to include all new page types:

```ts
import type { MetadataRoute } from 'next';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { getAllAirports } from '@/lib/db/d1';
import { getAllPosts } from '@/lib/content/blog';

const BASE_URL = 'https://preboard.cgautreauxnc.workers.dev';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { env } = await getCloudflareContext();
  const airports = await getAllAirports(env.DB);
  const posts = getAllPosts();

  const airportEntries: MetadataRoute.Sitemap = airports.flatMap((a) => [
    {
      url: `${BASE_URL}/airports/${a.iata}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/airports/${a.iata}/guide`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
  ]);

  const blogEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${BASE_URL}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'always' as const,
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/disclosure`,
      lastModified: new Date('2026-03-26'),
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    },
    ...airportEntries,
    ...blogEntries,
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat: expand sitemap with blog, guide, privacy, and disclosure pages"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] GA4 analytics (doc 06 §1.2) → Task 1
- [x] Cookie consent / CCPA / GDPR (doc 06 §1.3) → Task 2
- [x] SEO: sitemap, robots, meta tags (doc 03) → Task 3
- [x] Ad slot infrastructure with CLS prevention (doc 02, 06 §2.1) → Task 4
- [x] Web Vitals monitoring (doc 06 §2.3) → Task 5
- [x] Structured data / JSON-LD (doc 03, 06 §4.3) → Task 6
- [x] Blog infrastructure + first article (doc 03 §Pillar 2, doc 06 §4.1) → Task 7
- [x] Airport guide pages (doc 03 §Pillar 1) → Task 8
- [x] Affiliate CTA components (doc 04) → Task 9
- [x] Privacy + Disclosure pages (doc 04 §3.3, doc 06 §3.3) → Task 10
- [x] Updated sitemap with all new pages → Task 11

**Not in this plan (Phase 4 / later):**
- Mediavine script activation (requires approval after traffic)
- City-pair programmatic pages (month 4+)
- Holiday/seasonal pages (month 4+)
- API rate limiting and pricing (month 4+)
- A/B testing (month 3+)
- Video ads (requires Mediavine)
- Ad blocker detection (month 6+)
- Additional blog posts (ongoing content cadence)

**Placeholder scan:** No TBD, TODO, or "implement later" found.

**Type consistency:** `BlogPost`, `HourlyAverage`, consent utilities, JSON-LD component props — all consistent across tasks.
