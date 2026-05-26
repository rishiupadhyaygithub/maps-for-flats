"""
Import mumbai_flats.csv → Supabase listings table.
Geocodes each locality using Nominatim (free, no key).

Usage:
    python import_supabase.py                      # import mumbai_flats.csv
    python import_supabase.py --input scored.csv   # import scored CSV
    python import_supabase.py --dry-run            # preview without uploading
"""

import csv
import json
import time
import hashlib
import argparse
import os
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import quote
from datetime import datetime, timezone


# ── Credentials ────────────────────────────────────────────────────────────────

SUPABASE_URL = "https://qbawghiapfzotciisbgc.supabase.co"
# Loaded from env or parent .env.local automatically below


def load_service_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if key:
        return key
    # Walk up looking for .env.local
    for parent in [Path("."), Path(".."), Path(__file__).parent.parent]:
        env_file = parent / ".env.local"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    return line.split("=", 1)[1].strip()
    return ""


# ── Geocoder ───────────────────────────────────────────────────────────────────

_geo_cache: dict[str, tuple[float, float]] = {}
CITY_CENTERS: dict[str, tuple[float, float]] = {
    "Mumbai":    (19.076,  72.8777),
    "Delhi":     (28.614,  77.2090),
    "Bangalore": (12.972,  77.5950),
    "Pune":      (18.520,  73.8570),
    "Hyderabad": (17.385,  78.4870),
    "Kolkata":   (22.573,  88.3640),
    "Chennai":   (13.083,  80.2710),
}


def geocode(locality: str, city: str = "Mumbai") -> tuple[float, float]:
    cache_key = f"{locality}::{city}"
    if cache_key in _geo_cache:
        return _geo_cache[cache_key]
    q = quote(f"{locality}, {city}, India")
    url = f"https://nominatim.openstreetmap.org/search?q={q}&format=json&limit=1"
    fallback = CITY_CENTERS.get(city, (19.076, 72.8777))
    try:
        req = Request(url, headers={"User-Agent": "maps-for-flats-importer/1.0"})
        with urlopen(req, timeout=8) as r:
            data = json.loads(r.read())
        if data:
            lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
            _geo_cache[cache_key] = (lat, lng)
            time.sleep(1.1)  # Nominatim rate limit: 1 req/sec
            return lat, lng
    except Exception as e:
        print(f"    ⚠ Geocode failed for '{locality}': {e}")
    _geo_cache[cache_key] = fallback
    return fallback


# ── Row builder ────────────────────────────────────────────────────────────────

def build_listing(row: dict) -> dict:
    locality = (
        row.get("locality") or row.get("scraped_locality") or "Mumbai"
    ).strip().split(",")[0]

    # Use exact coords from scraper if available; only geocode if missing
    city_name = row.get("city", "Mumbai")
    row_lat = row.get("lat")
    row_lng = row.get("lng")
    location_exact = str(row.get("location_exact", "")).lower() == "true"
    if row_lat and row_lng:
        try:
            lat, lng = float(row_lat), float(row_lng)
        except (ValueError, TypeError):
            lat, lng = geocode(locality, city_name)
            location_exact = False
    else:
        lat, lng = geocode(locality, city_name)
        location_exact = False

    url = (row.get("url") or "").strip()
    price = int(row.get("price") or 0)

    # Stable source_id — hash of url+price so retries don't duplicate
    raw = f"{url}::{price}"
    source_id = (
        url.rstrip("/").split("/")[-1]
        or "py-" + hashlib.md5(raw.encode()).hexdigest()[:12]
    )

    bhk_raw = row.get("bhk")
    area_raw = row.get("area_sqft")
    floor_raw = row.get("floor")
    tf_raw = row.get("total_floors")

    return {
        "source": row.get("source", "squareyards"),
        "source_id": source_id,
        "url": url or f"https://www.squareyards.com/rent/property-for-rent-in-mumbai",
        "title": f"{bhk_raw or '?'} BHK in {locality}",
        "listing_type": "rent",
        "property_type": "flat",
        "price": price,
        "price_unit": "per_month",
        "area_sqft": int(area_raw) if area_raw else None,
        "bhk": int(bhk_raw) if bhk_raw else None,
        "furnishing": row.get("furnishing") or None,
        "floor": int(floor_raw) if floor_raw else None,
        "total_floors": int(tf_raw) if tf_raw else None,
        "locality": locality,
        "city": row.get("city", "Mumbai"),
        "lat": lat,
        "lng": lng,
        "images": [],
        "floor_plan_images": [],
        "amenities": [],
        "description": None,
        "broker_name": None,
        "location_exact": location_exact,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


# ── Supabase upsert ────────────────────────────────────────────────────────────

def upsert_batch(rows: list[dict], key: str) -> None:
    url = f"{SUPABASE_URL}/rest/v1/listings?on_conflict=source%2Csource_id"
    body = json.dumps(rows).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urlopen(req, timeout=30) as r:
            if r.status not in (200, 201):
                raise Exception(f"Supabase {r.status}: {r.read()}")
    except Exception as e:
        # Re-raise with body if it's an HTTPError
        import urllib.error as _ue
        if isinstance(e, _ue.HTTPError):
            body = e.read().decode("utf-8", errors="replace")
            raise Exception(f"Supabase HTTP {e.code}: {body}") from None
        raise


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import CSV to Supabase")
    parser.add_argument("--input",      default="mumbai_flats.csv")
    parser.add_argument("--dry-run",    action="store_true")
    parser.add_argument("--batch-size", type=int, default=20)
    args = parser.parse_args()

    service_key = load_service_key()
    if not service_key and not args.dry_run:
        print("❌ Cannot find SUPABASE_SERVICE_ROLE_KEY. Set it as env var or put .env.local in parent folder.")
        raise SystemExit(1)

    rows = list(csv.DictReader(open(args.input, encoding="utf-8")))
    needs_geocode = sum(1 for r in rows if not r.get("lat") or not r.get("lng"))
    print(f"\n📥 {len(rows)} rows in {args.input}")
    if needs_geocode:
        print(f"🌍 {needs_geocode} rows need geocoding via Nominatim (1 req/sec)…")
    else:
        print("✓ All rows have exact coords — skipping geocoding")
    print()

    listings: list[dict] = []
    for i, row in enumerate(rows):
        loc = row.get("locality") or row.get("scraped_locality") or "?"
        has_coords = bool(row.get("lat") and row.get("lng"))
        label = "coords ✓" if has_coords else "geocoding"
        print(f"  {i+1:3}/{len(rows)} — {label}: {loc}")
        listings.append(build_listing(row))

    if args.dry_run:
        print("\nDry run — first 2 built rows:")
        print(json.dumps(listings[:2], indent=2, default=str))
        print(f"\nWould upload {len(listings)} listings")
        raise SystemExit(0)

    print(f"\n⬆  Uploading {len(listings)} listings in batches of {args.batch_size}…")
    uploaded = 0
    for i in range(0, len(listings), args.batch_size):
        batch = listings[i : i + args.batch_size]
        print(f"  Batch {i//args.batch_size + 1}: {len(batch)} rows…", end=" ")
        upsert_batch(batch, service_key)
        uploaded += len(batch)
        print("✓")
        time.sleep(0.3)

    print(f"\n✅ {uploaded} listings uploaded to Supabase")
    print("   Refresh the map app to see them.")
