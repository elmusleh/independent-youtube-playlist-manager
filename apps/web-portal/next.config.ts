import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        // Vercel serves files from `public/` with `cache-control: max-age=0,
        // must-revalidate`, so every visit pays a blocking round-trip before the logo
        // can paint. Keep them fresh for an hour, then revalidate in the background:
        // image updates still propagate, but repeat visits never wait.
        source: "/:file(logo.webp|og-image.png|icon.png|chrome.svg|edge.svg|firefox.svg)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
