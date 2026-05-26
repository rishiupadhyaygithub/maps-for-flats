import type { Amenity, AmenityType, OverpassResponse } from "./types";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// OSM tag mappings for each amenity type
const AMENITY_QUERIES: Record<AmenityType, string> = {
  metro: `node["railway"="station"]["station"="subway"]`,
  hospital: `node["amenity"="hospital"]`,
  school: `node["amenity"="school"]`,
  supermarket: `node["shop"="supermarket"]`,
  restaurant: `node["amenity"="restaurant"]`,
  park: `node["leisure"="park"]`,
  pharmacy: `node["amenity"="pharmacy"]`,
  bank: `node["amenity"="bank"]`,
  gym: `node["leisure"="fitness_centre"]`,
};

export async function fetchAmenities(
  lat: number,
  lng: number,
  radius: number = 1000,
  types: AmenityType[] = ["metro", "hospital", "school", "supermarket", "park"]
): Promise<Amenity[]> {
  const parts = types.map(
    (t) => `${AMENITY_QUERIES[t]}(around:${radius},${lat},${lng});`
  );

  const query = `
    [out:json][timeout:25];
    (
      ${parts.join("\n      ")}
    );
    out body;
  `;

  // GET is more compatible across Overpass mirrors than POST
  const url = `${OVERPASS_API}?data=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "maps-for-flats/1.0 (property search app)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) throw new Error(`Overpass error: ${res.status}`);

  const data: OverpassResponse = await res.json();

  return data.elements
    .map((el) => {
      const type = tagToType(el.tags);
      if (!type) return null; // skip elements we can't classify
      return {
        id: String(el.id),
        name: el.tags.name ?? el.tags.operator ?? guessName(el.tags),
        type,
        lat: el.lat,
        lng: el.lon,
        distance_m: haversine(lat, lng, el.lat, el.lon),
      };
    })
    .filter(Boolean) as Amenity[];
}

function tagToType(tags: Record<string, string>): AmenityType | null {
  if (tags.railway === "station") return "metro";
  if (tags.amenity === "hospital") return "hospital";
  if (tags.amenity === "school") return "school";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.leisure === "park") return "park";
  if (tags.amenity === "pharmacy") return "pharmacy";
  if (tags.amenity === "bank") return "bank";
  if (tags.leisure === "fitness_centre") return "gym";
  return null; // don't silently misclassify unknown tags
}

function guessName(tags: Record<string, string>): string {
  return tags["name:en"] ?? tags.brand ?? "Unknown";
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
