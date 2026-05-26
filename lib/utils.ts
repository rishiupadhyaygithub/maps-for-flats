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

export type CitySlug = "mumbai" | "delhi" | "pune" | "bangalore" | "hyderabad" | "kolkata" | "chennai";

export const CITIES: Record<CitySlug, {
  label:  string;
  center: [number, number];
  zoom:   number;
  dbName: string;   // exact value stored in Supabase listings.city column
}> = {
  mumbai:    { label: "Mumbai",    center: [19.076,  72.877], zoom: 12, dbName: "Mumbai"    },
  delhi:     { label: "Delhi/NCR", center: [28.614,  77.209], zoom: 11, dbName: "Delhi"     },
  pune:      { label: "Pune",      center: [18.520,  73.857], zoom: 12, dbName: "Pune"      },
  bangalore: { label: "Bangalore", center: [12.972,  77.595], zoom: 12, dbName: "Bangalore" },
  hyderabad: { label: "Hyderabad", center: [17.385,  78.487], zoom: 12, dbName: "Hyderabad" },
  kolkata:   { label: "Kolkata",   center: [22.573,  88.364], zoom: 12, dbName: "Kolkata"   },
  chennai:   { label: "Chennai",   center: [13.083,  80.271], zoom: 12, dbName: "Chennai"   },
};

export const CITY_SLUGS = Object.keys(CITIES) as CitySlug[];

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
