import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.magicbricks.com" },
      { protocol: "https", hostname: "**.99acres.com" },
      { protocol: "https", hostname: "**.housing.com" },
      { protocol: "https", hostname: "**.nobroker.in" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.imgix.net" },
    ],
  },
  // Playwright runs in scrapers (Node.js only), not in Next.js edge runtime
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
