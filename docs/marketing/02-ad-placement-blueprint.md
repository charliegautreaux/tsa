# 02 — Ad Placement Blueprint by Page Type

**Site**: PreBoard.ai | **Date**: 2026-03-26

---

## Core Principle: Speed-First, Ads-Second

PreBoard.ai's #1 value prop is instant access to wait time data. Every ad placement must honor a rule: **the worst-case checkpoint wait time must be visible within the first viewport paint, before any ad loads**. Violating this turns the site into a slower version of MyTSA — and users will leave.

---

## 1. Homepage — Airport Grid (`/`)

### Desktop (≥1024px)

| Position | Ad Format | Size | Notes |
|----------|-----------|------|-------|
| **Above grid, below H1** | Leaderboard | 728×90 | Loads after first contentful paint. Reserves height via CSS `min-height: 90px` to prevent CLS. |
| **In-feed (after 8th card)** | Native in-feed | 300×250 or fluid | Styled to match `AirportCard` visual pattern. One card-shaped ad per 8 real cards. |
| **In-feed (after 16th card)** | Native in-feed | 300×250 or fluid | Second in-feed unit. Max 2 in-feed ads for ~400 cards. |
| **Sticky footer** | Adhesion banner | 728×90 | Auto-dismissible. Only appears after 3 seconds on page. |

### Mobile (<1024px)

| Position | Ad Format | Size | Notes |
|----------|-----------|------|-------|
| **Below search bar** | Mobile banner | 320×50 | Small, non-intrusive. Loads lazily. |
| **In-feed (after 4th card)** | Native in-feed | 300×250 | Single column layout means this is highly visible. |
| **Sticky bottom** | Adhesion banner | 320×50 | Anchored to bottom. Closeable. Most mobile revenue comes from this unit. |

### What NOT to do on homepage
- No interstitials or full-page takeovers. Users want to scan and tap.
- No video ads on the homepage. Too heavy for a scanning interaction.
- No more than 2 in-feed ad units. Google policy limits ad density.

---

## 2. Airport Detail Page (`/airports/[code]`) — THE MONEY PAGE

This is where PreBoard.ai delivers its core value and where users spend the most engaged time. It's also the highest-RPM page because:
- Users self-identify their destination airport (geo-targeting signal)
- High commercial intent (about to travel = about to spend)
- Longer dwell time scanning checkpoint data and forecasts

### Desktop (≥1024px)

| Position | Ad Format | Size | Priority |
|----------|-----------|------|----------|
| **Right sidebar (sticky)** | Medium rectangle | 300×250 | High — always visible while scrolling checkpoint data |
| **Between airport header and first checkpoint** | Leaderboard | 728×90 | High — prime real estate but MUST NOT push checkpoint data below fold |
| **Between checkpoint rows (after 2nd)** | In-content | 728×90 or fluid | Medium — only if ≥3 checkpoints |
| **Below checkpoint list, above forecast chart** | Large rectangle | 336×280 | Medium — natural content break |
| **Below forecast chart** | Leaderboard | 728×90 | Low — below-fold completionist content |

### Mobile (<1024px)

| Position | Ad Format | Size | Priority |
|----------|-----------|------|----------|
| **Below airport name/badge, above checkpoints** | Mobile banner | 320×100 | High — but ONLY if first checkpoint is still visible in first scroll |
| **Between 1st and 2nd checkpoint** | Medium rectangle | 300×250 | High — users naturally pause between rows |
| **Below all checkpoints** | Medium rectangle | 300×250 | Medium |
| **Sticky bottom** | Adhesion | 320×50 | High — persistent revenue |

### Contextual ad targeting opportunity

The airport code in the URL enables **contextual keyword targeting** that massively boosts CPMs:

- `/airports/ATL` → target "Atlanta airport", "Atlanta travel", "Delta flights ATL"
- `/airports/LAX` → target "Los Angeles travel", "LAX parking", "LAX lounge"

Work with your ad network to pass airport-code metadata as a custom targeting key-value. This can increase CPMs 2–3x vs. generic travel targeting.

### Video ad placement

Place Mediavine's Universal Media Player (or equivalent) in the sidebar on desktop, or between checkpoints 2 and 3 on mobile. Video ads add ~30% to page RPM. Use a contextual travel tip video (e.g., "3 Tips for Faster Security at ATL") as the wrapper content.

