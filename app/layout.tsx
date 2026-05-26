import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Maps for Flats — Mumbai Property Search",
  description:
    "Find flats, houses and properties in Mumbai on a map. See nearby amenities, street view, floor plans and prices from MagicBricks, 99acres, Housing.com and NoBroker.",
  keywords: ["mumbai flats", "mumbai property", "rent mumbai", "buy flat mumbai"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full antialiased">
          <ErrorBoundary>{children}</ErrorBoundary>
        </body>
    </html>
  );
}
