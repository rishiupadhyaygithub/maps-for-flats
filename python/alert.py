"""
Alert when new listings match your criteria.
Remembers seen listings in seen_listings.json so it only alerts on genuinely new ones.

Usage:
    python alert.py --max_rent 35000 --bhk 2
    python alert.py --max_rent 35000 --bhk 2 --notify desktop
    python alert.py --max_rent 35000 --bhk 2 --notify telegram

Cron (every 6h) — add to crontab with: crontab -e
    0 */6 * * * cd /Users/rishi/Desktop/maps\ for\ flats/python && python scraper.py && python alert.py --max_rent 35000 --bhk 2 --notify desktop

One-liner (scrape + alert):
    python scraper.py && python alert.py --max_rent 35000 --bhk 2
"""

import csv
import json
import os
import argparse
import subprocess
from pathlib import Path
from datetime import datetime


STATE_FILE = "seen_listings.json"


# ── State ──────────────────────────────────────────────────────────────────────

def load_seen() -> set[str]:
    if not Path(STATE_FILE).exists():
        return set()
    with open(STATE_FILE) as f:
        return set(json.load(f))


def save_seen(seen: set[str]) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump(sorted(seen), f, indent=2)


def listing_id(row: dict) -> str:
    url = (row.get("url") or "").strip()
    if url:
        return url
    return f"{row.get('scraped_locality','')}-{row.get('bhk','')}-{row.get('price','')}"


# ── Filter ─────────────────────────────────────────────────────────────────────

def safe_int(v) -> int:
    try:
        return int(v or 0)
    except Exception:
        return 0


def matches(row: dict, args) -> bool:
    price = safe_int(row.get("price"))
    bhk   = safe_int(row.get("bhk"))
    area  = safe_int(row.get("area_sqft"))
    loc   = (row.get("locality") or row.get("scraped_locality") or "").lower()
    furn  = (row.get("furnishing") or "").lower()

    if args.max_rent and price > args.max_rent:
        return False
    if args.min_rent and price < args.min_rent:
        return False
    if args.bhk and bhk != args.bhk:
        return False
    if args.locality and args.locality.lower() not in loc:
        return False
    if args.min_area and (not area or area < args.min_area):
        return False
    if args.furnished and "furnished" not in furn:
        return False
    return True


# ── Formatters ─────────────────────────────────────────────────────────────────

def fmt_listing(row: dict) -> str:
    bhk   = row.get("bhk") or "?"
    price = safe_int(row.get("price"))
    loc   = row.get("locality") or row.get("scraped_locality") or "?"
    area  = row.get("area_sqft") or "?"
    floor = row.get("floor")
    tf    = row.get("total_floors")
    furn  = row.get("furnishing") or ""
    url   = row.get("url") or ""

    price_str  = f"₹{price:,}/mo"
    floor_str  = f"Floor {floor}/{tf}" if floor and tf else (f"Floor {floor}" if floor else "")
    detail_str = " | ".join(x for x in [f"{area} sqft", floor_str, furn] if x)

    line1 = f"🏠 {bhk}BHK in {loc} — {price_str}"
    line2 = f"   {detail_str}" if detail_str else ""
    line3 = f"   {url}" if url else ""
    return "\n".join(x for x in [line1, line2, line3] if x)


# ── Notifiers ──────────────────────────────────────────────────────────────────

def notify_desktop(title: str, body: str) -> None:
    """macOS only"""
    try:
        script = f'display notification "{body}" with title "{title}" sound name "Ping"'
        subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
        print("  📱 Desktop notification sent")
    except Exception as e:
        print(f"  Desktop notification failed: {e}")


def notify_telegram(title: str, body: str) -> None:
    """
    Set env vars:
        TELEGRAM_BOT_TOKEN=<token from @BotFather>
        TELEGRAM_CHAT_ID=<your chat ID>
    """
    token   = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        print("  ⚠ Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID for Telegram alerts")
        return
    import urllib.request, urllib.parse
    msg  = f"*{title}*\n\n{body}"
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": msg, "parse_mode": "Markdown"}).encode()
    req  = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
    with urllib.request.urlopen(req, timeout=10) as r:
        if r.status == 200:
            print("  📨 Telegram message sent")
        else:
            print(f"  Telegram error: {r.status}")


# ── Main ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Alert on new matching listings")
    parser.add_argument("--input",    default="mumbai_flats.csv")
    parser.add_argument("--max_rent", type=int)
    parser.add_argument("--min_rent", type=int)
    parser.add_argument("--bhk",      type=int)
    parser.add_argument("--locality")
    parser.add_argument("--min_area", type=int)
    parser.add_argument("--furnished", action="store_true")
    parser.add_argument("--notify", choices=["print", "desktop", "telegram"], default="print")
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"❌ {args.input} not found — run scraper.py first")
        raise SystemExit(1)

    rows    = list(csv.DictReader(open(args.input, encoding="utf-8")))
    seen    = load_seen()
    all_ids = set()

    new_matches: list[dict] = []
    for row in rows:
        lid = listing_id(row)
        all_ids.add(lid)
        if lid not in seen and matches(row, args):
            new_matches.append(row)

    # Mark everything seen (including non-matches, so we don't re-alert)
    save_seen(all_ids | seen)

    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n[{ts}] Alert check: {len(rows)} listings scanned, {len(new_matches)} new match(es)")

    if not new_matches:
        print("No new listings. Check back later.")
        raise SystemExit(0)

    # Sort by price
    new_matches.sort(key=lambda r: safe_int(r.get("price")))

    print(f"\n🔔 {len(new_matches)} NEW LISTING(S) MATCH YOUR CRITERIA:\n")
    for r in new_matches:
        print(fmt_listing(r))
        print()

    if args.notify in ("desktop", "telegram"):
        title = f"Maps for Flats — {len(new_matches)} new listing(s)"
        body  = "\n\n".join(fmt_listing(r) for r in new_matches[:3])
        if len(new_matches) > 3:
            body += f"\n\n…and {len(new_matches) - 3} more"

        if args.notify == "desktop":
            notify_desktop(title, body)
        elif args.notify == "telegram":
            notify_telegram(title, body)
