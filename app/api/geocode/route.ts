import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q?.trim()) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  // Bias results to Mumbai — append if not already mentioned
  const query = /mumbai/i.test(q) ? q : `${q}, Mumbai, India`;

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
