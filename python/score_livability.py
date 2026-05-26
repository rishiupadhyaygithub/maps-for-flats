"""
Compute Livability Score for every listing in Supabase (all cities).
Score = weighted composite (0–100) of:
  - Flood risk        30%  (ward the listing falls in — Mumbai only; medium assumed elsewhere)
  - Metro proximity   30%  (distance to nearest metro station)
  - Price vs locality 25%  (value for money vs median in that locality)
  - AQI               15%  (nearest CPCB station avg PM2.5 AQI)

Updates listings.livability_score, flood_risk, nearest_metro_m, nearest_metro_name.

Usage:
    python3 score_livability.py                  # all cities
    python3 score_livability.py --city mumbai
    python3 score_livability.py --dry-run
"""

import json, math, ssl, urllib.request, urllib.error, argparse, os, time
from pathlib import Path
from collections import defaultdict

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# ── Weights ───────────────────────────────────────────────────────────────────
W_FLOOD  = 0.30
W_METRO  = 0.30
W_PRICE  = 0.25
W_AQI    = 0.15

# ── AQI station data per city (CPCB annual averages 2023, PM2.5 AQI) ──────────
# Lower AQI = higher score. Fallback city avg used when station missing.
AQI_STATIONS_BY_CITY: dict[str, list[dict]] = {
    "Mumbai": [
        {"name": "Bandra Kurla Complex", "lat": 19.0607, "lng": 72.8547, "aqi": 72},
        {"name": "Borivali East",        "lat": 19.2322, "lng": 72.8567, "aqi": 85},
        {"name": "Chembur",              "lat": 19.0600, "lng": 72.8997, "aqi": 98},
        {"name": "Colaba",               "lat": 18.9067, "lng": 72.8147, "aqi": 55},
        {"name": "Kurla",                "lat": 19.0720, "lng": 72.8800, "aqi": 95},
        {"name": "Malad West",           "lat": 19.1876, "lng": 72.8486, "aqi": 82},
        {"name": "Mazgaon",              "lat": 18.9590, "lng": 72.8420, "aqi": 88},
        {"name": "Sion",                 "lat": 19.0437, "lng": 72.8633, "aqi": 105},
        {"name": "Worli",                "lat": 19.0176, "lng": 72.8156, "aqi": 68},
        {"name": "Andheri East",         "lat": 19.1176, "lng": 72.8766, "aqi": 91},
        {"name": "Powai",                "lat": 19.1197, "lng": 72.9083, "aqi": 62},
        {"name": "Mulund",               "lat": 19.1734, "lng": 72.9567, "aqi": 58},
        {"name": "Goregaon",             "lat": 19.1663, "lng": 72.8526, "aqi": 79},
    ],
    "Delhi": [
        {"name": "Anand Vihar",          "lat": 28.6469, "lng": 77.3155, "aqi": 185},
        {"name": "Chandni Chowk",        "lat": 28.6562, "lng": 77.2282, "aqi": 165},
        {"name": "Dwarka Sector 8",      "lat": 28.5733, "lng": 77.0636, "aqi": 145},
        {"name": "IGI Airport T3",       "lat": 28.5562, "lng": 77.1000, "aqi": 130},
        {"name": "Jahangirpuri",         "lat": 28.7297, "lng": 77.1673, "aqi": 195},
        {"name": "Lodhi Road",           "lat": 28.5931, "lng": 77.2271, "aqi": 110},
        {"name": "Mandir Marg",          "lat": 28.6366, "lng": 77.2008, "aqi": 140},
        {"name": "Punjabi Bagh",         "lat": 28.6714, "lng": 77.1318, "aqi": 170},
        {"name": "RK Puram",             "lat": 28.5644, "lng": 77.1888, "aqi": 135},
        {"name": "Shadipur",             "lat": 28.6458, "lng": 77.1485, "aqi": 160},
        {"name": "Siri Fort",            "lat": 28.5528, "lng": 77.2199, "aqi": 125},
        {"name": "Noida Sector 1",       "lat": 28.5730, "lng": 77.3219, "aqi": 148},
        {"name": "Noida Sector 62",      "lat": 28.6270, "lng": 77.3621, "aqi": 155},
        {"name": "Gurgaon",              "lat": 28.4595, "lng": 77.0266, "aqi": 138},
    ],
    "Bangalore": [
        {"name": "BTM Layout",                 "lat": 12.9166, "lng": 77.6101, "aqi": 65},
        {"name": "Bwssb Kadabesanahalli",      "lat": 12.9296, "lng": 77.6894, "aqi": 72},
        {"name": "City Railway Station",       "lat": 12.9784, "lng": 77.5724, "aqi": 78},
        {"name": "Hebbal",                     "lat": 13.0358, "lng": 77.5970, "aqi": 68},
        {"name": "Hombegowda Nagar",           "lat": 12.9483, "lng": 77.5890, "aqi": 70},
        {"name": "Jayanagar 4th Block",        "lat": 12.9248, "lng": 77.5823, "aqi": 62},
        {"name": "Peenya",                     "lat": 13.0282, "lng": 77.5168, "aqi": 85},
    ],
    "Hyderabad": [
        {"name": "ICRISAT Patancheru",   "lat": 17.5380, "lng": 78.2610, "aqi": 58},
        {"name": "IDA Pashamylaram",     "lat": 17.5400, "lng": 78.2500, "aqi": 62},
        {"name": "IITH Kandi",           "lat": 17.5833, "lng": 78.1283, "aqi": 48},
        {"name": "Nacharam",             "lat": 17.3990, "lng": 78.5430, "aqi": 72},
        {"name": "Somajiguda",           "lat": 17.4240, "lng": 78.4603, "aqi": 65},
        {"name": "Zoo Park",             "lat": 17.3509, "lng": 78.4518, "aqi": 60},
        {"name": "Sanathnagar",          "lat": 17.4425, "lng": 78.4286, "aqi": 68},
    ],
    "Pune": [
        {"name": "Alandi",               "lat": 18.6730, "lng": 73.8992, "aqi": 75},
        {"name": "Bhosari",              "lat": 18.6445, "lng": 73.8545, "aqi": 88},
        {"name": "Katraj Satara Road",   "lat": 18.4529, "lng": 73.8619, "aqi": 65},
        {"name": "Lohgaon",              "lat": 18.5989, "lng": 73.9141, "aqi": 70},
        {"name": "MH Bhavan",            "lat": 18.5301, "lng": 73.8473, "aqi": 62},
        {"name": "Shivajinagar",         "lat": 18.5220, "lng": 73.8474, "aqi": 68},
        {"name": "Hadapsar",             "lat": 18.5013, "lng": 73.9259, "aqi": 73},
    ],
    "Kolkata": [
        {"name": "Ballygunge",           "lat": 22.5260, "lng": 88.3660, "aqi": 95},
        {"name": "Bidhannagar",          "lat": 22.5820, "lng": 88.4260, "aqi": 88},
        {"name": "Jadavpur",             "lat": 22.4956, "lng": 88.3694, "aqi": 105},
        {"name": "Rabindra Bharati",     "lat": 22.5933, "lng": 88.3668, "aqi": 98},
        {"name": "Rabindra Sarobar",     "lat": 22.5168, "lng": 88.3500, "aqi": 82},
        {"name": "Victoria",             "lat": 22.5449, "lng": 88.3425, "aqi": 78},
        {"name": "Fort William",         "lat": 22.5523, "lng": 88.3320, "aqi": 80},
    ],
    "Chennai": [
        {"name": "Alandur",              "lat": 13.0019, "lng": 80.2026, "aqi": 58},
        {"name": "Arungundram",          "lat": 12.9831, "lng": 80.1689, "aqi": 52},
        {"name": "Manali",               "lat": 13.1660, "lng": 80.2562, "aqi": 85},
        {"name": "Manali New Town",      "lat": 13.1669, "lng": 80.2640, "aqi": 88},
        {"name": "Nungambakkam",         "lat": 13.0569, "lng": 80.2425, "aqi": 55},
        {"name": "Perungudi",            "lat": 12.9668, "lng": 80.2405, "aqi": 60},
        {"name": "Velachery",            "lat": 12.9784, "lng": 80.2209, "aqi": 62},
    ],
}

