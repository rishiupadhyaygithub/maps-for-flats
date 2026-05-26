import type { Browser, BrowserContext, Page } from "playwright";
import type { Listing, Source } from "@/lib/types";
import { upsertListings, getServiceClient } from "@/lib/supabase";

export abstract class BaseScraper {
  abstract source: Source;
  abstract scrape(): Promise<Omit<Listing, "id" | "created_at">[]>;

  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;

  async launch() {
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.context = await this.browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
      locale: "en-IN",
    });
  }

  async newPage(): Promise<Page> {
    if (!this.context) throw new Error("Browser not launched");
    const page = await this.context.newPage();
    // Block images/fonts to speed up scraping
    await page.route("**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}", (route) =>
      route.abort()
    );
    return page;
  }

  async close() {
    await this.browser?.close();
    this.browser = null;
    this.context = null;
  }

  async run(): Promise<{ count: number; errors: number }> {
    const client = getServiceClient();
    let logId: string | null = null;

    // Create scrape log entry
    const { data: log } = await client
      .from("scrape_log")
      .insert({ source: this.source, status: "running" })
      .select("id")
      .single();
    logId = log?.id ?? null;

    let count = 0;
    let errors = 0;

    try {
      await this.launch();
      const listings = await this.scrape();
      count = listings.length;

      if (listings.length === 0) {
        console.warn(`[${this.source}] ⚠️  0 listings scraped — site may be blocking headless requests`);
      } else {
        await upsertListings(listings);
      }
    } catch (err) {
      errors++;
      console.error(`[${this.source}] Scraper error:`, err);

      if (logId) {
        await client
          .from("scrape_log")
          .update({ status: "failed", finished_at: new Date().toISOString(), errors })
          .eq("id", logId);
      }
      throw err;
    } finally {
      await this.close();
    }

    if (logId) {
      await client
        .from("scrape_log")
        .update({ status: "done", finished_at: new Date().toISOString(), count, errors })
        .eq("id", logId);
    }

    console.log(`[${this.source}] Done — ${count} listings upserted`);
    return { count, errors };
  }

  // Utility: parse Indian price strings like "₹45 L", "1.2 Cr", "25,000/mo"
  protected parsePrice(raw: string): { price: number; unit: "total" | "per_month" } {
    const s = raw.replace(/,/g, "").toLowerCase().trim();
    const isMonthly = s.includes("/mo") || s.includes("month") || s.includes("pcm");
    const num = parseFloat(s.replace(/[^\d.]/g, ""));

    let price = num;
    if (s.includes("cr")) price = num * 10_000_000;
    else if (s.includes("l") && !s.includes("lakh")) price = num * 100_000;
    else if (s.includes("lakh")) price = num * 100_000;

    return { price: Math.round(price), unit: isMonthly ? "per_month" : "total" };
  }

  // Utility: stable fallback source_id from url + price (avoids duplicate inserts on retry)
  protected stableId(url: string, price: number): string {
    const key = `${url}::${price}`;
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (Math.imul(31, hash) + key.charCodeAt(i)) | 0;
    }
    return `fallback-${Math.abs(hash).toString(36)}`;
  }

  // Utility: parse BHK from strings like "2 BHK", "3BHK Flat"
  protected parseBHK(raw: string): number | null {
    const m = raw.match(/(\d+)\s*bhk/i);
    return m ? parseInt(m[1]) : null;
  }

  // Utility: geocode locality string using Nominatim — always approximate (area-level)
  // Returns location_exact: false because we're geocoding locality, not the building
  protected async geocode(
    address: string,
    fallbackLat = 19.076,
    fallbackLng = 72.8777
  ): Promise<{ lat: number; lng: number; location_exact: false }> {
    try {
      const q = encodeURIComponent(`${address}, Mumbai, India`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
        { headers: { "User-Agent": "maps-for-flats/1.0" } }
      );
      const data = await res.json();
      if (data?.[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), location_exact: false };
      }
    } catch {
      // Geocoding failure is non-fatal
    }
    return { lat: fallbackLat, lng: fallbackLng, location_exact: false };
  }
}
