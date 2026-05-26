"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Building2, Maximize2, Layers, Sofa, ExternalLink, Heart } from "lucide-react";
import type { Listing } from "@/lib/types";
import { formatPrice, formatArea, SOURCE_LABELS, SOURCE_COLORS } from "@/lib/utils";
import { useShortlist } from "@/lib/shortlist";

export default function SavedPage() {
  const { toggle, isShortlisted, getAll } = useShortlist();
  const [listings, setListings] = useState<Listing[]>([]);

  useEffect(() => {
    setListings(getAll());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRemove(listing: Listing) {
    toggle(listing);
    setListings((prev) => prev.filter((l) => l.id !== listing.id));
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2">
          <Heart size={18} className="text-red-500" fill="currentColor" />
          <h1 className="font-bold text-gray-900">Shortlisted Flats</h1>
        </div>
        <span className="ml-auto text-sm text-gray-400 font-medium">{listings.length} saved</span>
      </header>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-32 gap-4 text-gray-400">
          <span className="text-5xl">🤍</span>
          <p className="text-sm font-medium">No shortlisted flats yet</p>
          <p className="text-xs text-gray-300">Tap the heart on any listing to save it here</p>
          <Link
            href="/"
            className="mt-2 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition-colors"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto w-full p-4 space-y-3">
          {listings.map((l) => {
            const color = SOURCE_COLORS[l.source] ?? "#7c3aed";
            const saved = isShortlisted(l.id);
            const pricePerSqft =
              l.price && l.area_sqft && l.price_unit === "per_month"
                ? Math.round(l.price / l.area_sqft)
                : null;

            return (
              <div key={l.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Coloured top strip */}
                <div className="h-1.5 w-full" style={{ background: color }} />

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-gray-900 text-sm leading-snug">{l.title}</h2>
                      <div className="flex items-center gap-1 mt-1 text-gray-400 text-xs">
                        <MapPin size={10} />
                        <span>{l.locality}, {l.city}</span>
                      </div>

                      {/* Attributes */}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
                        {l.bhk && <span className="flex items-center gap-1"><Building2 size={10} />{l.bhk} BHK</span>}
                        {l.area_sqft && <span className="flex items-center gap-1"><Maximize2 size={10} />{formatArea(l.area_sqft)}</span>}
                        {l.floor != null && <span className="flex items-center gap-1"><Layers size={10} />Floor {l.floor}{l.total_floors ? `/${l.total_floors}` : ""}</span>}
                        {l.furnishing && <span className="flex items-center gap-1"><Sofa size={10} />{l.furnishing}</span>}
                        {pricePerSqft && <span className="text-gray-400">₹{pricePerSqft.toLocaleString("en-IN")}/sqft</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                      <div className="font-extrabold text-base" style={{ color }}>
                        {formatPrice(l.price, l.price_unit)}
                      </div>
                      <span className="text-[10px] text-white px-2 py-0.5 rounded-full font-medium" style={{ background: color }}>
                        {SOURCE_LABELS[l.source] ?? l.source}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-3">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: color }}
                    >
                      <ExternalLink size={12} />
                      View on {SOURCE_LABELS[l.source] ?? "site"}
                    </a>
                    <button
                      onClick={() => handleRemove(l)}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition-colors"
                      title="Remove from shortlist"
                    >
                      <Heart size={14} fill={saved ? "currentColor" : "none"} className={saved ? "text-red-500" : ""} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Bottom back link */}
          <div className="text-center pt-4 pb-8">
            <Link href="/" className="text-sm text-violet-600 hover:underline font-medium">
              ← Back to map
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
