"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import type { Listing, Amenity, AmenityType, ListingFilters } from "@/lib/types";
import Link from "next/link";
import FilterBar, { DEFAULT_FILTERS } from "@/components/Filters/FilterBar";
import PropertyPanel from "@/components/Sidebar/PropertyPanel";
import AmenitiesToggle from "@/components/Map/AmenitiesToggle";
import CivicLayers from "@/components/Map/CivicLayers";
import OfficeSearch, { type OfficeLocation } from "@/components/Map/OfficeSearch";
import LoadingSpinner from "@/components/UI/LoadingSpinner";
import { useShortlist } from "@/lib/shortlist";
import { formatPrice, haversineMeters, CITIES, type CitySlug } from "@/lib/utils";
import { Heart, Share2 } from "lucide-react";
import { useMemo } from "react";

const MapView = dynamic(() => import("@/components/Map/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <LoadingSpinner size={32} />
    </div>
  ),
});

const ALL_AMENITY_TYPES: AmenityType[] = [
  "metro", "hospital", "school", "supermarket",
  "restaurant", "park", "pharmacy", "bank", "gym",
];

const DEFAULT_VISIBLE: AmenityType[] = ["metro", "hospital", "school"];

export default function HomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filters, setFilters] = useState<ListingFilters>(DEFAULT_FILTERS);
  const [visibleAmenityTypes, setVisibleAmenityTypes] = useState<AmenityType[]>(DEFAULT_VISIBLE);
  const [loadingListings, setLoadingListings] = useState(true);
  const [loadingAmenities, setLoadingAmenities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation | null>(null);
  const [officeRadius, setOfficeRadius] = useState(2000);
  const [showMetro, setShowMetro] = useState(false);
  const { count: shortlistCount } = useShortlist();

  // Client-side filter by distance from office (when set)
  const displayedListings = useMemo(() => {
    if (!officeLocation) return listings;
    return listings.filter(
      (l) => haversineMeters(l.lat, l.lng, officeLocation.lat, officeLocation.lng) <= officeRadius
    );
  }, [listings, officeLocation, officeRadius]);

  // ── Deep-link: ?listing=<id> opens panel on load ──────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("listing");
    if (!id) return;
    // Wait for listings to load, then select matching one
    const unsub = setInterval(() => {
      setListings((current) => {
        const match = current.find((l) => l.id === id);
        if (match) {
          clearInterval(unsub);
          handleSelectListing(match);
        }
        return current;
      });
    }, 300);
    setTimeout(() => clearInterval(unsub), 10000); // give up after 10s
    return () => clearInterval(unsub);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track in-flight amenity request so we can abort on new selection
  const amenityAbortRef = useRef<AbortController | null>(null);
  // Stable ref to selected listing id — used inside async callbacks
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedListing?.id ?? null;

  // ── Clear office + selection + stale listings when city changes ─
  const prevCityRef = useRef(filters.city);
  useEffect(() => {
    if (prevCityRef.current !== filters.city) {
      prevCityRef.current = filters.city;
      setListings([]);       // wipe old city markers immediately
      setOfficeLocation(null);
      handleClose();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.city]);

  // ── Fetch listings ──────────────────────────────────────────────
  useEffect(() => {
    const controller = new AbortController();
    setLoadingListings(true);
    setError(null);

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v != null && v !== "" && v !== "all") params.set(k, String(v));
      if (k === "sort_by") params.set(k, String(v));
    });

    fetch(`/api/listings?${params.toString()}`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load listings: ${r.status}`);
        return r.json();
      })
      .then((data: Listing[]) => {
        setListings(data);
        // Smart close: only clear panel if selected listing gone from new results
        setSelectedListing((prev) => {
          if (!prev) return null;
          const stillExists = data.some((l) => l.id === prev.id);
          if (!stillExists) {
            setAmenities([]);
            return null;
          }
          return prev;
        });
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoadingListings(false));

    return () => controller.abort();
  }, [filters]);

  // ── Fetch amenities (all 9 types, abort previous) ───────────────
  const fetchAmenities = useCallback(async (listing: Listing) => {
    // Cancel any in-flight request
    amenityAbortRef.current?.abort();
    const controller = new AbortController();
    amenityAbortRef.current = controller;

    setLoadingAmenities(true);
    try {
      const params = new URLSearchParams({
        lat: String(listing.lat),
        lng: String(listing.lng),
        types: ALL_AMENITY_TYPES.join(","),
        radius: "1500",
      });
      const res = await fetch(`/api/amenities?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("amenities failed");

      // Guard: discard if a different listing was selected while fetching
      if (selectedIdRef.current !== listing.id) return;

      const data: Amenity[] = await res.json();
      setAmenities(data);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e as any).name !== "AbortError") setAmenities([]);
    } finally {
      if (!controller.signal.aborted) setLoadingAmenities(false);
    }
  }, []);

  function handleSelectListing(listing: Listing) {
    setSelectedListing(listing);
    setAmenities([]);       // clear stale data immediately
    fetchAmenities(listing);
  }

  function handleClose() {
    amenityAbortRef.current?.abort();
    setSelectedListing(null);
    setAmenities([]);
    setLoadingAmenities(false);
  }

  // Build a readable filter summary for the bottom pill
  function filterSummary(): string {
    const parts: string[] = [];
    if (filters.bhk !== "all") parts.push(`${filters.bhk}BHK`);
    if (filters.max_price) parts.push(`≤${formatPrice(filters.max_price, "per_month")}`);
    if (filters.furnishing !== "all") parts.push(filters.furnishing);
    if (filters.locality) parts.push(filters.locality);
    return parts.join(" · ");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-xl">🗺️</span>
          <div>
            <span className="font-bold text-gray-900 text-base">Maps for Flats</span>
            <span className="hidden sm:inline text-xs text-gray-400 ml-1.5">· Find your next home on a map</span>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {loadingAmenities && (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <LoadingSpinner size={12} />
              <span className="hidden sm:inline">Fetching nearby…</span>
            </span>
          )}
          {/* Shortlist link */}
          <Link
            href="/saved"
            className="relative flex items-center gap-1.5 text-xs text-gray-600 hover:text-red-500 transition-colors"
            title="Shortlisted flats"
          >
            <Heart size={16} className={shortlistCount > 0 ? "text-red-500" : ""} fill={shortlistCount > 0 ? "currentColor" : "none"} />
            <span className="hidden sm:inline font-medium">Saved</span>
            {shortlistCount > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
                {shortlistCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} totalCount={listings.length} />

      {/* Map layer toggles */}
      <div className="bg-white border-b border-gray-100 px-3 py-2 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <CivicLayers
            showMetro={showMetro}
            onToggleMetro={() => setShowMetro((v) => !v)}
          />
          {selectedListing && (
            <>
              <div className="w-px h-4 bg-gray-200 shrink-0" />
              <span className="text-xs text-gray-400 font-medium shrink-0">Nearby:</span>
              <AmenitiesToggle active={visibleAmenityTypes} onChange={setVisibleAmenityTypes} />
            </>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 relative">
          {loadingListings && (
            <div className="absolute inset-0 bg-white/60 z-20 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-lg px-5 py-3 flex items-center gap-3">
                <LoadingSpinner size={20} />
                <span className="text-sm text-gray-600">Loading listings…</span>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl shadow">
              {error}
            </div>
          )}

          <MapView
            city={(filters.city as CitySlug) ?? "mumbai"}
            listings={displayedListings}
            amenities={selectedListing ? amenities : []}
            selectedListing={selectedListing}
            onSelectListing={handleSelectListing}
            onDeselect={handleClose}
            visibleAmenityTypes={visibleAmenityTypes}
            officeLocation={officeLocation}
            officeRadius={officeRadius}
            showMetro={showMetro}
          />

          {/* Office / commute search — floats over map */}
          <OfficeSearch
            location={officeLocation}
            radius={officeRadius}
            city={filters.city ?? "mumbai"}
            onLocate={setOfficeLocation}
            onClear={() => setOfficeLocation(null)}
            onRadiusChange={setOfficeRadius}
          />

          {!loadingListings && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur text-xs text-gray-600 px-3 py-1.5 rounded-full shadow border border-gray-100 whitespace-nowrap max-w-[90vw] truncate">
              {displayedListings.length === 0
                ? "No listings — adjust filters"
                : listings.length >= 500
                ? "Showing first 500 — narrow your filters"
                : officeLocation
                  ? `${displayedListings.length} flats within ${officeRadius / 1000}km of ${officeLocation.name} · ${CITIES[filters.city as CitySlug]?.label}`
                  : filterSummary()
                    ? `${filterSummary()} · ${displayedListings.length} results`
                    : `${displayedListings.length} listings on map`}
            </div>
          )}
        </div>

        {selectedListing && (
          <>
            {/* Desktop: right side panel */}
            <div className="hidden sm:flex w-80 shrink-0 border-l border-gray-200 overflow-hidden flex-col bg-white shadow-xl z-20">
              <PropertyPanel
                listing={selectedListing}
                onClose={handleClose}
                onLocalityClick={(loc) => setFilters((f) => ({ ...f, locality: loc }))}
                amenities={amenities}
                visibleAmenityTypes={visibleAmenityTypes}
                loadingAmenities={loadingAmenities}
              />
            </div>

            {/* Mobile: bottom drawer */}
            <>
              <div
                className="sm:hidden fixed inset-0 bg-black/25 z-20"
                onClick={handleClose}
              />
              <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 h-[72vh] bg-white rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-2.5 mb-1 shrink-0" />
                <div className="flex-1 overflow-hidden">
                  <PropertyPanel
                    listing={selectedListing}
                    onClose={handleClose}
                    onLocalityClick={(loc) => setFilters((f) => ({ ...f, locality: loc }))}
                    amenities={amenities}
                    visibleAmenityTypes={visibleAmenityTypes}
                    loadingAmenities={loadingAmenities}
                  />
                </div>
              </div>
            </>
          </>
        )}
      </div>
    </div>
  );
}
