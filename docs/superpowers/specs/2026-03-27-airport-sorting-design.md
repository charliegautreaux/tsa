# Airport Sorting, Search & Infinite Scroll — Design Spec

## Goal

Add client-side sorting, search, and infinite scroll to the homepage airport grid so users can quickly find airports by name/code, sort by wait time, proximity, size, or state, and browse all 329 airports without a huge initial render.

## Current State

- **329 airports** in D1, all fetched by `getAirportOverview()` in one query
- Homepage renders all airports in a static grid sorted by worst wait DESC
- No search, no sort controls, no pagination
- `AirportCard` component already exists and is reusable

## Architecture

Fully client-side approach. The server component fetches all airports + sparkline data from D1 (already does this). A new `AirportGrid` client component owns sorting, filtering, search, and virtual scroll.

```
Server (page.tsx)
  └─ fetches airports + sparklines from D1
  └─ passes to <AirportGrid> client component
       ├─ <SearchBar> — text input, debounced 200ms
       ├─ <SortPills> — Wait Time | Nearest | Size | A-Z | State
       └─ IntersectionObserver virtual scroll — 30 cards per batch
```

No new API routes. No new server actions. All sort/filter logic is client-side array operations on the ~50KB dataset already loaded.

## Components

### 1. AirportGrid (`src/components/airport/airport-grid.tsx`)

**Purpose**: Client component that owns search, sort, and scroll state.

**Props**:
- `airports: AirportOverview[]` — full airport list from server
- `sparklineMap: Record<string, number[]>` — serializable sparkline data

**State**:
- `searchQuery: string` — debounced at 200ms
- `activeSort: SortOption` — one of `'wait' | 'nearest' | 'size' | 'az' | 'state'`
- `userLocation: { lat: number; lng: number } | null` — from geolocation API
- `visibleCount: number` — starts at 30, increments by 30 on scroll

**Behavior**:
1. Filter airports by `searchQuery` (matches IATA, name, city, state — case-insensitive)
2. Sort filtered list by `activeSort`
3. Slice to `visibleCount`
4. Render `AirportCard` for each visible airport
5. Render a sentinel div at the bottom observed by `IntersectionObserver`
6. When sentinel enters viewport, increment `visibleCount` by 30
7. Reset `visibleCount` to 30 when sort or search changes
8. Insert `AdSlot` after the 8th card (same as current behavior)

### 2. SortPills (`src/components/airport/sort-pills.tsx`)

**Purpose**: Horizontal row of sort option buttons.

**Props**:
- `active: SortOption`
- `onSort: (sort: SortOption) => void`
- `locationLoading: boolean` — shows spinner on Nearest pill while geolocation resolves

**Pills**: Wait Time | Nearest | Size | A-Z | State

**Styling**: Glass pill buttons, active pill gets purple highlight. Horizontal scroll on mobile if pills overflow.

### 3. Search Input (inline in AirportGrid)

Simple text input with:
- Placeholder: "Search airports..."
- Search icon (lucide `Search`)
- Clear button (X) when query is non-empty
- Debounced onChange at 200ms using a ref-based timeout

### Sort Logic

| Sort | Implementation |
|------|---------------|
| Wait Time | `worst_wait` DESC nulls last |
| Nearest | Haversine distance from `userLocation` ASC; if no location, falls back to Size |
| Size | `annual_pax` DESC |
| A-Z | `iata` localeCompare ASC |
| State | `state` ASC, then `annual_pax` DESC within same state |

**Haversine**: Inline utility function (~10 lines), no library needed. Only used when Nearest is active and location is available.

### Geolocation Flow

1. User taps "Nearest" pill
2. If `userLocation` is null, call `navigator.geolocation.getCurrentPosition`
3. Show loading spinner on the pill while waiting
4. On success: store location, sort by distance
5. On error/denied: show brief inline message "Location unavailable", fall back to Size sort
6. Location is cached in state for the session — no re-prompting

## Layout

**Desktop** (sm+): Single row — search input (flex-1) on left, sort pills on right
**Mobile** (<sm): Search full-width on top, pills on second row with horizontal overflow scroll

```
┌─────────────────────────────────────────────┐
│ [🔍 Search airports...          ] [pills →] │  ← desktop
├─────────────────────────────────────────────┤
│ [🔍 Search airports...                    ] │  ← mobile
│ [Wait Time] [Nearest] [Size] [A-Z] [State] │
└─────────────────────────────────────────────┘
```

## Files Changed/Created

### New Files
```
src/components/airport/airport-grid.tsx    Client grid with search, sort, scroll
src/components/airport/sort-pills.tsx      Sort pill buttons
```

### Modified Files
```
src/app/page.tsx                           Replace static grid with <AirportGrid>
```

## Performance Considerations

- **No library for virtual scroll** — IntersectionObserver + slice is sufficient for 329 items
- **Debounced search** — 200ms prevents excessive re-renders while typing
- **Haversine is O(n)** — trivial for 329 airports
- **Serializable sparkline map** — pass as `Record<string, number[]>` not `Map` (can't serialize Map across server/client boundary)

## Out of Scope

- Server-side sorting or pagination (unnecessary at 329 items)
- Persistent sort preference (localStorage)
- URL search params for sort state
- State filter dropdown (state sort covers this)
- Airport type/size filter checkboxes (YAGNI)

## Success Criteria

1. User can search by IATA code, name, city, or state
2. All 5 sort options work correctly
3. "Nearest" requests geolocation and sorts by distance
4. Infinite scroll loads 30 cards at a time
5. Sort/search changes reset scroll position
6. Mobile layout is usable with horizontal pill scroll
7. Ad slot still appears after the 8th card
8. No layout shift (CLS) when loading more cards
