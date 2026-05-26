"use client";

import { useState, useRef } from "react";
import { Briefcase, X, Loader2 } from "lucide-react";

export interface OfficeLocation {
  lat: number;
  lng: number;
  name: string;
}

interface Props {
  location: OfficeLocation | null;
  radius: number;
  city: string;
  onLocate: (loc: OfficeLocation) => void;
  onClear: () => void;
  onRadiusChange: (r: number) => void;
}

const RADII = [
  { label: "1 km",  value: 1000  },
  { label: "2 km",  value: 2000  },
  { label: "5 km",  value: 5000  },
  { label: "10 km", value: 10000 },
];

export default function OfficeSearch({ location, radius, city, onLocate, onClear, onRadiusChange }: Props) {
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&city=${encodeURIComponent(city)}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        setError("Not found — try a more specific name");
        return;
      }
      const hit = data[0];
      onLocate({
        lat:  parseFloat(hit.lat),
        lng:  parseFloat(hit.lon),
        name: hit.display_name.split(",")[0].trim(),
      });
      setError(null);
    } catch {
      setError("Search failed — try again");
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setQuery("");
    setError(null);
    onClear();
    inputRef.current?.focus();
  }

  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 w-72 max-w-[calc(100vw-80px)]">

      {/* Search box */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex items-center gap-2 px-3 py-2">
        <Briefcase size={14} className="text-violet-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search office / commute point…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="flex-1 text-xs focus:outline-none text-gray-700 placeholder-gray-400 min-w-0"
        />
        {(query || location) && !loading && (
          <button onClick={clear} className="text-gray-300 hover:text-gray-500 shrink-0">
            <X size={13} />
          </button>
        )}
        <button
          onClick={search}
          disabled={loading || !query.trim()}
          className="px-2.5 py-1 bg-violet-600 text-white text-xs rounded-lg disabled:opacity-40 hover:bg-violet-700 transition-colors font-medium shrink-0 flex items-center gap-1"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : "Go"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-1.5 rounded-xl">
          {error}
        </div>
      )}

      {/* Radius + label — only when office is pinned */}
      {location && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700 truncate flex-1">
              📍 {location.name}
            </span>
            <button onClick={clear} className="ml-2 text-gray-300 hover:text-red-400 shrink-0">
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-gray-400 shrink-0">Radius:</span>
            {RADII.map((r) => (
              <button
                key={r.value}
                onClick={() => onRadiusChange(r.value)}
                className={`px-2.5 py-0.5 text-xs rounded-full border font-medium transition-colors ${
                  radius === r.value
                    ? "bg-violet-600 text-white border-violet-600"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
