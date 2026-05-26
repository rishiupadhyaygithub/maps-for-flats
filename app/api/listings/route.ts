import { NextRequest, NextResponse } from "next/server";
import { fetchListings } from "@/lib/supabase";

const VALID_LISTING_TYPES = ["rent", "buy"] as const;
const VALID_PROPERTY_TYPES = ["flat", "house", "villa", "plot", "pg"] as const;
const VALID_FURNISHINGS = ["furnished", "semi-furnished", "unfurnished"] as const;
const VALID_SOURCES = ["magicbricks", "99acres", "housing", "nobroker"] as const;
const VALID_SORTS = ["newest", "price_asc", "price_desc", "area_desc"] as const;

function pick<T extends string>(val: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(val as T) ? (val as T) : undefined;
}

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;

  const bhkRaw = Number(s.get("bhk"));
  const minPriceRaw = Number(s.get("min_price"));
  const maxPriceRaw = Number(s.get("max_price"));

  try {
    const data = await fetchListings({
      listing_type: pick(s.get("listing_type"), VALID_LISTING_TYPES),
      property_type: pick(s.get("property_type"), VALID_PROPERTY_TYPES),
      bhk: s.get("bhk") && bhkRaw > 0 ? bhkRaw : undefined,
      min_price: s.get("min_price") && minPriceRaw > 0 ? minPriceRaw : undefined,
      max_price: s.get("max_price") && maxPriceRaw > 0 ? maxPriceRaw : undefined,
      furnishing: pick(s.get("furnishing"), VALID_FURNISHINGS),
      source: pick(s.get("source"), VALID_SOURCES),
      locality: s.get("locality")?.slice(0, 100) ?? undefined,
      sort_by: pick(s.get("sort_by"), VALID_SORTS),
    });

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[/api/listings]", err);
    return NextResponse.json({ error: "Failed to fetch listings" }, { status: 500 });
  }
}
