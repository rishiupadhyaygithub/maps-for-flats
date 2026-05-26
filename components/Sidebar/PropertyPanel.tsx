"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import {
  X, ExternalLink, MapPin, Building2, Layers,
  Sofa, Maximize2, ChevronLeft, ChevronRight, Loader2, Heart,
} from "lucide-react";
import { useShortlist } from "@/lib/shortlist";
import type { Listing, Amenity, AmenityType } from "@/lib/types";
import {
  formatPrice, formatArea, formatDistance,
  AMENITY_ICONS, AMENITY_COLORS, SOURCE_LABELS, SOURCE_COLORS,
} from "@/lib/utils";
import StreetView from "./StreetView";
import FloorPlan from "./FloorPlan";

interface Props {
  listing: Listing;
  onClose: () => void;
  onLocalityClick: (locality: string) => void;
  amenities: Amenity[];
  visibleAmenityTypes: AmenityType[];
  loadingAmenities?: boolean;
}

type Tab = "details" | "floor_plan" | "street_view" | "amenities";

const AMENITY_TYPE_LABELS: Record<AmenityType, string> = {
  metro: "Metro / Station",
  hospital: "Hospital",
  school: "School",
  supermarket: "Supermarket",
  restaurant: "Restaurant",
  park: "Park",
  pharmacy: "Pharmacy",
  bank: "Bank",
  gym: "Gym",
};

const ALL_TYPES: AmenityType[] = [
  "metro", "hospital", "school", "supermarket",
  "restaurant", "park", "pharmacy", "bank", "gym",
];

