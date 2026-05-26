import { BaseScraper } from "./base";
import type { Listing } from "@/lib/types";

// Scrapes Housing.com Mumbai listings
// URL: https://housing.com/in/buy/mumbai/mumbai
export class HousingScraper extends BaseScraper {
  source = "housing" as const;

  private readonly URLS = [
    "https://housing.com/in/rent/flats-apartments-in-mumbai/mumbai",
    "https://housing.com/in/rent/flats-apartments-in-mumbai/mumbai?page=2",
    "https://housing.com/in/buy/flats-apartments-in-mumbai/mumbai",
    "https://housing.com/in/buy/flats-apartments-in-mumbai/mumbai?page=2",
  ];

  async scrape(): Promise<Omit<Listing, "id" | "created_at">[]> {
    const allListings: Omit<Listing, "id" | "created_at">[] = [];

    for (const url of this.URLS) {
      try {
        const listings = await this.scrapePage(url);
        allListings.push(...listings);
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[housing] Failed page ${url}:`, err);
      }
    }

    return allListings;
  }

  private async scrapePage(url: string): Promise<Omit<Listing, "id" | "created_at">[]> {
    const page = await this.newPage();
    const listingType = url.includes("/rent/") ? "rent" : "buy";

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);

      // Housing.com uses next.js — wait for hydration
      await page.waitForSelector('[data-testid="listing-card"], .css-k7pxod', {
        timeout: 10_000,
      }).catch(() => null);

      const cards = await page.$$eval(
        '[data-testid="listing-card"], [class*="listing-card"], [class*="ListingCard"]',
        (els) =>
          els.map((el) => {
            const getText = (sel: string) =>
              el.querySelector(sel)?.textContent?.trim() ?? "";
            const getAttr = (sel: string, attr: string) =>
              (el.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? "";

            return {
              title: getText('[data-testid="listing-card-title"], [class*="title"]'),
              price: getText('[data-testid="listing-price"], [class*="price"]'),
              locality: getText('[data-testid="listing-card-locality"], [class*="locality"]'),
              area: getText('[class*="area"], [class*="carpet"]'),
              furnishing: getText('[class*="furnish"]'),
              url: getAttr("a[href]", "href"),
              imageUrl:
                getAttr('[class*="carousel"] img', "src") ||
                getAttr("img[src*='housing']", "src"),
              sourceId: (el as HTMLElement).dataset?.listingId ?? "",
              floorPlanUrl: getAttr('[class*="floor-plan"] img', "src"),
              brokerName: getText('[class*="broker"], [class*="agent"]'),
            };
          })
      );

      const results: Omit<Listing, "id" | "created_at">[] = [];

      for (const card of cards) {
        if (!card.price || !card.locality) continue;

        const { price, unit } = this.parsePrice(card.price);
        const bhk = this.parseBHK(card.title);
        const areaMatch = card.area.match(/(\d[\d,]*)/);
        const areaSqft = areaMatch ? parseInt(areaMatch[1].replace(/,/g, "")) : null;
        const localityClean = card.locality.split(",")[0].trim();

        const { lat, lng, location_exact } = await this.geocode(localityClean);

        const furnishing = card.furnishing.toLowerCase().includes("furnished")
          ? card.furnishing.toLowerCase().includes("semi")
            ? "semi-furnished"
            : "furnished"
          : card.furnishing.toLowerCase().includes("unfurnished")
          ? "unfurnished"
          : null;

        const cardUrl = card.url.startsWith("http")
          ? card.url
          : `https://housing.com${card.url}`;

        const sourceId =
          card.sourceId ||
          cardUrl.split("/").pop()?.split("?")[0] ||
          this.stableId(cardUrl, price);

        results.push({
          source: "housing",
          source_id: sourceId,
          url: cardUrl,
          title: card.title || `${bhk ?? "?"} BHK in ${localityClean}`,
          listing_type: listingType,
          property_type: "flat",
          price,
          price_unit: unit,
          area_sqft: areaSqft,
          bhk,
          furnishing,
          floor: null,
          total_floors: null,
          locality: localityClean,
          city: "Mumbai",
          lat,
          lng,
          images: card.imageUrl ? [card.imageUrl] : [],
          floor_plan_images: card.floorPlanUrl ? [card.floorPlanUrl] : [],
          amenities: [],
          description: null,
          broker_name: card.brokerName || null,
          location_exact,
          scraped_at: new Date().toISOString(),
        });
      }

      return results;
    } finally {
      await page.close();
    }
  }
}
