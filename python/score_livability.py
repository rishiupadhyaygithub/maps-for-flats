"""
Compute Mumbai Livability Score for every listing in Supabase.
Score = weighted composite (0–100) of:
  - Flood risk        30%  (ward the listing falls in)
  - Metro proximity   30%  (distance to nearest metro station)
  - Price vs locality 25%  (value for money vs median in that locality)
  - AQI               15%  (nearest SAFAR station avg AQI)

Updates listings.livability_score, flood_risk, nearest_metro_m, nearest_metro_name.

Usage:
    python3 score_livability.py
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

# ── AQI station data (from OpenCity/CPCB — hardcoded avg PM2.5 for Mumbai) ──
# Source: CPCB annual averages 2023, converted to 0-100 score
# Lower AQI = higher score
AQI_STATIONS = [
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
]

# ── Flood risk score map ──────────────────────────────────────────────────────
FLOOD_SCORES = {"very_high": 10, "high": 40, "medium": 70, "low": 100}

def haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6_371_000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    dφ = math.radians(lat2 - lat1)
    dλ = math.radians(lng2 - lng1)
    a = math.sin(dφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(dλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def load_data():
    data_dir = Path(__file__).parent.parent / "public" / "data"
    with open(data_dir / "metro_stations.json") as f:
        metro_stations = json.load(f)
    with open(data_dir / "ward_flood_risk.geojson") as f:
        wards = json.load(f)
    return metro_stations, wards


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


def nearest_aqi(lat, lng) -> int:
    best_dist = float("inf")
    best_aqi  = 85  # Mumbai avg fallback
    for s in AQI_STATIONS:
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    # Load geo data
    print("📐 Loading metro + ward data…")
    metro_stations, wards = load_data()
    print(f"   {len(metro_stations)} metro stations | {len(wards['features'])} wards")

    # Load Supabase creds
    from import_supabase import load_service_key, SUPABASE_URL
    key = load_service_key()
    if not key:
        raise SystemExit("❌ No SUPABASE_SERVICE_ROLE_KEY found")

    # Fetch all listings
    print("📥 Fetching listings from Supabase…")
    listings = fetch_all_listings(key, SUPABASE_URL)
    print(f"   {len(listings)} listings")

    # Compute locality price medians for price_score
    locality_prices: dict[str, list[int]] = defaultdict(list)
    for l in listings:
        if l.get("price") and l.get("price_unit") == "per_month":
            locality_prices[l.get("locality", "")].append(int(l["price"]))
    locality_median = {
        loc: sorted(prices)[len(prices)//2]
        for loc, prices in locality_prices.items()
        if prices
    }

    print(f"\n🧮 Scoring {len(listings)} listings…\n")
    for i, l in enumerate(listings):
        lat = float(l.get("lat") or 19.076)
        lng = float(l.get("lng") or 72.877)

        # Metro
        metro_dist, metro_name = nearest_metro(lat, lng, metro_stations)

        # Flood risk
        flood_risk = get_ward_risk(lat, lng, wards)

        # AQI
        aqi = nearest_aqi(lat, lng)

        # Price vs locality median (higher = better value)
        price = int(l.get("price") or 0)
        median = locality_median.get(l.get("locality", ""), price or 1)
        price_score = min(100, max(0, (median / (price or median)) * 70))

        score = compute_score(l, metro_dist, flood_risk, aqi, price_score)

        print(
            f"  {i+1:3}/{len(listings)} — {l.get('locality','?')[:18]:18} | "
            f"flood={flood_risk:10} | metro={int(metro_dist):4}m | "
            f"aqi={aqi} | score={score}"
        )

        if not args.dry_run:
            patch_listing(l["id"], {
                "livability_score":   score,
                "flood_risk":         flood_risk,
                "nearest_metro_m":    int(metro_dist),
                "nearest_metro_name": metro_name,
            }, key, SUPABASE_URL)
            time.sleep(0.05)  # be kind to Supabase

    if args.dry_run:
        print("\nDry run — nothing written to Supabase")
    else:
        print(f"\n✅ Livability scores updated for {len(listings)} listings")
