# PreBoard Brand Guidelines

**Brand**: PreBoard (domain: preboard.ai)
**Slogan**: "Did you PreBoard?"
**Date**: 2026-03-26

---

## Brand Name

The brand is **PreBoard** — one word, capital P, capital B.

- Full domain: PreBoard.ai
- In running text: PreBoard
- In the logo: "PreBoard" prominently, ".ai" de-emphasized
- Spoken: "pre-board" (two syllables)
- Never: "Pre Board", "Preboard", "PREBOARD", "Pre-Board"

The ".ai" suffix appears in the logo but is visually subordinate — lighter weight, smaller size, muted color. In spoken language and marketing copy, just say "PreBoard."

---

## Logo

### Structure

The logo has two parts:

1. **Signal Icon** (logomark) — Four concentric quarter-circle arcs in the wait-time severity colors (green, yellow, orange, red), emanating from the bottom-left. Represents live data monitoring and maps directly to the in-app severity system.

2. **Wordmark** — "PreBoard" in a geometric sans-serif (SemiBold), followed by ".ai" in lighter weight and muted color.

### Logo Variants

| Variant | Use Case |
|---------|----------|
| Icon + Wordmark (dark bg) | Primary — app header, marketing on dark |
| Icon + Wordmark (light bg) | Email, print, light backgrounds |
| Icon only | Favicon, app icon, social avatar |
| Wordmark only | Text-heavy contexts, footer |

### Minimum Size

- Icon: 16px minimum (favicon)
- Full logo: 120px wide minimum

### Clear Space

Maintain padding equal to the height of the green (inner) arc around all sides of the logo.

---

## Icon — "Signal Arcs"

The icon is the core brand mark. Four quarter-circle arcs colored with the severity palette:

| Arc | Color | Hex | Severity |
|-----|-------|-----|----------|
| Inner | Green | #22C55E | Low wait (0–15 min) |
| 2nd | Yellow | #EAB308 | Moderate (15–30 min) |
| 3rd | Orange | #F97316 | High (30–60 min) |
| Outer | Red | #EF4444 | Severe (60+ min) |

### Icon Specifications

- **Arcs**: Quarter-circle, bottom-left origin, clockwise sweep
- **Stroke**: Round linecaps, consistent width
- **Background (app icon)**: #0F0D1A (deep dark), no rounded corners in source (OS applies mask)
- **Background (favicon)**: Transparent

### Source Files

| File | Purpose |
|------|---------|
| `src/app/icon.svg` | SVG favicon (transparent bg) |
| `public/app-icon.svg` | App icon master (dark bg, for PNG generation) |
| `src/components/shared/signal-icon.tsx` | React component |

---

## Color Palette

### Primary Brand Colors

| Name | Hex | Usage |
|------|-----|-------|
| Vivid Purple | #7C3AED | Primary brand, theme-color, accents |
| Deep Purple | #6D28D9 | Gradients, hover states |
| Electric Blue | #3B82F6 | Secondary accents, links |
| Near White | #F8FAFC | Text on dark backgrounds |
| Deep Dark | #0F0D1A | App icon background |
| App Background | #0C0C14 | Main app background |

### Severity Colors (Data Visualization)

| Name | Hex | CSS Variable |
|------|-----|-------------|
| Green | #22C55E | --color-wait-low |
| Yellow | #EAB308 | --color-wait-moderate |
| Orange | #F97316 | --color-wait-high |
| Red | #EF4444 | --color-wait-severe |

**Rule**: Severity colors belong to data, not brand. They appear in the icon (because the icon IS the data) but never in the wordmark, buttons, or general brand elements.

---

## Typography

### Recommended Fonts

| Element | Font | Weight | Notes |
|---------|------|--------|-------|
| Wordmark | Plus Jakarta Sans | SemiBold (600) | Geometric, warm, modern. Google Fonts. |
| ".ai" suffix | Plus Jakarta Sans | Regular (400) | De-emphasized |
| Marketing headlines | Plus Jakarta Sans | Bold (700) | Matches wordmark |
| App UI / body | Inter or system sans | Regular/Medium | Already in use via Tailwind |
| Data / numbers | Tabular figures | SemiBold | Monospace alignment for wait times |

### Wordmark Treatment

- "PreBoard" — SemiBold, white (#F8FAFC) on dark, dark purple (#6D28D9) on light
- ".ai" — Regular weight, 80-85% size, muted (gray-400 on dark, gray-500 on light)
- Letter-spacing: tracking-tight (-0.025em)

---

## Voice & Messaging

### Slogan

> **Did you PreBoard?**

Use in: footer, marketing, social media, email subject lines, app store description.

### Positioning Statement

PreBoard gives you real-time TSA security wait times for every US airport so you never get stuck in line again.

### Tone

- **Confident but not cocky** — we have the data, presented clearly
- **Helpful, not preachy** — utility first, not fear-mongering about long lines
- **Modern and direct** — short sentences, no jargon, no government-speak
- **Never**: "blazingly fast", "100% accurate", marketing superlatives

### Key Messages

1. Real-time wait times for every US airport
2. Know before you go — predictions for the next 4 hours
3. Multi-source data fusion — not just crowdsourced guesses
4. Free, fast, no app download required

---

## Implementation

### Favicon / Icon Setup (Next.js App Router)

The SVG favicon at `src/app/icon.svg` is automatically served by Next.js.

For PNG icons (Apple touch, Android manifest), run:

```bash
npm install sharp --save-dev
node scripts/generate-icons.mjs
```

This generates all sizes into `public/` from the master SVG.

### manifest.json

Located at `public/manifest.json`. References the SVG icon. After generating PNGs, add:

```json
{
  "icons": [
    { "src": "/app-icon.svg", "sizes": "any", "type": "image/svg+xml" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

### Using the Signal Icon Component

```tsx
import { SignalIcon } from "@/components/shared/signal-icon";

<SignalIcon size={28} />           // Nav (default)
<SignalIcon size={48} />           // Marketing hero
<SignalIcon size={16} />           // Inline text
```

---

## Do's and Don'ts

### Do

- Use the Signal Arcs icon as the primary brand mark
- Keep ".ai" visually subordinate to "PreBoard"
- Use the severity colors only for wait-time data and the icon
- Maintain clear space around the logo
- Test icon visibility on both light and dark backgrounds

### Don't

- Don't put the icon on a bright/colored background (use dark or transparent only)
- Don't recolor the arcs — green/yellow/orange/red is the brand identity
- Don't use severity colors for buttons, links, or non-data UI elements
- Don't stretch, rotate, or skew the logo
- Don't add effects (drop shadows, 3D, glow) to the logo
- Don't write "PreBoard.ai" with emphasis on ".ai" — the brand is "PreBoard"

---

## Professional Refinement

This brand identity is a working prototype. For professional refinement:

1. **Hire a designer** ($200-400 on Fiverr/Dribbble) to polish the Signal Arcs icon and wordmark
2. **Generate the full icon set** with the PNG generation script
3. **Add OG image** — social sharing card with logo + slogan + sample wait data
4. **Consider Plus Jakarta Sans** — add via `next/font/google` for the wordmark if desired

### Comparable Brands to Reference

- **Flighty** — dark mode, purple/blue, premium travel utility
- **Linear** — gold standard dark-mode SaaS branding
- **Waze** — iconic simple mark, crowdsourced data app
- **Dark Sky** — color-coded severity as brand identity
