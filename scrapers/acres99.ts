import { BaseScraper } from "./base";
import type { Listing } from "@/lib/types";

// Scrapes 99acres Mumbai listings
// URL: https://www.99acres.com/search/property/buy/mumbai?city=11&preference=S&area_unit=1&res_com=R
export class Acres99Scraper extends BaseScraper {
  source = "99acres" as const;

  private readonly URLS = [
    // Rent
    "https://www.99acres.com/search/property/rent/mumbai?city=11&preference=S&area_unit=1&res_com=R",
    "https://www.99acres.com/search/property/rent/mumbai?city=11&preference=S&area_unit=1&res_com=R&page=2",
    // Buy
    "https://www.99acres.com/search/property/buy/mumbai?city=11&preference=S&area_unit=1&res_com=R",
    "https://www.99acres.com/search/property/buy/mumbai?city=11&preference=S&area_unit=1&res_com=R&page=2",
  ];

  async scrape(): Promise<Omit<Listing, "id" | "created_at">[]> {
    const allListings: Omit<Listing, "id" | "created_at">[] = [];

    for (const url of this.URLS) {
      try {
        const listings = await this.scrapePage(url);
        allListings.push(...listings);
        await new Promise((r) => setTimeout(r, 2500));
      } catch (err) {
        console.error(`[99acres] Failed page ${url}:`, err);
      }
    }

    return allListings;
  }

  private async scrapePage(url: string): Promise<Omit<Listing, "id" | "created_at">[]> {
    const page = await this.newPage();
    const listingType = url.includes("/rent/") ? "rent" : "buy";

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3500);

      const cards = await page.$$eval(
        ".srpTuple__listingCard, [data-tracking-id]",
        (els) =>
          els.map((el) => {
            const getText = (sel: string) =>
              el.querySelector(sel)?.textContent?.trim() ?? "";
            const getAttr = (sel: string, attr: string) =>
              (el.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? "";

            return {
              title: getText(".srpTuple__header, .propType"),
              price: getText(".srpTuple__priceBox, .price"),
              locality: getText(".srpTuple__locationInfo, .localityName"),
              area: getText(".srpTuple__areaConfig, .carpetArea"),
              floor: getText(".srpTuple__floor"),
              furnishing: getText(".srpTuple__furnishType"),
              url: getAttr("a.srpTuple__link", "href") || getAttr("a[href*='property']", "href"),
              imageUrl: getAttr("img", "src") || getAttr("img", "data-src"),
              sourceId:
                (el as HTMLElement).dataset?.propId ??
                (el as HTMLElement).dataset?.trackingId ??
                "",
              amenitiesText: getText(".srpTuple__amenities"),
              brokerName: getText(".srpTuple__agentName"),
              description: getText(".srpTuple__description"),
            };
          })
      );

      const results: Omit<Listing, "id" | "created_at">[] = [];

      for (const card of cards) {
        if (!card.price || !card.locality) continue;

        const { price, unit } = this.parsePrice(card.price);
        const bhk = this.parseBHK(card.title + " " + card.area);
        const areaMatch = card.area.match(/(\d[\d,]*)\s*sq/i);
        const areaSqft = areaMatch ? parseInt(areaMatch[1].replace(/,/g, "")) : null;
        const localityClean = card.locality.split(",")[0].trim();

        const { lat, lng, location_exact } = await this.geocode(localityClean);

        const floorMatch = card.floor.match(/(\d+)\s*of\s*(\d+)/i);
        const floor = floorMatch ? parseInt(floorMatch[1]) : null;
        const totalFloors = floorMatch ? parseInt(floorMatch[2]) : null;

        const furnishing = card.furnishing.toLowerCase().includes("furnished")
          ? card.furnishing.toLowerCase().includes("semi")
            ? "semi-furnished"
            : "furnished"
          : card.furnishing.toLowerCase().includes("unfurnished")
          ? "unfurnished"
          : null;

        const cardUrl = card.url.startsWith("http")
          ? card.url
          : `https://www.99acres.com${card.url}`;

        const sourceId =
          card.sourceId || cardUrl.split("-").pop()?.split(".")[0] || this.stableId(cardUrl, price);

        results.push({
          source: "99acres",
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
          floor,
          total_floors: totalFloors,
          locality: localityClean,
          city: "Mumbai",
          lat,
          lng,
          images: card.imageUrl ? [card.imageUrl] : [],
          floor_plan_images: [],
          amenities: card.amenitiesText
            ? card.amenitiesText.split(/[,|·]/).map((a) => a.trim()).filter(Boolean)
            : [],
          description: card.description || null,
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
