// Frontend: Next.js settings. The defaults, plus the customer's booking page: its short link and
// its headers.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The link in emails and texts is /b/<bookingPageToken>, short so a text fits 160 characters;
  // the page itself lives at app/customer-booking/, named for what it is.
  async rewrites() {
    return [{ source: "/b/:bookingPageToken", destination: "/customer-booking/:bookingPageToken" }];
  },
  // The booking page's link is a key (feature 7a): never sent on to another site, never kept by a
  // browser or a shared cache, never indexed.
  async headers() {
    return [
      ...["/b/:path*", "/customer-booking/:path*"].map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
    ];
  },
};

export default nextConfig;
