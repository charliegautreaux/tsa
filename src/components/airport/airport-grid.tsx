'use client';

import { Fragment, useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { AirportCard } from './airport-card';
import { SortPills, type SortOption } from './sort-pills';
import { AdSlot } from '@/components/ads/ad-slot';
import type { AirportOverview } from '@/lib/types/airport';

const BATCH_SIZE = 30;

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortAirports(
  airports: AirportOverview[],
  sort: SortOption,
  userLocation: { lat: number; lng: number } | null
): AirportOverview[] {
  const sorted = [...airports];

  switch (sort) {
    case 'wait':
      sorted.sort((a, b) => {
        if (a.worst_wait == null && b.worst_wait == null) return 0;
        if (a.worst_wait == null) return 1;
        if (b.worst_wait == null) return -1;
        return b.worst_wait - a.worst_wait;
      });
      break;

    case 'nearest':
      if (userLocation) {
        sorted.sort(
          (a, b) =>
            haversineDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) -
            haversineDistance(userLocation.lat, userLocation.lng, b.lat, b.lng)
        );
      }
      break;

    case 'size':
      sorted.sort((a, b) => {
        return (b.annual_pax ?? 0) - (a.annual_pax ?? 0);
      });
      break;

    case 'az':
      sorted.sort((a, b) => a.iata.localeCompare(b.iata));
      break;

    case 'state':
      sorted.sort((a, b) => {
        const stateCompare = (a.state ?? '').localeCompare(b.state ?? '');
        if (stateCompare !== 0) return stateCompare;
        return (b.annual_pax ?? 0) - (a.annual_pax ?? 0);
      });
      break;
  }

  return sorted;
}

function filterAirports(
  airports: AirportOverview[],
  query: string
): AirportOverview[] {
  if (!query) return airports;
  const q = query.toLowerCase();
  return airports.filter(
    (a) =>
      a.iata.toLowerCase().includes(q) ||
      (a.name ?? '').toLowerCase().includes(q) ||
      (a.city ?? '').toLowerCase().includes(q) ||
      (a.state ?? '').toLowerCase().includes(q)
  );
}

export function AirportGrid({
  airports,
  sparklineMap,
}: {
  airports: AirportOverview[];
  sparklineMap: Record<string, number[]>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [activeSort, setActiveSort] = useState<SortOption>('size');
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setVisibleCount(BATCH_SIZE);
    }, 200);
  }, []);

  // Handle sort change
  const handleSort = useCallback(
    (sort: SortOption) => {
      if (sort === 'nearest' && !userLocation && !locationLoading) {
        setLocationLoading(true);
        setLocationError(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setUserLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
            setLocationLoading(false);
            setActiveSort('nearest');
            setVisibleCount(BATCH_SIZE);
          },
          () => {
            setLocationLoading(false);
            setLocationError('Location unavailable');
            setTimeout(() => setLocationError(null), 3000);
            // Fall back to size sort
            setActiveSort('size');
          }
        );
        return;
      }
      setActiveSort(sort);
      setVisibleCount(BATCH_SIZE);
    },
    [userLocation, locationLoading]
  );

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + BATCH_SIZE);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const filtered = filterAirports(airports, debouncedQuery);
  const sorted = sortAirports(filtered, activeSort, userLocation);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div>
      {/* Search + Sort Controls */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search airports..."
            className="glass w-full rounded-xl py-2.5 pl-9 pr-9 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-purple-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setVisibleCount(BATCH_SIZE);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort Pills */}
        <SortPills
          active={activeSort}
          onSort={handleSort}
          locationLoading={locationLoading}
        />
      </div>

      {/* Location error */}
      {locationError && (
        <p className="mb-4 text-center text-xs text-yellow-500">
          {locationError}
        </p>
      )}

      {/* Results count */}
      {debouncedQuery && (
        <p className="mb-4 text-sm text-gray-500">
          {sorted.length} airport{sorted.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Airport Grid */}
      {visible.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl py-16 text-gray-400">
          <p className="text-lg font-medium">No airports match your search</p>
          <p className="mt-1 text-sm">Try a different search term</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((airport, i) => (
            <Fragment key={airport.iata}>
              <AirportCard
                airport={airport}
                sparklineData={sparklineMap[airport.iata]}
              />
              {i === 7 && (
                <div className="flex items-center justify-center sm:col-span-2 lg:col-span-3">
                  <AdSlot id="home-feed-1" size="leaderboard" />
                </div>
              )}
            </Fragment>
          ))}
        </div>
      )}

      {/* Scroll sentinel */}
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <div className="h-1 w-1 opacity-0" />
        </div>
      )}
    </div>
  );
}
