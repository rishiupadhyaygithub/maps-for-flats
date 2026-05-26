import { createClient } from "@supabase/supabase-js";
import type { Listing } from "./types";

// Lazy client — avoids module-level errors during build when env vars aren't set
export function getPublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Server-side client with elevated privileges (scrapers, API routes)
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function upsertListings(listings: Omit<Listing, "id" | "created_at">[]) {
  const client = getServiceClient();
  const { error } = await client
    .from("listings")
    .upsert(listings, { onConflict: "source,source_id" });
  if (error) throw error;
}

export async function fetchListings(filters: {
  city?: string;
  listing_type?: string;
  property_type?: string;
  bhk?: number;
  min_price?: number;
  max_price?: number;
  furnishing?: string;
  source?: string;
  locality?: string;
  sort_by?: string;
}) {
  const supabase = getPublicClient();
  let query = supabase.from("listings").select("*");

  if (filters.city)
    query = query.ilike("city", filters.city);

  if (filters.listing_type && filters.listing_type !== "all")
    query = query.eq("listing_type", filters.listing_type);
  if (filters.property_type && filters.property_type !== "all")
    query = query.eq("property_type", filters.property_type);
  if (filters.bhk && filters.bhk !== 0)
    query = query.eq("bhk", filters.bhk);
  if (filters.min_price)
    query = query.gte("price", filters.min_price);
  if (filters.max_price)
    query = query.lte("price", filters.max_price);
  if (filters.furnishing && filters.furnishing !== "all")
    query = query.eq("furnishing", filters.furnishing);
  if (filters.source && filters.source !== "all")
    query = query.eq("source", filters.source);
  if (filters.locality)
    query = query.ilike("locality", `%${filters.locality}%`);

  // Sort
  switch (filters.sort_by) {
    case "price_asc":
      query = query.order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false });
      break;
    case "area_desc":
      query = query.order("area_sqft", { ascending: false });
      break;
    default:
      query = query.order("scraped_at", { ascending: false });
  }

  const { data, error } = await query.limit(500);

  if (error) throw error;
  return data as Listing[];
}
