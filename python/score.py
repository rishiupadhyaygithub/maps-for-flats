"""
Score listings with Claude API — value-for-money, verdict, reasoning.
Adds columns: value_score, verdict, ai_reasoning.

Usage:
    export ANTHROPIC_API_KEY=sk-ant-...
    python score.py                              # score all in mumbai_flats.csv
    python score.py --commute BKC               # factor in commute
    python score.py --limit 20                  # score first 20 only
    python score.py --input mumbai_flats.csv --output scored.csv
"""

import csv
import json
import os
import time
import argparse
from pathlib import Path

try:
    import anthropic
except ImportError:
    print("Run: pip install anthropic")
    raise

SYSTEM = """You are a Mumbai real estate expert with 10 years of local knowledge.
Score rental listings on value-for-money. Be direct and specific.
Always return valid JSON only — no prose, no markdown."""

PROMPT_TEMPLATE = """\
Score this Mumbai rental listing:

BHK       : {bhk}
Locality  : {locality}
Rent      : ₹{price}/month
Area      : {area} sqft
Floor     : {floor}
Furnishing: {furnishing}
{commute_line}

Return JSON:
{{
  "score": <integer 1-10>,
  "verdict": "<good_deal | fair | overpriced>",
  "reasoning": "<one crisp sentence explaining the score>"
}}"""


def score_listing(
    client: anthropic.Anthropic,
    row: dict,
    commute: str | None = None,
) -> dict:
    commute_line = f"Commute to: {commute}" if commute else ""
    prompt = PROMPT_TEMPLATE.format(
        bhk=row.get("bhk") or "?",
        locality=row.get("locality") or row.get("scraped_locality") or "?",
        price=row.get("price") or "?",
        area=row.get("area_sqft") or "unknown",
        floor=f"{row['floor']}/{row['total_floors']}" if row.get("floor") else "unknown",
        furnishing=row.get("furnishing") or "unknown",
        commute_line=commute_line,
    )

    try:
        msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=200,
            system=SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        # Strip markdown fences if present
        if "```" in text:
            text = text.split("```")[1].lstrip("json").strip()
        return json.loads(text)
    except json.JSONDecodeError:
        return {"score": None, "verdict": "error", "reasoning": text[:120]}
    except Exception as e:
        return {"score": None, "verdict": "error", "reasoning": str(e)[:120]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Score flats with Claude API")
    parser.add_argument("--input",    default="mumbai_flats.csv")
    parser.add_argument("--output",   default="scored_flats.csv")
    parser.add_argument("--commute",  help="Target commute area e.g. BKC, Andheri West")
    parser.add_argument("--limit",    type=int, help="Score only first N listings")
    args = parser.parse_args()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ Set ANTHROPIC_API_KEY environment variable")
        raise SystemExit(1)

    if not Path(args.input).exists():
        print(f"❌ {args.input} not found — run scraper.py first")
        raise SystemExit(1)

    client = anthropic.Anthropic(api_key=api_key)
    rows = list(csv.DictReader(open(args.input, encoding="utf-8")))

    if args.limit:
        rows = rows[:args.limit]

    print(f"\n🤖 Scoring {len(rows)} listings with Claude Haiku…")
    if args.commute:
        print(f"   Commute target: {args.commute}")
    print()

    extra_cols = ["value_score", "verdict", "ai_reasoning"]
    out_rows: list[dict] = []

    for i, row in enumerate(rows):
        loc = row.get("locality") or row.get("scraped_locality") or "?"
        bhk = row.get("bhk") or "?"
        price = row.get("price") or "?"
        print(f"  {i+1:3}/{len(rows)} — {bhk}BHK | ₹{price} | {loc}… ", end="", flush=True)

        result = score_listing(client, row, args.commute)
        row["value_score"] = result.get("score")
        row["verdict"] = result.get("verdict")
        row["ai_reasoning"] = result.get("reasoning")
        out_rows.append(row)

        score_str = f"[{result['score']}/10 {result['verdict']}]"
        print(score_str)

        # Haiku is fast but be polite
        if i < len(rows) - 1:
            time.sleep(0.25)

    # Write output
    all_keys = list(rows[0].keys())
    for col in extra_cols:
        if col not in all_keys:
            all_keys.append(col)

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=all_keys)
        writer.writeheader()
        writer.writerows(out_rows)

    # Summary
    scored = [r for r in out_rows if r.get("value_score")]
    good   = [r for r in out_rows if r.get("verdict") == "good_deal"]
    fair   = [r for r in out_rows if r.get("verdict") == "fair"]
    pricey = [r for r in out_rows if r.get("verdict") == "overpriced"]
    avg    = sum(int(r["value_score"]) for r in scored) / len(scored) if scored else 0

    print(f"\n✅ Scored {len(out_rows)} listings → {args.output}")
    print(f"   Avg score  : {avg:.1f}/10")
    print(f"   Good deals : {len(good)}")
    print(f"   Fair       : {len(fair)}")
    print(f"   Overpriced : {len(pricey)}")

    if good:
        good.sort(key=lambda r: -(int(r.get("value_score") or 0)))
        print(f"\n🏆 Top {min(5, len(good))} good deals:")
        for r in good[:5]:
            loc   = r.get("locality") or r.get("scraped_locality") or "?"
            price = r.get("price") or "?"
            bhk   = r.get("bhk") or "?"
            score = r.get("value_score")
            why   = r.get("ai_reasoning") or ""
            print(f"  [{score}/10] {bhk}BHK in {loc} ₹{price}/mo — {why}")
