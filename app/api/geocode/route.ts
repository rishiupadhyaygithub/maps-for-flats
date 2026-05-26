import { NextRequest, NextResponse } from "next/server";
import { CITIES, type CitySlug } from "@/lib/utils";

const VALID_CITIES = Object.keys(CITIES) as CitySlug[];

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  // Bias results to active city
  const citySlug = (req.nextUrl.searchParams.get("city") ?? "mumbai") as CitySlug;
  const cityLabel = VALID_CITIES.includes(citySlug) ? CITIES[citySlug].dbName : "Mumbai";
  const cityRegex = new RegExp(cityLabel, "i");
  const query = cityRegex.test(q) ? q : `${q}, ${cityLabel}, India`;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`;

    const res = await fetch(url, {
      headers: { "User-Agent": "maps-for-flats/1.0 (rishi)" },
      next: { revalidate: 3600 }, // cache geocode results 1h server-side
    });

    if (!res.ok) throw new Error(`Nominatim ${res.status}`);

    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
