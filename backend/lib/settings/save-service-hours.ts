// Backend: when a service runs, from the owner's Services page (feature 12k), and the upcoming
// bookings of it the new hours leave outside them, to keep or call. No booking is changed. Back on
// "whenever the business is open" with no one-off dates, the row goes: nothing narrows.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, bookingLink, serviceHours } from "@scheduleads-app/shared/db";
import type {
  DateHoursType,
  PersonHoursType,
  WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { ALL_DAY_WEEK } from "../bookable-hours/all-day-week.js";
import { businessHoursOf } from "./business-hours-of.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { outsideHoursOf } from "./outside-hours-of.js";
import type { ListedBookingType } from "./listed-booking.js";
import { sortedHours } from "./sorted-hours.js";

export type SaveServiceHoursResultType =
  | {
      ok: true;
      hours: { serviceId: string } & PersonHoursType;
      outsideHours: ListedBookingType[];
    }
  | { ok: false; reason: "no_service" | "no_business_hours" };

// A service's row has a person's shape, so the outside-hours rules read it as one, keyed by the
// service: each of its bookings is checked against its window, never against who does it.
export async function saveServiceHours(
  organizationId: string,
  serviceId: string,
  hours: PersonHoursType,
  now: Date
): Promise<SaveServiceHoursResultType> {
  return db.transaction(async (tx) => {
    // Another business's service and an unknown id are both "no service". Two saves of one service
    // wait for each other; a booking of it meanwhile is still made.
    const [service] = await tx
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
      .limit(1)
      .for("no key update");
    if (!service) return { ok: false, reason: "no_service" } as const;

    // Its hours mean nothing until the business has its own: its time zone and its week.
    const [businessRow] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .limit(1)
      .for("share");
    if (!businessRow) return { ok: false, reason: "no_business_hours" } as const;

    const [oldRow] = await tx
      .select({ weeklyHours: serviceHours.weeklyHours, dateHours: serviceHours.dateHours })
      .from(serviceHours)
      .where(
        and(
          eq(serviceHours.organizationId, organizationId),
          eq(serviceHours.bookingLinkId, serviceId)
        )
      );
    const upcoming = await findUpcomingBookings(tx, organizationId, now, { serviceId });

    const { weeklyHours, dateHours } = sortedHours(hours);
    if (weeklyHours === null && dateHours.length === 0) {
      await tx
        .delete(serviceHours)
        .where(
          and(
            eq(serviceHours.organizationId, organizationId),
            eq(serviceHours.bookingLinkId, serviceId)
          )
        );
    } else {
      await tx
        .insert(serviceHours)
        .values({ organizationId, bookingLinkId: serviceId, weeklyHours, dateHours })
        .onConflictDoUpdate({
          target: serviceHours.bookingLinkId,
          set: { weeklyHours, dateHours },
        });
    }

    // Each booking is checked as the service's (personId only picks the row; its person's name
    // still lists it). Whenever open, or no old row, narrows nothing but its own one-off dates, as
    // the free times read it.
    const business = businessHoursOf(businessRow);
    const asTheService = upcoming.map((booking) => ({ ...booking, personId: serviceId }));
    const window = (row: { weeklyHours: WeeklyHoursType | null; dateHours: DateHoursType }) => ({
      weeklyHours: row.weeklyHours ?? ALL_DAY_WEEK,
      dateHours: row.dateHours,
    });
    const before = {
      ...business,
      people: new Map([[serviceId, window(oldRow ?? { weeklyHours: null, dateHours: [] })]]),
    };
    const after = {
      ...business,
      people: new Map([[serviceId, window({ weeklyHours, dateHours })]]),
    };
    return {
      ok: true,
      hours: { serviceId, weeklyHours, dateHours },
      outsideHours: outsideHoursOf(before, after, asTheService, now),
    } as const;
  });
}
