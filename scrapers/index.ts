import { MagicBricksScraper } from "./magicbricks";
import { Acres99Scraper } from "./acres99";
import { HousingScraper } from "./housing";
import { NoBrokerScraper } from "./nobroker";

export async function runScraper(source: string) {
  const scrapers =
    source === "all"
      ? [
          new MagicBricksScraper(),
          new Acres99Scraper(),
          new HousingScraper(),
          new NoBrokerScraper(),
        ]
      : source === "magicbricks"
      ? [new MagicBricksScraper()]
      : source === "99acres"
      ? [new Acres99Scraper()]
      : source === "housing"
      ? [new HousingScraper()]
      : source === "nobroker"
      ? [new NoBrokerScraper()]
      : [];

  if (!scrapers.length) throw new Error(`Unknown source: ${source}`);

  const results = [];
  for (const scraper of scrapers) {
    try {
      const result = await scraper.run();
      results.push({ source: scraper.source, ...result });
    } catch (err) {
      console.error(`Scraper ${scraper.source} failed:`, err);
      results.push({ source: scraper.source, count: 0, errors: 1 });
    }
  }

  return results;
}
