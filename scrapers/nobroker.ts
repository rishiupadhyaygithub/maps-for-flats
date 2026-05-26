import { BaseScraper } from "./base";
import type { Listing } from "@/lib/types";

// Scrapes NoBroker Mumbai listings (direct owner, no brokerage)
// NoBroker is JS-heavy — we wait for the listings to render
export class NoBrokerScraper extends BaseScraper {
  source = "nobroker" as const;

  private readonly URLS = [
    "https://www.nobroker.in/property/rent/mumbai/Mumbai?radius=20&latitude=19.0760&longitude=72.8777&ignoreNB=true",
    "https://www.nobroker.in/property/buy/mumbai/Mumbai?radius=20&latitude=19.0760&longitude=72.8777&ignoreNB=true",
  ];

  async scrape(): Promise<Omit<Listing, "id" | "created_at">[]> {
    const allListings: Omit<Listing, "id" | "created_at">[] = [];

    for (const url of this.URLS) {
      try {
        const listings = await this.scrapePage(url);
        allListings.push(...listings);
        await new Promise((r) => setTimeout(r, 3000));
      } catch (err) {
        console.error(`[nobroker] Failed page ${url}:`, err);
      }
    }

    return allListings;
  }

  private async scrapePage(url: string): Promise<Omit<Listing, "id" | "created_at">[]> {
    const page = await this.newPage();
    const listingType = url.includes("/rent/") ? "rent" : "buy";

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

      // NoBroker uses React — need to wait for hydration
      await page.waitForSelector(".list-card-container, .card-body, [class*=\"propertyCard\"]", {
        timeout: 15_000,
      }).catch(() => null);
      await page.waitForTimeout(2000);

      // Scroll to load more
      await page.evaluate(() => window.scrollBy(0, 2000));
      await page.waitForTimeout(1500);

      const cards = await page.$$eval(
        ".list-card-container, .card-body, [class*='propertyCard'], .property-card",
        (els) =>
          els.map((el) => {
            const getText = (sel: string) =>
              el.querySelector(sel)?.textContent?.trim() ?? "";
            const getAttr = (sel: string, attr: string) =>
              (el.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? "";

            return {
              title: getText(".property-title, [class*='title'], .heading"),
              price: getText(".price-info, [class*='price'], .amount"),
              locality: getText(".address, [class*='locality'], .location"),
              area: getText(".area, [class*='sqft'], [class*='area']"),
              bhkRaw: getText(".bhk, [class*='bhk'], .config"),
              furnishing: getText("[class*='furnish']"),
              url: getAttr("a[href*='property']", "href") || getAttr("a[href]", "href"),
              imageUrl:
                getAttr("img[src*='nobroker']", "src") ||
                getAttr("img", "src"),
              sourceId:
                (el as HTMLElement).dataset?.id ??
                (el as HTMLElement).dataset?.propertyId ??
                "",
              amenitiesText: getText("[class*='amenities'], .amenity-list"),
            };
          })
      );

      const results: Omit<Listing, "id" | "created_at">[] = [];

      for (const card of cards) {
        if (!card.price) continue;

        const { price, unit } = this.parsePrice(card.price);
        const bhk =
          this.parseBHK(card.bhkRaw) ??
          this.parseBHK(card.title) ??
          this.parseBHK(card.area);
        const areaMatch = card.area.match(/(\d[\d,]*)\s*sq/i);
        const areaSqft = areaMatch ? parseInt(areaMatch[1].replace(/,/g, "")) : null;
        const localityClean = (card.locality || "Mumbai").split(",")[0].trim();

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
          : `https://www.nobroker.in${card.url}`;

        const sourceId =
          card.sourceId ||
          cardUrl.split("/").pop()?.split("?")[0] ||
          this.stableId(cardUrl, price);

        results.push({
          source: "nobroker",
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
          floor_plan_images: [],
          amenities: card.amenitiesText
            ? card.amenitiesText.split(/[,|·]/).map((a) => a.trim()).filter(Boolean)
            : [],
          description: null,
          broker_name: "Owner",
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
