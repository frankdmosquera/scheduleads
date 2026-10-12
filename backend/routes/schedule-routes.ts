// Backend: the Calendar page (feature 12b): one person's or place's week. The business and the
// caller always come from the session. A role that may change the business sees every calendar;
// anyone else only their own person's, read-only.

import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import { availabilityRule, calendarConnection, resource } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";
import {
  bookByHandValidationSchema,
  scheduleWeekQueryValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import {
  hasBusinessPermission,
  type PermissionsType,
} from "../lib/auth/has-business-permission.js";
import { findSignedInPerson } from "../lib/calendar/find-signed-in-person.js";
import { bookTime } from "../lib/booking/book-time.js";
import { refuse } from "../lib/errors/refuse.js";
import { localTimeToMoment } from "../lib/local-time/local-time-to-moment.js";
import { findScheduleWeek } from "../lib/schedule/find-schedule-week.js";
import { mondayOf } from "../lib/schedule/monday-of.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const CHANGE_BUSINESS: PermissionsType = { organization: ["update"] };

// The business's IANA zone, set with its hours; null before it has any.
async function businessTimezoneOf(organizationId: string): Promise<string | null> {
  const [business] = await db
    .select({ timezone: availabilityRule.timezone })
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  return business?.timezone ?? null;
}

// Whether the person's Google connection needs reconnecting: their busy times cannot be read until
// they do, so asking again would never help.
async function needsReconnect(organizationId: string, personId: string): Promise<boolean> {
  const [connection] = await db
    .select({ status: calendarConnection.status })
    .from(calendarConnection)
    .where(
      and(
        eq(calendarConnection.organizationId, organizationId),
        eq(calendarConnection.resourceId, personId)
      )
    )
    .limit(1);
  return connection?.status === "needs_reconnect";
}

const noBusinessHours = refuse("no_business_hours", "Set the business's hours on Settings first.");

export const scheduleRoutes = new Hono()
  // One week of one person or place, and the calendars this login may pick between.
  .get(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    validator("query", (value, c) => {
      const parsed = scheduleWeekQueryValidationSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      const message = parsed.error.issues[0]?.message ?? "Check the address and try again.";
      return c.json(refuse("bad_request", message), 400);
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const query = c.req.valid("query");
      const [canEdit, own] = await Promise.all([
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
        findSignedInPerson(organizationId, c.get("user").id),
      ]);

      // An owner picks between every active person and place, people first; anyone else sees
      // only their own person.
      const everyone = canEdit
        ? await db
            .select({ id: resource.id, name: resource.name, kind: resource.kind })
            .from(resource)
            .where(and(eq(resource.organizationId, organizationId), eq(resource.active, true)))
            .orderBy(asc(resource.kind), asc(resource.name)) // "person" sorts before "place"
        : [];
      if (!canEdit && !own) {
        return c.json(
          refuse("no_person", "Your login is not linked to anyone on this business's calendar."),
          409
        );
      }

      const wantedId = query.resourceId ?? own?.id ?? everyone[0]?.id;
      if (!wantedId) {
        return c.json(refuse("not_found", "This business has nobody on its calendar yet."), 404);
      }
      if (!canEdit && wantedId !== own?.id) {
        return c.json(refuse("forbidden", "You can see only your own calendar."), 403);
      }
      // Any of the business's own, a turned-off one too, so an old link still opens; never another's.
      const [shown] = await db
        .select({ id: resource.id, name: resource.name, kind: resource.kind })
        .from(resource)
        .where(and(eq(resource.organizationId, organizationId), eq(resource.id, wantedId)))
        .limit(1);
      if (!shown) return c.json(refuse("not_found", "That calendar is not one of yours."), 404);

      const timezone = await businessTimezoneOf(organizationId);
      if (!timezone) return c.json(noBusinessHours, 409);

      const weekOf = mondayOf(query.weekOf ?? localDate(new Date(), timezone));
      const week = await findScheduleWeek({
        organizationId,
        resource: shown,
        timezone,
        weekOf,
      });
      const resources = canEdit
        ? everyone.some((one) => one.id === shown.id)
          ? everyone
          : [...everyone, shown]
        : [shown];

      return c.json({ canEdit, timezone, resource: shown, resources, ...week }, 200);
    }
  )

  // A booking by hand, a phone estimate or a walk-in (12b.2): the website's own booking path, as the
  // owner, so any time nobody it needs is busy, inside bookable hours or not, never on a day gone.
  .post(
    "/bookings",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = bookByHandValidationSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      const issue = parsed.error.issues[0];
      return c.json(
        {
          ...refuse("bad_request", issue?.message ?? "Check the form and try again."),
          field: issue?.path.join(".") ?? "",
        },
        400
      );
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const body = c.req.valid("json");
      const timezone = await businessTimezoneOf(organizationId);
      if (!timezone) return c.json(noBusinessHours, 409);

      // The clock time on that day in the business's zone; an hour skipped in spring is no time.
      const startsAt = localTimeToMoment(body.date, body.startMinute, timezone);
      if (!startsAt) {
        return c.json(
          {
            ...refuse("bad_request", "That time does not exist that day: the clocks skip it."),
            field: "startMinute",
          },
          400
        );
      }

      const result = await bookTime({
        organizationId,
        bookingLinkId: body.bookingLinkId,
        personId: body.personId,
        startsAt,
        requestKey: null, // the owner books once; a second press is a second booking
        customer: body.customer,
        location: body.location ?? null,
        details: body.details ?? null,
        source: "manual",
        actorUserId: c.get("user").id,
        now: new Date(),
      });

      if (!result.booked) {
        switch (result.reason) {
          case "not_found":
          case "person_not_taken":
            return c.json(
              refuse("not_found", "That service or person is not one of this business's."),
              404
            );
          case "time_taken":
            return c.json(
              refuse(
                "time_taken",
                "Someone it needs is already busy then: off, booked, or busy in Google."
              ),
              409
            );
          case "in_the_past":
            return c.json(refuse("in_the_past", "That day is already over."), 400);
          case "unavailable":
            if (await needsReconnect(organizationId, body.personId)) {
              return c.json(
                refuse(
                  "reconnect_needed",
                  "This person's Google calendar needs reconnecting, so their time cannot be checked. They reconnect on Settings, Calendar."
                ),
                409
              );
            }
            return c.json(
              refuse(
                "unavailable",
                "Google did not answer, so that time cannot be checked. Try again shortly."
              ),
              503
            );
          default:
            // The owner is never held to the form's contact rule, its questions, a form key or a limit.
            throw new Error(`Booking by hand failed: ${result.reason}.`);
        }
      }

      const { booking } = result;
      return c.json(
        {
          booking: {
            id: booking.id,
            leadId: booking.leadId,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
          },
        },
        201
      );
    }
  );
