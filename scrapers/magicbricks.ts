import { BaseScraper } from "./base";
import type { Listing } from "@/lib/types";

// Scrapes MagicBricks Mumbai listings (rent + buy)
// URL pattern: https://www.magicbricks.com/property-for-rent/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment,Penthouse&cityName=Mumbai
export class MagicBricksScraper extends BaseScraper {
  source = "magicbricks" as const;

  private readonly URLS = [
    // Rent
    "https://www.magicbricks.com/property-for-rent/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Mumbai&pageNo=1",
    "https://www.magicbricks.com/property-for-rent/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Mumbai&pageNo=2",
    // Buy
    "https://www.magicbricks.com/property-for-sale/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Mumbai&pageNo=1",
    "https://www.magicbricks.com/property-for-sale/residential-real-estate?proptype=Multistorey-Apartment,Builder-Floor-Apartment&cityName=Mumbai&pageNo=2",
  ];

  async scrape(): Promise<Omit<Listing, "id" | "created_at">[]> {
    const allListings: Omit<Listing, "id" | "created_at">[] = [];

    for (const url of this.URLS) {
      try {
        const listings = await this.scrapePage(url);
        allListings.push(...listings);
        // Polite delay between pages
        await new Promise((r) => setTimeout(r, 2000));
      } catch (err) {
        console.error(`[magicbricks] Failed page ${url}:`, err);
      }
    }

    return allListings;
  }

  private async scrapePage(url: string): Promise<Omit<Listing, "id" | "created_at">[]> {
    const page = await this.newPage();
    const listingType = url.includes("for-rent") ? "rent" : "buy";

    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForTimeout(3000);

      const cards = await page.$$eval(
        '[data-qa="srp-listing-card"], .mb-srp__list__type__item',
        (els) =>
          els.map((el) => {
            const getText = (sel: string) =>
              el.querySelector(sel)?.textContent?.trim() ?? "";
            const getAttr = (sel: string, attr: string) =>
              (el.querySelector(sel) as HTMLElement)?.getAttribute(attr) ?? "";

            return {
              title: getText('[data-qa="heading"], .mb-srp__list__type__header__wrap--title'),
              price: getText('[data-qa="price"], .mb-srp__card--price'),
              locality: getText('[data-qa="location"], .mb-srp__card--address'),
              area: getText('[data-qa="sqft"], .mb-srp__card--area'),
              url:
                getAttr("a[href]", "href") ||
                getAttr('[data-qa="card-link"]', "href"),
              imageUrl: getAttr("img", "src") || getAttr("img", "data-src"),
              sourceId:
                (el as HTMLElement).dataset?.listingId ??
                (el as HTMLElement).dataset?.id ??
                "",
              amenitiesText: getText(".mb-srp__card__amenities"),
              brokerName: getText('[data-qa="agent-name"]'),
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

        const cardUrl = card.url.startsWith("http")
          ? card.url
          : `https://www.magicbricks.com${card.url}`;

        const sourceId =
          card.sourceId ||
          cardUrl.split("/").pop()?.split("?")[0] ||
          this.stableId(cardUrl, price);

        results.push({
          source: "magicbricks",
          source_id: sourceId,
          url: cardUrl,
          title: card.title || `${bhk ?? "?"} BHK in ${localityClean}`,
          listing_type: listingType,
          property_type: "flat",
          price,
          price_unit: unit,
          area_sqft: areaSqft,
          bhk,
          furnishing: null,
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
