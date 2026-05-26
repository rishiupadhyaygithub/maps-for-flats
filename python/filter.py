"""
Filter mumbai_flats.csv by criteria and print results.

Usage:
    python filter.py --max_rent 35000 --bhk 2
    python filter.py --max_rent 50000 --bhk 2 --locality andheri --min_area 700
    python filter.py --max_rent 35000 --bhk 1 --furnished --sort area
    python filter.py --max_rent 60000  # any BHK under budget
"""

import csv
import argparse
from pathlib import Path


def load_csv(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def safe_int(val) -> int:
    try:
        return int(val or 0)
    except (ValueError, TypeError):
        return 0


def matches(row: dict, args) -> bool:
    price  = safe_int(row.get("price"))
    bhk    = safe_int(row.get("bhk"))
    area   = safe_int(row.get("area_sqft"))
    loc    = (row.get("locality") or row.get("scraped_locality") or "").lower()
    furn   = (row.get("furnishing") or "").lower()

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


def fmt_price(p) -> str:
    try:
        n = int(p)
        if n >= 100_000:
            return f"₹{n/100_000:.1f}L/mo"
        return f"₹{n:,}/mo"
    except Exception:
        return str(p or "?")


def fmt_floor(row: dict) -> str:
    f = row.get("floor")
    t = row.get("total_floors")
    if f and t:
        return f"{f}/{t}"
    if f:
        return str(f)
    return "?"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Filter Mumbai flat listings")
    parser.add_argument("--input",    default="mumbai_flats.csv")
    parser.add_argument("--max_rent", type=int, help="Max monthly rent (₹)")
    parser.add_argument("--min_rent", type=int, help="Min monthly rent (₹)")
    parser.add_argument("--bhk",      type=int, help="BHK count (1/2/3/4)")
    parser.add_argument("--locality", help="Locality name substring (e.g. andheri)")
    parser.add_argument("--min_area", type=int, help="Min area in sqft")
    parser.add_argument("--furnished", action="store_true", help="Only furnished listings")
    parser.add_argument("--sort", choices=["price", "area", "bhk"], default="price")
    parser.add_argument("--top", type=int, help="Show only top N results")
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"❌ {args.input} not found — run scraper.py first")
        raise SystemExit(1)

    rows    = load_csv(args.input)
    matched = [r for r in rows if matches(r, args)]

    # Sort
    sort_key = {"price": "price", "area": "area_sqft", "bhk": "bhk"}[args.sort]
    matched.sort(key=lambda r: safe_int(r.get(sort_key)))

    if args.top:
        matched = matched[:args.top]

    if not matched:
        print("No listings match your filters.")
        raise SystemExit(0)

    # Header
    print()
    print(f"{'BHK':<5} {'Rent':<14} {'Area':<10} {'Floor':<7} {'Furnishing':<16} {'Locality':<26} URL")
    print("─" * 120)

    for r in matched:
        bhk      = r.get("bhk") or "?"
        price    = fmt_price(r.get("price"))
        area     = f"{r['area_sqft']} sqft" if r.get("area_sqft") else "?"
        floor_s  = fmt_floor(r)
        furn     = (r.get("furnishing") or "?")[:15]
        loc      = (r.get("locality") or r.get("scraped_locality") or "?")[:25]
        url      = r.get("url") or "—"
        print(f"{bhk!s:<5} {price:<14} {area:<10} {floor_s:<7} {furn:<16} {loc:<26} {url}")

    print()
    print(f"✅ {len(matched)} listing(s) match")

    # Quick price stats
    prices = [safe_int(r.get("price")) for r in matched if r.get("price")]
    if prices:
        print(f"   Price range : ₹{min(prices):,} – ₹{max(prices):,}/mo")
        print(f"   Avg rent    : ₹{sum(prices)//len(prices):,}/mo")
