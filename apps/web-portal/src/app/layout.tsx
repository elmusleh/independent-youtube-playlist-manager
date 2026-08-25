import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Independent YouTube Playlist Manager — Offline-First Playlist Editor",
  description:
    "Curate, bulk-reorder, and sync 500+ video playlists with zero quota limits. Local-first speed with multi-tier scraping, IndexedDB persistence, and cross-device cloud sync.",
  keywords: [
    "YouTube playlist editor",
    "YouTube playlist helper",
    "independent youtube playlist manager",
    "offline YouTube playlists",
    "browser extension",
    "Chrome Web Store",
    "Firefox Add-on",
    "zero quota scraping",
    "playlist backup",
  ],
  authors: [{ name: "Independent YouTube Playlist Manager Team" }],
  openGraph: {
    title: "Independent YouTube Playlist Manager — Official Web Portal & Dashboard",
    description:
      "The offline-first, multi-device YouTube playlist powerhouse with zero API quota limits.",
    type: "website",
    images: [
      {
        url: "/icon.png",
        width: 800,
        height: 600,
        alt: "Independent YouTube Playlist Manager logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Independent YouTube Playlist Manager — Official Web Portal & Dashboard",
    description:
      "The offline-first, multi-device YouTube playlist powerhouse with zero API quota limits.",
    images: [{ url: "/icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light scroll-smooth">
      <Head>
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Independent YouTube Playlist Manager",
            description:
              "Curate, bulk-reorder, and sync 500+ video playlists with zero quota limits. Local-first speed with multi-tier scraping, IndexedDB persistence, and cross-device cloud sync.",
            operatingSystem: ["Windows", "macOS", "Linux", "Android"],
            applicationCategory: "BrowserExtension",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
          })}
        </script>
      </Head>
      <body
        className={`${inter.className} bg-zinc-50 text-zinc-900 min-h-screen antialiased selection:bg-red-500/10 selection:text-red-900`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