# City → metro stations file slug mapping
CITY_TO_SLUG = {
    "Mumbai":    "mumbai",
    "Delhi":     "delhi",
    "Noida":     "delhi",   # shares Delhi metro network
    "Gurgaon":   "delhi",
    "Bangalore": "bangalore",
    "Hyderabad": "hyderabad",
    "Pune":      "pune",
    "Kolkata":   "kolkata",
    "Chennai":   "chennai",
}

# ── Flood risk score map ──────────────────────────────────────────────────────
FLOOD_SCORES = {"very_high": 10, "high": 40, "medium": 70, "low": 100}

def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lng2 - lng1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def load_metro_stations(city_slug: str) -> list[dict]:
    data_dir = Path(__file__).parent.parent / "public" / "data"
    path = data_dir / f"metro_stations_{city_slug}.json"
    if not path.exists():
        print(f"   ⚠ No metro file for {city_slug} — metro score will be 0")
        return []
    with open(path) as f:
        return json.load(f)


def load_mumbai_wards() -> dict:
    data_dir = Path(__file__).parent.parent / "public" / "data"
    with open(data_dir / "ward_flood_risk.geojson") as f:
        return json.load(f)


def point_in_polygon(lat, lng, coords) -> bool:
    """Ray-casting point-in-polygon. coords = [[lng, lat], ...]"""
    x, y = lng, lat
    inside = False
    n = len(coords)
    j = n - 1
    for i in range(n):
        xi, yi = coords[i][0], coords[i][1]
        xj, yj = coords[j][0], coords[j][1]
        if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def get_ward_risk(lat, lng, wards) -> str:
    """Return flood_risk string for the ward containing this point."""
    for feature in wards["features"]:
        geom = feature["geometry"]
        props = feature["properties"]
        coords_list = geom["coordinates"]
        geo_type = geom["type"]

        if geo_type == "Polygon":
            if point_in_polygon(lat, lng, coords_list[0]):
                return props.get("flood_risk", "medium")
        elif geo_type == "MultiPolygon":
            for polygon in coords_list:
                if point_in_polygon(lat, lng, polygon[0]):
                    return props.get("flood_risk", "medium")
    return "medium"  # default if no ward found