---

## 3. Report Page (`/report`) — MINIMAL ADS

The report page is where users *contribute* value to PreBoard.ai. Adding aggressive ads here is counterproductive:

- It increases friction on a contribution flow
- Users filing reports are your most engaged audience — alienating them hurts long-term data quality
- The form is short; time-on-page is low

### Recommendation

| Position | Ad Format | Notes |
|----------|-----------|-------|
| **Single sidebar unit (desktop only)** | 300×250 | Static, not animated. Non-intrusive. |
| **Thank-you page (post-submission)** | 300×250 + affiliate CTA | After submission is the perfect moment for a CLEAR/PreCheck affiliate placement: "Skip the line next time — enroll in TSA PreCheck" |
| **Mobile** | None during form | Only show a sticky bottom ad on the thank-you confirmation screen |

---

## 4. Future Content Pages — Guide & Blog Pages

These pages (see doc 03) will be the long-form, high-dwell-time, high-RPM pages:

### Airport Guide Pages (`/airports/[code]/guide`)

| Position | Ad Format | Size |
|----------|-----------|------|
| Above first H2 | Leaderboard | 728×90 |
| Every 3–4 paragraphs | In-content | 300×250 or fluid |
| Sidebar (sticky, desktop) | Skyscraper | 160×600 or 300×600 |
| End of article | Large rectangle | 336×280 |
| Sticky bottom (mobile) | Adhesion | 320×50 |

These pages can support 4–6 ad units because they have substantial content length (1,500–3,000 words). This is where RPMs will be highest — target $20–$35 session RPM on guide pages.

---

## 5. API Monetization (`/api/v1/*`)

The REST API is an untapped revenue stream for developer/app integrations:

### Tiered API pricing model

| Tier | Rate Limit | Price | Notes |
|------|-----------|-------|-------|
| **Free** | 100 requests/day | $0 | Requires API key (email signup = lead capture) |
| **Developer** | 10K requests/day | $29/month | For hobbyist apps, travel bots |
| **Business** | 100K requests/day | $199/month | For commercial travel apps, airlines |
| **Enterprise** | Unlimited | Custom | Airport display systems, airline operations |

Implementation: Cloudflare Workers can enforce rate limits per API key using KV for token tracking. This is a significant revenue opportunity if PreBoard.ai becomes the de-facto TSA wait time data provider.

---

## 6. Ad Density & Policy Compliance

### Google Ad Manager / AdSense policies (apply to all networks)

- **Maximum ad density**: No more than 1 ad per visible viewport area at any scroll position
- **Ads must not exceed content**: Total ad area on a page should not exceed the content area
- **No deceptive placement**: Ads must be visually distinct from content (Mediavine handles this automatically)
- **Mobile anchor ads**: Maximum 1 sticky/anchor ad at a time
- **No accidental clicks**: Ads must have sufficient padding from interactive elements (the "Report Wait" button, airport card links, etc.)

### CLS (Cumulative Layout Shift) protection

Every ad slot must pre-reserve its space in the DOM via CSS:

```css
/* Ad container — prevents layout shift when ad loads */
.ad-slot-leaderboard {
  min-height: 90px;  /* 728x90 */
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ad-placeholder-bg, transparent);
}

.ad-slot-medium-rectangle {
  min-height: 250px;  /* 300x250 */
  width: 300px;
}
```

### Lazy loading strategy

- **Above-fold ads**: Load immediately (leaderboard, first sidebar unit)
- **Below-fold ads**: IntersectionObserver with `rootMargin: '200px'` — loads when ad slot is 200px from viewport
- **In-feed ads**: Load when the card grid scrolls the ad slot into the near-viewport zone

---

## Desktop vs. Mobile Revenue Split

Expect PreBoard.ai's audience to be **70–80% mobile** (checking wait times on-the-go). However, desktop RPMs are typically 2–3x higher than mobile. Revenue split estimate:

| Device | Traffic Share | RPM | Revenue Share |
|--------|-------------|-----|---------------|
| Mobile | 75% | $8–$15 | ~55% |
| Desktop | 25% | $18–$30 | ~45% |

Optimize for mobile *experience* but don't neglect desktop ad placements — they punch above their weight in revenue.
