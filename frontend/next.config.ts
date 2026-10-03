// Frontend: Next.js settings. The defaults, plus the headers of the customer's booking page.

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The booking page's link is a key (feature 7a): never sent on to another site, never kept by a
  // browser or a shared cache, never indexed.
  async headers() {
    return [
      {
        source: "/b/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