def nearest_metro(lat, lng, stations) -> tuple[float, str]:
    best_dist = float("inf")
    best_name = ""
    for s in stations:
        d = haversine(lat, lng, s["lat"], s["lng"])
        if d < best_dist:
            best_dist = d
            best_name = s["name"]
    return best_dist, best_name


def nearest_aqi(lat, lng, city_name: str) -> int:
    stations = AQI_STATIONS_BY_CITY.get(city_name, [])
    if not stations:
        # Fallback avg by city
        CITY_AVG_AQI = {"Mumbai": 82, "Delhi": 155, "Bangalore": 72, "Hyderabad": 62,
                        "Pune": 72, "Kolkata": 90, "Chennai": 62}
        return CITY_AVG_AQI.get(city_name, 85)
    best_dist = float("inf")
    best_aqi  = stations[0]["aqi"]
    for s in stations:
        d = haversine(lat, lng, s["lat"], s["lng"])
        if d < best_dist:
            best_dist = d
            best_aqi  = s["aqi"]
    return best_aqi


def compute_score(listing, metro_dist, flood_risk, aqi, price_score) -> float:
    # Flood: 10 (very high) → 100 (low)
    s_flood = FLOOD_SCORES.get(flood_risk, 70)

    # Metro: ≤300m = 100, ≥2km = 0
    s_metro = max(0, min(100, 100 - (metro_dist - 300) / 17))

    # AQI: ≤50 = 100, ≥200 = 0
    s_aqi = max(0, min(100, (200 - aqi) / 1.5))

    # Price vs locality: passed in (0-100)
    s_price = price_score

    total = (
        s_flood * W_FLOOD +
        s_metro * W_METRO +
        s_price * W_PRICE +
        s_aqi   * W_AQI
    )
    return round(total, 1)


