import { NextRequest, NextResponse } from "next/server";
import { fetchAmenities } from "@/lib/overpass";
import type { AmenityType } from "@/lib/types";

const VALID_TYPES: AmenityType[] = [
  "metro",
  "hospital",
  "school",
  "supermarket",
  "restaurant",
  "park",
  "pharmacy",
  "bank",
  "gym",
];

export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams;

  const lat = parseFloat(s.get("lat") ?? "");
  const lng = parseFloat(s.get("lng") ?? "");
  const radius = parseInt(s.get("radius") ?? "1000");
  const typesRaw = s.get("types") ?? "";

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const types = typesRaw
    .split(",")
    .map((t) => t.trim())
    .filter((t): t is AmenityType => VALID_TYPES.includes(t as AmenityType));

  if (types.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const data = await fetchAmenities(lat, lng, Math.min(radius, 3000), types);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (err) {
    console.error("[/api/amenities]", err);
    return NextResponse.json({ error: "Failed to fetch amenities" }, { status: 500 });
  }
}
