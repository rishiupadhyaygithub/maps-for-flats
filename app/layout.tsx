import type { Metadata } from "next";
import "./globals.css";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "Maps for Flats — Search Properties on a Map",
  description:
    "Find flats & properties in Mumbai, Delhi and Bangalore on an interactive map. See metro proximity, livability scores, nearby amenities, floor plans and prices — all in one place.",
  keywords: [
    "mumbai flats", "delhi property", "bangalore rent", "property on map",
    "flat finder india", "rent flat mumbai", "buy flat delhi",
  ],
  openGraph: {
    title: "Maps for Flats — Search Properties on a Map",
    description: "Mumbai • Delhi • Bangalore — interactive map with metro overlay, livability scores and commute search.",
    type: "website",
    url: "https://maps-for-flats.vercel.app",
    siteName: "Maps for Flats",
    images: [
      {
        url: "https://maps-for-flats.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Maps for Flats — property search on a map",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maps for Flats",
    description: "Find flats in Mumbai, Delhi & Bangalore on a map. Metro overlay, livability scores, commute radius.",
    images: ["https://maps-for-flats.vercel.app/og-image.png"],
  },
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
