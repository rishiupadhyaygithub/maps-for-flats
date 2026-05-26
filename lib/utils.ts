import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, unit: "total" | "per_month"): string {
  const formatted =
    price >= 10000000
      ? `₹${(price / 10000000).toFixed(2)} Cr`
      : price >= 100000
      ? `₹${(price / 100000).toFixed(1)} L`
      : `₹${price.toLocaleString("en-IN")}`;

  return unit === "per_month" ? `${formatted}/mo` : formatted;
}

export function formatArea(sqft: number | null): string {
  if (!sqft) return "N/A";
  return `${sqft.toLocaleString("en-IN")} sqft`;
}

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

export const AMENITY_ICONS: Record<string, string> = {
  metro: "🚇",
  hospital: "🏥",
  school: "🏫",
  supermarket: "🛒",
  restaurant: "🍽️",
  park: "🌳",
  pharmacy: "💊",
  bank: "🏦",
  gym: "💪",
};

export const AMENITY_COLORS: Record<string, string> = {
  metro: "#6366f1",
  hospital: "#ef4444",
  school: "#f59e0b",
  supermarket: "#10b981",
  restaurant: "#f97316",
  park: "#22c55e",
  pharmacy: "#14b8a6",
  bank: "#8b5cf6",
  gym: "#ec4899",
};

// Mumbai bounding box — keeps map focused
export const MUMBAI_BOUNDS = {
  center: { lat: 19.076, lng: 72.8777 },
  zoom: 12,
};

export const SOURCE_LABELS: Record<string, string> = {
  magicbricks: "MagicBricks",
  "99acres": "99acres",
  housing: "Housing.com",
  nobroker: "NoBroker",
  squareyards: "Square Yards",
};

export const SOURCE_COLORS: Record<string, string> = {
  magicbricks: "#e63946",
  "99acres": "#f4a261",
  housing: "#2a9d8f",
  nobroker: "#457b9d",
  squareyards: "#7c3aed",
};

/** Haversine distance in metres between two lat/lng points */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Marker colour by monthly rent: green → amber → purple (premium) */
export function priceMarkerColor(price: number, unit: "total" | "per_month"): string {
  const monthly = unit === "per_month" ? price : Math.round(price / 12);
  if (monthly <= 35000) return "#16a34a";   // green  — affordable
  if (monthly <= 80000) return "#ea580c";   // orange — mid
  return "#7c3aed";                          // purple — premium
}
