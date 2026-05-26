"""
Fetch Mumbai metro stations from Overpass API → clean → upload to Supabase.
Also saves metro_stations.json and metro_lines.geojson for frontend use.

Usage:
    python3 fetch_metro.py
    python3 fetch_metro.py --dry-run
"""

import json, ssl, urllib.request, urllib.parse, argparse, os
from pathlib import Path

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# ── Known metro line metadata ─────────────────────────────────────────────────
LINE_META = {
    "1":  {"name": "Line 1 — Versova–Andheri–Ghatkopar", "color": "#0057A8", "status": "open",             "open_year": 2014},
    "2A": {"name": "Line 2A — Dahisar–D N Nagar",         "color": "#F7C300", "status": "open",             "open_year": 2022},
    "2B": {"name": "Line 2B — D N Nagar–Mandale",         "color": "#F7C300", "status": "partial",          "open_year": 2024},
    "3":  {"name": "Line 3 Aqua — Aarey–Cuffe Parade",    "color": "#00AEEF", "status": "open",             "open_year": 2024},
    "7":  {"name": "Line 7 — Andheri E–Dahisar E",        "color": "#E4002B", "status": "open",             "open_year": 2022},
    "9":  {"name": "Line 9 — Kashigaon–Dahisar E",        "color": "#E4002B", "status": "planned",          "open_year": 2027},
    "N1": {"name": "Navi Mumbai Metro Line 1",             "color": "#77248B", "status": "under_construction","open_year": 2025},
}

def fetch_overpass() -> dict:
    query = """[out:json][timeout:60];
(
  relation["route"="subway"]["network"~"Mumbai"](18.8,72.7,19.4,73.1);
  node["station"="subway"]["network"~"Mumbai"](18.8,72.7,19.4,73.1);
  node["railway"="station"]["network"~"Mumbai Metro"](18.8,72.7,19.4,73.1);
);
out geom;"""
    data = urllib.parse.urlencode({"data": query}).encode()
    req  = urllib.request.Request(
        "https://overpass-api.de/api/interpreter",
        data=data,
        headers={"User-Agent": "maps-for-flats/1.0", "Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=70, context=ctx) as r:
        return json.loads(r.read())


def build_stations(raw: dict) -> list[dict]:
    """Deduplicate stations by name, pick best lat/lng."""
    seen: dict[str, dict] = {}
    for e in raw.get("elements", []):
        if e["type"] != "node":
            continue
        t = e.get("tags", {})
        name = t.get("name") or t.get("name:en", "")
        if not name:
            continue
        key = name.strip().lower()
        if key not in seen:
            # Guess which line(s) serve this station from network/line tags
            lines = t.get("line", t.get("lines", "")).split(";")
            seen[key] = {
                "name":      name.strip(),
                "lat":       e["lat"],
                "lng":       e["lon"],
                "lines":     [l.strip() for l in lines if l.strip()],
                "is_interchange": len(lines) > 1,
            }
    return list(seen.values())


def build_geojson_lines(raw: dict) -> dict:
    """Build a FeatureCollection of metro route polylines."""
    features = []
    seen_refs: set = set()

    for e in raw.get("elements", []):
        if e["type"] != "relation":
            continue
        t   = e.get("tags", {})
        ref = t.get("ref", "?")

        # Deduplicate — keep one direction per line ref
        if ref in seen_refs:
            continue
        seen_refs.add(ref)

        meta = LINE_META.get(ref, {})

        # Collect way geometry from members
        coords: list[list[float]] = []
        for member in e.get("members", []):
            if member.get("type") == "way" and "geometry" in member:
                for pt in member["geometry"]:
                    coords.append([pt["lon"], pt["lat"]])

        if not coords:
            continue

        features.append({
            "type": "Feature",
            "properties": {
                "ref":        ref,
                "name":       meta.get("name", t.get("name", f"Line {ref}")),
                "color":      meta.get("color", t.get("colour", "#6366f1")),
                "status":     meta.get("status", "unknown"),
                "open_year":  meta.get("open_year"),
            },
            "geometry": {
                "type":        "LineString",
                "coordinates": coords,
            },
        })

    return {"type": "FeatureCollection", "features": features}


def upsert_supabase(stations: list[dict]) -> None:
    from import_supabase import load_service_key, SUPABASE_URL
    key = load_service_key()
    if not key:
        print("⚠ No Supabase key — skipping upload")
        return

    # Ensure table exists (create via migration if needed)
    rows = [
        {
            "name":           s["name"],
            "lat":            s["lat"],
            "lng":            s["lng"],
            "lines":          s["lines"],
            "is_interchange": s["is_interchange"],
        }
        for s in stations
    ]

    body = json.dumps(rows).encode()
    req  = urllib.request.Request(
        f"{SUPABASE_URL}/rest/v1/metro_stations?on_conflict=name",
        data=body,
        method="POST",
        headers={
            "Content-Type":  "application/json",
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Prefer":        "resolution=merge-duplicates,return=minimal",
        },
    )
    import urllib.error
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as r:
            print(f"✅ Uploaded {len(rows)} stations → Supabase (status {r.status})")
    except urllib.error.HTTPError as e:
        print(f"❌ Supabase error {e.code}: {e.read().decode()[:300]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    print("🚇 Fetching Mumbai metro data from Overpass…")
    raw      = fetch_overpass()
    stations = build_stations(raw)
    geojson  = build_geojson_lines(raw)

    print(f"   {len(stations)} stations | {len(geojson['features'])} route lines")

    # Always save local files (used by API routes directly)
    out_dir = Path(__file__).parent.parent / "public" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    with open(out_dir / "metro_lines.geojson", "w") as f:
        json.dump(geojson, f)
    with open(out_dir / "metro_stations.json", "w") as f:
        json.dump(stations, f)

    print(f"   Saved → public/data/metro_lines.geojson + metro_stations.json")

    for s in stations[:5]:
        print(f"   {s['name']} ({s['lat']:.4f}, {s['lng']:.4f})")

    if not args.dry_run:
        upsert_supabase(stations)
    else:
        print("Dry run — skipped Supabase upload")