export default function PropertyPanel({
  listing, onClose, onLocalityClick, amenities, visibleAmenityTypes, loadingAmenities,
}: Props) {
  const [tab, setTab] = useState<Tab>("details");
  const [imgIndex, setImgIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const { toggle, isShortlisted } = useShortlist();
  const saved = isShortlisted(listing.id);

  useEffect(() => {
    setTab("details");
    setImgIndex(0);
    setImgError(false);
  }, [listing.id]);

  const sourceColor = SOURCE_COLORS[listing.source] ?? "#3b82f6";

  // Group ALL amenities by type (regardless of toggle — sidebar shows everything)
  const byType: Partial<Record<AmenityType, Amenity[]>> = {};
  for (const a of amenities) {
    if (!byType[a.type]) byType[a.type] = [];
    byType[a.type]!.push(a);
  }
  // Sort each group by distance
  for (const type of ALL_TYPES) {
    byType[type]?.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
  }

  const totalNearby = amenities.length;
  const hasFloorPlan = listing.floor_plan_images.length > 0;
  const isApprox = !listing.location_exact;
  // "Street View" label only when coords are exact; otherwise "Area View" to be honest
  const mapViewLabel = isApprox ? "Area View" : "Street View";

  // Only show tabs where we have content
  const tabs: { key: Tab; label: string }[] = [
    { key: "details", label: "Details" },
    ...(hasFloorPlan ? [{ key: "floor_plan" as Tab, label: "Floor Plan" }] : []),
    { key: "street_view", label: mapViewLabel },
    { key: "amenities", label: `Nearby (${totalNearby})` },
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Image header */}
      <div className="relative" style={{ background: sourceColor }}>
        {listing.images.length > 0 && !imgError ? (
          <div className="relative h-48">
            <Image
              src={listing.images[imgIndex]}
              alt={listing.title}
              fill
              className="object-cover"
              unoptimized
              onError={() => setImgError(true)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            {listing.images.length > 1 && (
              <>
                <button
                  onClick={() => setImgIndex((i) => Math.max(0, i - 1))}
                  disabled={imgIndex === 0}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 disabled:opacity-30"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setImgIndex((i) => Math.min(listing.images.length - 1, i + 1))}
                  disabled={imgIndex === listing.images.length - 1}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1 disabled:opacity-30"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {listing.images.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIndex ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="h-16" />
        )}
        {/* Heart shortlist */}
        <button
          onClick={() => toggle(listing)}
          className={`absolute top-3 left-3 rounded-full p-1.5 z-10 transition-colors ${
            saved ? "bg-red-500 text-white" : "bg-black/40 text-white hover:bg-red-500"
          }`}
          title={saved ? "Remove from shortlist" : "Add to shortlist"}
        >
          <Heart size={16} fill={saved ? "white" : "none"} />
        </button>
        <button
          onClick={onClose}
          className="absolute top-3 right-3 bg-black/40 text-white rounded-full p-1.5 hover:bg-black/60 z-10"
        >
          <X size={16} />
        </button>
      </div>

      {/* Title + price */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2">{listing.title}</h2>
            <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-xs flex-wrap">
              <MapPin size={11} />
              <button
                onClick={() => onLocalityClick(listing.locality)}
                className="hover:text-violet-600 hover:underline transition-colors text-left"
                title={`Filter to ${listing.locality}`}
              >
                {listing.locality}, {listing.city}
              </button>
              {isApprox && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  ~ approx. area
                </span>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-extrabold text-base" style={{ color: sourceColor }}>
              {formatPrice(listing.price, listing.price_unit)}
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full text-white font-medium" style={{ background: sourceColor }}>
              {SOURCE_LABELS[listing.source]}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-600">
          {listing.bhk && <span className="flex items-center gap-1"><Building2 size={11} /> {listing.bhk} BHK</span>}
          {listing.area_sqft && <span className="flex items-center gap-1"><Maximize2 size={11} /> {formatArea(listing.area_sqft)}</span>}
          {listing.floor != null && <span className="flex items-center gap-1"><Layers size={11} /> Floor {listing.floor}/{listing.total_floors ?? "?"}</span>}
          {listing.furnishing && <span className="flex items-center gap-1"><Sofa size={11} /> {listing.furnishing}</span>}
          {listing.price && listing.area_sqft && listing.price_unit === "per_month" && (
            <span className="flex items-center gap-1 text-gray-400">
              ₹{Math.round(listing.price / listing.area_sqft).toLocaleString("en-IN")}/sqft
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-100 overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t.key
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 sidebar-scroll">
        {tab === "details" && (
          <>
            {/* Livability Score */}
            {listing.livability_score != null && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Livability Score</span>
                  <span
                    className="text-lg font-extrabold"
                    style={{
                      color: listing.livability_score >= 65 ? "#16a34a"
                           : listing.livability_score >= 40 ? "#d97706"
                           : "#dc2626",
                    }}
                  >
                    {listing.livability_score}<span className="text-xs font-normal text-gray-400">/100</span>
                  </span>
                </div>
                {/* Score bar */}
                <div className="w-full h-1.5 bg-gray-200 rounded-full mb-3">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${listing.livability_score}%`,
                      background: listing.livability_score >= 65 ? "#16a34a"
                                : listing.livability_score >= 40 ? "#d97706"
                                : "#dc2626",
                    }}
                  />
                </div>
                {/* Component breakdown */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                  {listing.nearest_metro_m != null && (
                    <div className="flex items-center gap-1.5">
                      <span>🚇</span>
                      <span className="text-gray-500">Metro:</span>
                      <span className="font-semibold ml-auto text-gray-700">
                        {listing.nearest_metro_m < 1000
                          ? `${listing.nearest_metro_m}m`
                          : `${(listing.nearest_metro_m / 1000).toFixed(1)}km`}
                      </span>
                    </div>
                  )}
                  {listing.nearest_metro_name && (
                    <div className="col-span-2 flex items-center gap-1.5 text-gray-400">
                      <span className="ml-5">Nearest: {listing.nearest_metro_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {listing.description && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</h3>
                <p className="text-sm text-gray-700 leading-relaxed">{listing.description}</p>
              </div>
            )}

            {listing.amenities.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Society Amenities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {listing.amenities.map((a) => (
                    <span key={a} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {listing.broker_name && (
              <div className="text-xs text-gray-500">
                Listed by: <span className="font-medium text-gray-700">{listing.broker_name}</span>
              </div>
            )}

            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: sourceColor }}
            >
              <ExternalLink size={14} />
              View on {SOURCE_LABELS[listing.source]}
            </a>
          </>
        )}

        {tab === "floor_plan" && (
          <>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Floor Plan</h3>
            <FloorPlan images={listing.floor_plan_images} />
          </>
        )}

        {tab === "street_view" && (
          <>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {mapViewLabel}
            </h3>
            {isApprox && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <span className="text-base leading-none">⚠️</span>
                <span>
                  Pin placed at <strong>{listing.locality}</strong> area centre, not the exact building.
                  Use the broker link to confirm the address.
                </span>
              </div>
            )}
            <StreetView lat={listing.lat} lng={listing.lng} />
          </>
        )}

        {tab === "amenities" && (
          <>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Nearby Amenities
              <span className="ml-1 text-gray-400 normal-case font-normal">(within 1.5 km)</span>
            </h3>

            {loadingAmenities ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                <Loader2 size={16} className="animate-spin" />
                Fetching nearby places…
              </div>
            ) : totalNearby === 0 ? (
              <p className="text-sm text-gray-400">No nearby places found in OpenStreetMap data for this area.</p>
            ) : (
              <div className="space-y-4">
                {ALL_TYPES.map((type) => {
                  const items = byType[type];
                  if (!items?.length) return null;
                  const color = AMENITY_COLORS[type];
                  const icon = AMENITY_ICONS[type];
                  const isVisible = visibleAmenityTypes.includes(type);

                  return (
                    <div key={type}>
                      {/* Category header */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-sm shrink-0"
                          style={{ background: color + "22", border: `1.5px solid ${color}` }}
                        >
                          {icon}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          {AMENITY_TYPE_LABELS[type]}
                        </span>
                        <span className="text-xs text-gray-400">
                          {items.length} found
                        </span>
                        {!isVisible && (
                          <span className="ml-auto text-[10px] text-gray-300 italic">hidden on map</span>
                        )}
                      </div>

                      {/* Items — show top 3 */}
                      <div className="space-y-1 pl-8">
                        {items.slice(0, 3).map((a) => (
                          <div key={a.id} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                            <span className="text-gray-700 truncate flex-1">{a.name}</span>
                            {a.distance_m != null && (
                              <span
                                className="ml-2 shrink-0 font-medium"
                                style={{ color: a.distance_m < 500 ? "#16a34a" : a.distance_m < 1000 ? "#d97706" : "#9ca3af" }}
                              >
                                {formatDistance(a.distance_m)}
                              </span>
                            )}
                          </div>
                        ))}
                        {items.length > 3 && (
                          <p className="text-[10px] text-gray-400 pt-0.5">+{items.length - 3} more</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
