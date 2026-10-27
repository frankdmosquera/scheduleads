// Who may call the public booking routes from a browser: the dashboard, the sites in
// WIDGET_ORIGINS (the laptop's dev sites), and, for one business's own routes, that business's
// own Website (feature 25b), so a new client's site books with no Railway change. They read
// services and times, and send a booking. Never credentials, and never merged with
// dashboardCorsMiddleware: the login cookie would let a client site act as the owner.

import { cors } from "hono/cors";

import { appOrigin } from "../../lib/auth/auth-server.js";
import { websiteDomainForSlug } from "../../lib/booking/website-domain-for-slug.js";
import { safeErrorReason } from "../../lib/errors/safe-error-reason.js";

// Comma separated in .env, e.g. "http://localhost:3000,http://localhost:3402".
const widgetOrigins = (process.env.WIDGET_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, "")) // a browser's Origin never ends in /
  .filter(Boolean);
const fixedOrigins = [...widgetOrigins, appOrigin];

// The business named in the path, as in /public/<slug>/booking-links. Not the customer's own
// booking page (/public/bookings/<token>), which only the dashboard serves.
function businessSlugOf(path: string): string | null {
  const slug = path.match(/^\/public\/([^/]+)\//)?.[1] ?? null;
  return slug === "bookings" ? null : slug;
}

export const publicCorsMiddleware = cors({
  // Any other site gets no Allow-Origin, so its browser blocks the read.
  origin: async (origin, c) => {
    if (fixedOrigins.includes(origin)) return origin;
    const slug = businessSlugOf(c.req.path);
    if (!slug) return null;
    try {
      const domain = await websiteDomainForSlug(slug);
      if (!domain) return null;
      return origin === `https://${domain}` || origin === `https://www.${domain}` ? origin : null;
    } catch (error) {
      console.warn(`[cors] a business's website could not be read: ${safeErrorReason(error)}`);
      return null;
    }
  },
  allowMethods: ["GET", "POST"],
  credentials: false,
});
