# Mumbai Flats — Python Pipeline

## Setup (run once)

```bash
cd "maps for flats/python"
pip install playwright anthropic
playwright install chromium
```

---

## v1 — Scrape + Filter

```bash
# Scrape (default: 8 localities, 25 listings each)
python scraper.py

# Scrape specific localities
python scraper.py --localities andheri-west bandra-west powai --limit 30

# Filter results
python filter.py --max_rent 35000 --bhk 2
python filter.py --max_rent 50000 --bhk 2 --locality andheri --min_area 700
python filter.py --max_rent 35000 --bhk 1 --furnished --sort area --top 10
```

---

## v2 — Push to Map App

```bash
# Import CSV → Supabase (shows on the Leaflet map)
python import_supabase.py

# Dry run first to verify
python import_supabase.py --dry-run
```

---

## v3 — AI Scoring

```bash
export ANTHROPIC_API_KEY=sk-ant-...

python score.py                          # score all listings
python score.py --commute "BKC"          # factor in commute
python score.py --limit 20               # score first 20 only

# Import scored listings to map (has AI score column)
python import_supabase.py --input scored_flats.csv
```

---

## v4 — Alerts

```bash
# Check for new listings matching criteria (prints to terminal)
python alert.py --max_rent 35000 --bhk 2

# With macOS desktop notification
python alert.py --max_rent 35000 --bhk 2 --notify desktop

# With Telegram (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID first)
python alert.py --max_rent 35000 --bhk 2 --notify telegram
```

### Cron — auto check every 6 hours

```bash
crontab -e
```

Add:
```
0 */6 * * * cd "/Users/rishi/Desktop/maps for flats/python" && python scraper.py && python alert.py --max_rent 35000 --bhk 2 --notify desktop
```

---

## Full pipeline (one command)

```bash
python scraper.py && \
python score.py && \
python import_supabase.py --input scored_flats.csv && \
python alert.py --max_rent 35000 --bhk 2 --notify desktop
```
