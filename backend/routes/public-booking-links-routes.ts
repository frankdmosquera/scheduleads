// Backend: the public booking routes a stranger can call. Read-only, no login, and one
// identical "not here" answer, so nobody can probe which businesses or services exist.

import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import { bookingLink } from "@scheduleads-app/shared/db";
import {
  bookingLinkIdValidationSchema,
  freeTimesQueryValidationSchema,
  organizationSlugValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import { resolveBookableHours } from "../lib/bookable-hours/resolve-bookable-hours.js";
import { findBookableOrganizationId } from "../lib/booking/find-bookable-organization-id.js";
import { CalendarUnavailableError } from "../lib/calendar/calendar-unavailable-error.js";
import { notBookableHere } from "../lib/errors/not-bookable-here.js";
import { refuse } from "../lib/errors/refuse.js";
import { findFreeTimes } from "../lib/scheduling/find-free-times.js";

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

export const publicBookingLinksRoutes = new Hono()
  // A business's active services, by name.
  .get("/:slug/booking-links", async (c) => {
    const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
    if (!slug.success) return c.json(refuse("bad_request", "That is not a business address."), 400);

    const organizationId = await findBookableOrganizationId(slug.data);
    if (!organizationId) return c.json(notBookableHere, 404);

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
    if (!organizationId) return c.json(notBookableHere, 404);

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
    if (!publicBookingLink) return c.json(notBookableHere, 404);

    const hours = await resolveBookableHours(organizationId, null, new Date());
    if (!hours) return c.json(notBookableHere, 404); // the hours row went between the two reads

    // `source` stays out: it says whose week answered, which is about people.
    const { source: _source, ...availability } = hours;
    return c.json({ bookingLink: publicBookingLink, availability }, 200);
  })
  // The start times a customer can book for a service, with one person or "any available".
  .get(
    "/:slug/booking-links/:bookingLinkId/times",
    validator("query", (value, c) => {
      const parsed = freeTimesQueryValidationSchema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "That is not a valid question.";
        return c.json(refuse("bad_request", message), 400);
      }
      return parsed.data;
    }),
    async (c) => {
      const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
      const bookingLinkId = bookingLinkIdValidationSchema.safeParse(c.req.param("bookingLinkId"));
      if (!slug.success || !bookingLinkId.success) {
        return c.json(refuse("bad_request", "That is not a valid booking address."), 400);
      }
      const query = c.req.valid("query");

      const organizationId = await findBookableOrganizationId(slug.data);
      if (!organizationId) return c.json(notBookableHere, 404);

      // The dates go in as asked: findFreeTimes cuts them to today through the horizon.
      try {
        const freeTimes = await findFreeTimes({
          organizationId,
          bookingLinkId: bookingLinkId.data,
          personId: query.person ?? null,
          fromDate: query.from,
          toDate: query.to,
          now: new Date(),
        });
        if (!freeTimes) return c.json(notBookableHere, 404);
        return c.json(freeTimes, 200);
      } catch (error) {
        // Only unreadable calendars are expected (the picked person's, or everyone's with "any
        // available", decision 9); anything else is a real fault.
        if (!(error instanceof CalendarUnavailableError)) throw error;
        return c.json(
          refuse("unavailable", "Times cannot be read right now. Try again shortly."),
          503
        );
      }
    }
  );
