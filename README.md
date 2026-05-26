# Maps for Flats 🗺️

> Find your next home on a map — Mumbai · Delhi · Bangalore

An interactive property search tool that puts real listings on a map with civic intelligence layers no mainstream portal offers.

**Live:** [maps-for-flats.vercel.app](https://maps-for-flats.vercel.app)

---

## What makes it different

| Feature | 99acres / MagicBricks | Maps for Flats |
|---|---|---|
| Interactive map | Basic pin drop | Leaflet with colored price markers |
| Metro proximity | Text label | Live overlay with all lines + stations |
| Livability score | ❌ | ✅ Composite 0–100 (metro + AQI + price) |
| Commute radius search | ❌ | ✅ Drop office pin → filter by distance |
| Amenity toggle | ❌ | ✅ Hospitals, schools, parks, gyms, etc. |
| Floor plans on map | ❌ | ✅ |
| Share a listing | ❌ | ✅ Copy link → opens panel directly |
| Mobile UX | App required | Bottom drawer, works in browser |

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Map | Leaflet.js (OpenStreetMap tiles) |
| Database | Supabase (PostgreSQL) |
| Scraping | Python — Square Yards schema.org parser |
| Geocoding | Nominatim (OpenStreetMap) |
| Civic data | Overpass API (metro), BMC/NDMA (flood risk) |
| Deployment | Vercel (auto-deploy on push) |

---

## Features

- **City picker** — Mumbai, Delhi/NCR, Bangalore (with real data)
- **Price markers** — color-coded by rent tier (green / orange / purple)
- **Metro overlay** — all lines + stations from OpenStreetMap, toggle on/off
- **Livability score** — weighted composite: metro proximity 30%, flood risk 30%, price vs locality 25%, AQI 15%
- **Office commute search** — geocode any address → radius circle → filters listings in range
- **Amenity toggle** — find nearby metro, hospitals, schools, supermarkets, parks, gyms, etc.
- **Shortlist** — heart any listing → saved to localStorage → `/saved` page
- **Share listing** — copy URL with `?listing=id` → opens panel on load
- **Floor plan tab** — renders floor plan images when available
- **Street View tab** — embeds Google Maps street view for exact coords

---

## Running locally

```bash
npm install
cp .env.local.example .env.local   # add your Supabase keys
npm run dev
```

### Scraping new data

```bash
cd python
pip install -r requirements.txt

# Scrape a city
python3 scraper.py --city mumbai --pages 12
python3 import_supabase.py --input mumbai_flats.csv

# Score livability
python3 score_livability.py --city Mumbai

# Fetch metro data
python3 fetch_metro.py --city mumbai
```

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## Architecture

```
public/data/
  metro_lines_{city}.geojson    ← metro route polylines (Overpass API)
  metro_stations_{city}.json    ← station lat/lng (Overpass API)
  ward_flood_risk.geojson       ← Mumbai BMC ward boundaries + flood risk

python/
  scraper.py                    ← Square Yards HTML parser (schema.org JSON-LD)
  import_supabase.py            ← CSV → Supabase upsert + Nominatim geocoding
  fetch_metro.py                ← Overpass API → GeoJSON for all cities
  fetch_wards.py                ← BMC ward GeoJSON + flood risk annotation
  score_livability.py           ← Composite livability score for all listings

app/api/
  listings/                     ← Supabase query with city + filter params
  amenities/                    ← Overpass API proxy for nearby POIs
  geocode/                      ← Nominatim proxy (CORS bypass for office search)
```

---

Built by [Rishi Upadhyay](https://github.com/rishiupadhyaygithub)
