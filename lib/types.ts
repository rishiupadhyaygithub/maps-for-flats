export type ListingType = "rent" | "buy";
export type PropertyType = "flat" | "house" | "villa" | "plot" | "pg";
export type FurnishingStatus = "furnished" | "semi-furnished" | "unfurnished";
export type Source = "magicbricks" | "99acres" | "housing" | "nobroker" | "squareyards";

export interface Listing {
  id: string;
  source: Source;
  source_id: string;
  url: string;
  title: string;
  listing_type: ListingType;
  property_type: PropertyType;
  price: number;
  price_unit: "total" | "per_month";
  area_sqft: number | null;
  bhk: number | null;
  furnishing: FurnishingStatus | null;
  floor: number | null;
  total_floors: number | null;
  locality: string;
  city: string;
  lat: number;
  lng: number;
  images: string[];
  floor_plan_images: string[];
  amenities: string[];
  description: string | null;
  broker_name: string | null;
  location_exact: boolean;   // true = coords from listing, false = geocoded from locality string
  scraped_at: string;
  created_at: string;
  // Livability layer (computed by score_livability.py — optional, not set by scrapers)
  livability_score?:   number | null;
  flood_risk?:         "low" | "medium" | "high" | "very_high" | null;
  nearest_metro_m?:    number | null;
  nearest_metro_name?: string | null;
}

export interface Amenity {
  id: string;
  name: string;
  type: AmenityType;
  lat: number;
  lng: number;
  distance_m?: number;
}

export type AmenityType =
  | "metro"
  | "hospital"
  | "school"
  | "supermarket"
  | "restaurant"
  | "park"
  | "pharmacy"
  | "bank"
  | "gym";

export interface AmenityFilter {
  metro: boolean;
  hospital: boolean;
  school: boolean;
  supermarket: boolean;
  restaurant: boolean;
  park: boolean;
  pharmacy: boolean;
  bank: boolean;
  gym: boolean;
}

export type SortOption = "price_asc" | "price_desc" | "area_desc" | "newest";

export interface ListingFilters {
  listing_type: ListingType | "all";
  property_type: PropertyType | "all";
  bhk: number | "all";
  min_price: number | null;
  max_price: number | null;
  furnishing: FurnishingStatus | "all";
  source: Source | "all";
  locality: string;
  sort_by: SortOption;
}

export interface OverpassNode {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

export interface OverpassResponse {
  elements: OverpassNode[];
}
