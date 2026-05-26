"use client";

import { useState, useRef } from "react";
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react";
import type { ListingFilters, SortOption } from "@/lib/types";
import { CITIES, CITY_SLUGS, ACTIVE_CITY_SLUGS, type CitySlug } from "@/lib/utils";

interface Props {
  filters: ListingFilters;
  onChange: (f: ListingFilters) => void;
  totalCount: number;
}

export const DEFAULT_FILTERS: ListingFilters = {
  city: "mumbai",
  listing_type: "rent",
  property_type: "all",
  bhk: "all",
  min_price: null,
  max_price: null,
  furnishing: "all",
  source: "all",
  locality: "",
  sort_by: "newest",
};

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "newest",     label: "Newest"   },
  { value: "price_asc",  label: "Price ↑"  },
  { value: "price_desc", label: "Price ↓"  },
  { value: "area_desc",  label: "Area ↓"   },
];

// Max-rent presets (null = no limit)
const RENT_PRESETS: { label: string; value: number | null }[] = [
  { label: "Any",    value: null   },
  { label: "≤25k",   value: 25000  },
  { label: "≤40k",   value: 40000  },
  { label: "≤60k",   value: 60000  },
  { label: "≤1L",    value: 100000 },
  { label: "≤2L",    value: 200000 },
];

export default function FilterBar({ filters, onChange, totalCount }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [localLocality, setLocalLocality] = useState(filters.locality ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function update(partial: Partial<ListingFilters>) {
    onChange({ ...filters, ...partial });
  }

  function handleLocalityChange(val: string) {
    setLocalLocality(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange({ ...filters, locality: val });
    }, 350);
  }

  function reset() {
    setLocalLocality("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Reset filters but keep city
    onChange({ ...DEFAULT_FILTERS, city: filters.city });
  }

  // Count active non-default filters
  const activeCount = [
    filters.listing_type !== "all" && filters.listing_type !== DEFAULT_FILTERS.listing_type,
    filters.property_type !== "all",
    filters.bhk !== "all",
    filters.max_price != null,
    filters.min_price != null,
    filters.furnishing !== "all",
    filters.source !== "all",
    filters.locality !== "",
    filters.sort_by !== "newest",
  ].filter(Boolean).length;

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      {/* ── City picker ── */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 overflow-x-auto no-scrollbar border-b border-gray-100">
        {ACTIVE_CITY_SLUGS.map((slug) => (
          <button
            key={slug}
            onClick={() => {
              setLocalLocality("");
              onChange({ ...DEFAULT_FILTERS, city: slug });
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-full whitespace-nowrap transition-colors shrink-0 ${
              filters.city === slug
                ? "bg-violet-600 text-white"
                : "text-gray-500 hover:bg-gray-100 border border-gray-200"
            }`}
          >
            {CITIES[slug].label}
          </button>
        ))}
        <span className="text-[10px] text-gray-300 pl-1 whitespace-nowrap shrink-0">+ more cities soon</span>
      </div>

      {/* ── Top row ── */}
      <div className="flex items-center gap-2 px-3 py-2 flex-wrap">

        {/* Locality search */}
        <div className="relative w-40">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Locality…"
            value={localLocality}
            onChange={(e) => handleLocalityChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* Rent / Buy */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["all", "rent", "buy"] as const).map((t) => (
            <button
              key={t}
              onClick={() => update({ listing_type: t })}
              className={`px-3 py-1.5 text-xs font-medium transition-colors capitalize ${
                filters.listing_type === t
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
        </div>

        {/* BHK — includes 5+ */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(["all", 1, 2, 3, 4, 5] as const).map((b) => (
            <button
              key={b}
              onClick={() => update({ bhk: b })}
              className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filters.bhk === b
                  ? "bg-violet-600 text-white"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {b === "all" ? "Any" : b === 5 ? "5+" : `${b}BHK`}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden">
          <span className="pl-2 text-gray-400"><ArrowUpDown size={12} /></span>
          <select
            value={filters.sort_by}
            onChange={(e) => update({ sort_by: e.target.value as SortOption })}
            className="text-xs py-1.5 pr-2 pl-1 focus:outline-none bg-transparent text-gray-700"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* More filters — shows active count */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            expanded || activeCount > 0
              ? "bg-violet-50 border-violet-300 text-violet-600"
              : "border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal size={12} />
          Filters
          {activeCount > 0 && (
            <span className="w-4 h-4 bg-violet-600 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {activeCount}
            </span>
          )}
        </button>

        {activeCount > 0 && (
          <button onClick={reset} className="text-gray-400 hover:text-red-500 transition-colors" title="Clear all filters">
            <X size={15} />
          </button>
        )}

        <span className="text-xs text-gray-400 ml-auto shrink-0 font-medium">
          {totalCount} listings
        </span>
      </div>

      {/* ── Max rent presets ── always visible, below top row */}
      <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
        <span className="text-xs text-gray-400 font-medium shrink-0">Max rent:</span>
        {RENT_PRESETS.map((p) => (
          <button
            key={String(p.value)}
            onClick={() => update({ max_price: p.value })}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              filters.max_price === p.value
                ? "bg-violet-600 text-white border-violet-600"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Expanded panel ── */}
      {expanded && (
        <div className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-gray-100 pt-2">

          {/* Property type */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Type</label>
            <select
              value={filters.property_type}
              onChange={(e) => update({ property_type: e.target.value as ListingFilters["property_type"] })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="all">All types</option>
              <option value="flat">Flat</option>
              <option value="house">House</option>
              <option value="villa">Villa</option>
              <option value="plot">Plot</option>
              <option value="pg">PG</option>
            </select>
          </div>

          {/* Furnishing */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Furnishing</label>
            <select
              value={filters.furnishing}
              onChange={(e) => update({ furnishing: e.target.value as ListingFilters["furnishing"] })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="all">Any</option>
              <option value="furnished">Furnished</option>
              <option value="semi-furnished">Semi-furnished</option>
              <option value="unfurnished">Unfurnished</option>
            </select>
          </div>

          {/* Min price */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Min rent (₹)</label>
            <input
              type="number"
              placeholder="e.g. 15000"
              value={filters.min_price ?? ""}
              onChange={(e) => update({ min_price: e.target.value ? Number(e.target.value) : null })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>

          {/* Source — includes squareyards */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block font-medium">Source</label>
            <select
              value={filters.source}
              onChange={(e) => update({ source: e.target.value as ListingFilters["source"] })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-400"
            >
              <option value="all">All sources</option>
              <option value="squareyards">Square Yards</option>
              <option value="magicbricks">MagicBricks</option>
              <option value="99acres">99acres</option>
              <option value="housing">Housing.com</option>
              <option value="nobroker">NoBroker</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