def fetch_all_listings(key, base_url) -> list[dict]:
    req = urllib.request.Request(
        f"{base_url}/rest/v1/listings?select=id,lat,lng,price,price_unit,locality&limit=1000",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())


def patch_listing(listing_id, data, key, base_url) -> None:
    body = json.dumps(data).encode()
    req  = urllib.request.Request(
        f"{base_url}/rest/v1/listings?id=eq.{listing_id}",
        data=body,
        method="PATCH",
        headers={
            "Content-Type":  "application/json",
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Prefer":        "return=minimal",
        },
    )
    with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
        pass  # 204 No Content on success


def fetch_listings_by_city(city_name: str, key: str, base_url: str) -> list[dict]:
    req = urllib.request.Request(
        f"{base_url}/rest/v1/listings?select=id,lat,lng,price,price_unit,locality,city"
        f"&city=ilike.{city_name}&limit=2000",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
        return json.loads(r.read())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--city", help="Score only this city (e.g. Mumbai). Default: all cities.")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # Load Supabase creds
    from import_supabase import load_service_key, SUPABASE_URL
    key = load_service_key()
    if not key:
        raise SystemExit("❌ No SUPABASE_SERVICE_ROLE_KEY found")

    # Load Mumbai wards (only needed for Mumbai)
    wards = load_mumbai_wards()

    # Which cities to score
    all_cities = list(set(AQI_STATIONS_BY_CITY.keys()))
    cities_to_run = [args.city] if args.city else all_cities

    total_scored = 0

    for city_name in cities_to_run:
        city_slug = CITY_TO_SLUG.get(city_name, city_name.lower())
        print(f"\n{'='*50}")
        print(f"🏙  {city_name}")
        print(f"{'='*50}")

        # Load metro stations for this city
        metro_stations = load_metro_stations(city_slug)
        print(f"   Metro stations: {len(metro_stations)}")

        # Fetch listings for this city
        listings = fetch_listings_by_city(city_name, key, SUPABASE_URL)
        print(f"   Listings: {len(listings)}")
        if not listings:
            print("   (skipping — no listings)")
            continue

        # Locality price medians
        locality_prices: dict[str, list[int]] = defaultdict(list)
        for l in listings:
            if l.get("price") and l.get("price_unit") == "per_month":
                locality_prices[l.get("locality", "")].append(int(l["price"]))
        locality_median = {
            loc: sorted(prices)[len(prices)//2]
            for loc, prices in locality_prices.items() if prices
        }

        for i, l in enumerate(listings):
            lat = float(l.get("lat") or 0)
            lng = float(l.get("lng") or 0)

            # Metro
            if metro_stations:
                metro_dist, metro_name = nearest_metro(lat, lng, metro_stations)
            else:
                metro_dist, metro_name = 5000.0, ""

            # Flood risk — ward polygon only available for Mumbai
            if city_name == "Mumbai":
                flood_risk = get_ward_risk(lat, lng, wards)
            else:
                flood_risk = "medium"   # neutral default for non-Mumbai cities

            # AQI
            aqi = nearest_aqi(lat, lng, city_name)

            # Price vs locality median
            price = int(l.get("price") or 0)
            median = locality_median.get(l.get("locality", ""), price or 1)
            price_score = min(100, max(0, (median / (price or median)) * 70))

            score = compute_score(l, metro_dist, flood_risk, aqi, price_score)

            print(
                f"  {i+1:3}/{len(listings)} — {l.get('locality','?')[:16]:16} | "
                f"metro={int(metro_dist):4}m | aqi={aqi:3} | score={score}"
            )

            if not args.dry_run:
                patch_listing(l["id"], {
                    "livability_score":   score,
                    "flood_risk":         flood_risk,
                    "nearest_metro_m":    int(metro_dist),
                    "nearest_metro_name": metro_name,
                }, key, SUPABASE_URL)
                time.sleep(0.04)

        total_scored += len(listings)

    if args.dry_run:
        print("\nDry run — nothing written to Supabase")
    else:
        print(f"\n✅ Livability scores updated for {total_scored} listings across {len(cities_to_run)} cities")
