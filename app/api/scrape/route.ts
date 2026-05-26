import { NextRequest, NextResponse } from "next/server";

// This route triggers the scrapers.
// Called by a cron job or manually with the secret header.
// Scrapers run as a child process to avoid Next.js serverless timeout limits.

const VALID_SOURCES = ["magicbricks", "99acres", "housing", "nobroker", "all"] as const;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-scraper-secret");
  if (!process.env.SCRAPER_SECRET || secret !== process.env.SCRAPER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const source: string = body.source ?? "all";

  if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
    return NextResponse.json({ error: `Invalid source: ${source}` }, { status: 400 });
  }

  // Return immediately — scraping is async and will run in background
  // In production, use a proper job queue (e.g. Inngest, Trigger.dev, Vercel Cron)
  scrapeInBackground(source).catch((e) =>
    console.error("[scrape background]", e)
  );

  return NextResponse.json({
    message: `Scraping started for: ${source}`,
    started_at: new Date().toISOString(),
  });
}

async function scrapeInBackground(source: string) {
  // Dynamic import keeps Playwright out of the initial bundle
  const { runScraper } = await import("@/scrapers");
  await runScraper(source);
}
