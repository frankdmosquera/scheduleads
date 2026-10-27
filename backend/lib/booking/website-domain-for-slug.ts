// Backend: the domain of a business's own Website, found by its public address (slug), for the
// public routes' CORS rule (feature 25b): that site may call that business's booking routes.
// Each answer is kept for a minute, so a busy site does not query the database on every call and
// a changed Website works within a minute. Null for no such business, or no Website.

import { eq } from "drizzle-orm";

import { organization } from "@scheduleads-app/shared/db";
import { organizationSlugValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { websiteDomain } from "../email/website-domain.js";

const MINUTE_MS = 60 * 1000;
// Unknown addresses are kept too, so the map is capped: past it, it starts over (F-544).
const MOST_KEPT = 1000;
const kept = new Map<string, { domain: string | null; until: number }>();

// Throws when the database cannot be read; the caller then allows nothing beyond its fixed list.
export async function websiteDomainForSlug(slug: string, now = Date.now()): Promise<string | null> {
  if (!organizationSlugValidationSchema.safeParse(slug).success) return null; // never a query for junk
  const known = kept.get(slug);
  if (known && known.until > now) return known.domain;
  const [row] = await db
    .select({ website: organization.website })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  const domain = websiteDomain(row?.website ?? null);
  if (kept.size >= MOST_KEPT) kept.clear();
  kept.set(slug, { domain, until: now + MINUTE_MS });
  return domain;
}
