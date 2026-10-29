// Booking component: the business's saved Look colours, for a site's server code (feature 25f).
// The site passes its own caching in init (Next: { next: { revalidate: 60 } }). Never throws:
// any failure answers null, so the site always draws, in its own colours.

import type { SiteThemeType } from "../site-colours/site-colour-tokens.js";
import { createBookingApiClient } from "./create-booking-api-client.js";

export async function fetchSiteColours(
  apiUrl: string,
  slug: string,
  init?: RequestInit
): Promise<SiteThemeType | null> {
  // Hono's client drops an empty segment, so a blank slug would ask another route.
  if (slug.trim() === "") return null;

  try {
    const response = await createBookingApiClient(apiUrl).public[":slug"]["booking-links"].$get(
      { param: { slug: encodeURIComponent(slug) } },
      { init }
    );
    if (response.status !== 200) return null;
    const { business } = await response.json();
    // Never trusted blindly: siteColourTokens still checks every value is a real colour.
    return business?.theme && typeof business.theme === "object" ? business.theme : null;
  } catch {
    return null;
  }
}
