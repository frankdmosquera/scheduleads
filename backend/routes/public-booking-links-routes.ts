// Backend: the public booking routes, the first a stranger can call. Read-only, no login,
// and answering "not here" the same way whatever the reason, so a stranger learns nothing
// about which businesses or services exist.

import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";

import { availabilityRule, bookingLink, organization } from "@scheduleads-app/shared/db";
import { subscriptionIncludes } from "@scheduleads-app/shared/subscriptions";
import {
  bookingLinkIdValidationSchema,
  organizationSlugValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import { resolveBookableHours } from "../lib/bookable-hours/resolve-bookable-hours.js";
import { refuse } from "../lib/errors/refuse.js";

// The one "not here" body. Unknown business, no booking in its plan, no hours yet, unknown,
// switched-off or another business's service: all identical, so none can be probed.
const notFound = refuse("not_found", "Nothing is bookable here.");

// What a stranger may see of a service. Never organizationId, never anything about people.
const publicBookingLinkColumns = {
  id: bookingLink.id,
  slug: bookingLink.slug,
  name: bookingLink.name,
  description: bookingLink.description,
  durationMinutes: bookingLink.durationMinutes,
  bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
  bufferAfterMinutes: bookingLink.bufferAfterMinutes,
};

// The business behind a public address, or null when it must not be shown: no such slug,
// a plan without booking, or no business hours yet. One query, the hours row joined in.
// The slug is the only place a public route takes a business from the URL; every query
// after this one filters on the id it returns. The plan is read here and in
// requireKnownSubscriptionMiddleware (the dashboard's 403): a change to plans touches both.
async function findBookableOrganizationId(slug: string): Promise<string | null> {
  const [row] = await db
    .select({ id: organization.id, plan: organization.plan, hoursId: availabilityRule.id })
    .from(organization)
    .leftJoin(
      availabilityRule,
      and(eq(availabilityRule.organizationId, organization.id), isNull(availabilityRule.resourceId))
    )
    .where(eq(organization.slug, slug))
    .limit(1);

  if (!row || !subscriptionIncludes(row.plan, "booking") || row.hoursId === null) return null;
  return row.id;
}

export const publicBookingLinksRoutes = new Hono()
  // A business's active services, by name.
  .get("/:slug/booking-links", async (c) => {
    const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
    if (!slug.success) return c.json(refuse("bad_request", "That is not a business address."), 400);

    const organizationId = await findBookableOrganizationId(slug.data);
    if (!organizationId) return c.json(notFound, 404);

    const bookingLinks = await db
      .select(publicBookingLinkColumns)
      .from(bookingLink)
      .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.active, true)))
      .orderBy(asc(bookingLink.name));

    return c.json({ bookingLinks }, 200);
  })
  // One service and the business's bookable hours. A person is chosen with bookings (feature 5).
  .get("/:slug/booking-links/:bookingLinkId", async (c) => {
    const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
    const bookingLinkId = bookingLinkIdValidationSchema.safeParse(c.req.param("bookingLinkId"));
    if (!slug.success || !bookingLinkId.success) {
      return c.json(refuse("bad_request", "That is not a valid booking address."), 400);
    }

    const organizationId = await findBookableOrganizationId(slug.data);
    if (!organizationId) return c.json(notFound, 404);

    // Found only inside this business, never by id alone.
    const [publicBookingLink] = await db
      .select(publicBookingLinkColumns)
      .from(bookingLink)
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          eq(bookingLink.id, bookingLinkId.data),
          eq(bookingLink.active, true)
        )
      )
      .limit(1);
    if (!publicBookingLink) return c.json(notFound, 404);

    const hours = await resolveBookableHours(organizationId, null, new Date());
    if (!hours) return c.json(notFound, 404); // the hours row went between the two reads

    // `source` stays out: it says whose week answered, which is about people.
    const { source: _source, ...availability } = hours;
    return c.json({ bookingLink: publicBookingLink, availability }, 200);
  });
