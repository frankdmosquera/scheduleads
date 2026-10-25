// Backend: changes a service from the owner's Services page (feature 12d). Its slug and look stay
// as they are; hiding it stops new bookings and keeps every one already made. A new length changes
// no booking: the answer lists the upcoming ones that would no longer fit the hours (decision 9).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, bookingLink, serviceHours } from "@scheduleads-app/shared/db";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { applyLengthChangeRules } from "../bookable-hours/apply-length-change-rules.js";
import { ALL_DAY_WEEK } from "../bookable-hours/all-day-week.js";
import { businessHoursOf } from "./business-hours-of.js";
import { findPeopleHours } from "./find-people-hours.js";
import { findServiceTicks } from "./find-service-ticks.js";
import { serviceSettingsColumns, type ServiceSettingsType } from "./find-services-settings.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { listedBookingOf, type ListedBookingType } from "./listed-booking.js";

// null: no such service in this business (another business's, or unknown).
export async function saveService(
  organizationId: string,
  serviceId: string,
  service: ServiceType,
  now: Date
): Promise<{ service: ServiceSettingsType; outsideHours: ListedBookingType[] } | null> {
  return db.transaction(async (tx) => {
    // Locked, so the length compared is the one this save replaces.
    const [before] = await tx
      .select({ durationMinutes: bookingLink.durationMinutes })
      .from(bookingLink)
      .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
      .for("update");
    if (!before) return null;

    const [saved] = await tx
      .update(bookingLink)
      .set(service)
      .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.id, serviceId)))
      .returning(serviceSettingsColumns);
    const ticks = await findServiceTicks(tx, organizationId, [saved.id]);
    const answer = { ...saved, ...ticks.get(saved.id)! };
    if (service.durationMinutes === before.durationMinutes) {
      return { service: answer, outsideHours: [] };
    }

    // Locked, so a save of the business's or a person's hours running meanwhile finishes first and
    // the list uses its hours; "no key update" still lets bookings be written meanwhile.
    const [businessRow] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .for("no key update");
    if (!businessRow) return { service: answer, outsideHours: [] }; // no hours: nothing fitted
    const hours = {
      ...businessHoursOf(businessRow),
      people: await findPeopleHours(tx, organizationId),
    };
    const upcoming = await findUpcomingBookings(tx, organizationId, now, { serviceId });
    const outside = applyLengthChangeRules(
      hours,
      serviceId,
      service.durationMinutes,
      upcoming,
      now
    );
    // Its own window too (feature 12k), read as a person's row keyed by the service, so a booking
    // the new length pushes past it is listed; whenever open narrows nothing but its one-off dates.
    const [window] = await tx
      .select({ weeklyHours: serviceHours.weeklyHours, dateHours: serviceHours.dateHours })
      .from(serviceHours)
      .where(
        and(
          eq(serviceHours.organizationId, organizationId),
          eq(serviceHours.bookingLinkId, serviceId)
        )
      );
    const pastWindow = window
      ? applyLengthChangeRules(
          {
            ...hours,
            people: new Map([
              [
                serviceId,
                { weeklyHours: window.weeklyHours ?? ALL_DAY_WEEK, dateHours: window.dateHours },
              ],
            ]),
          },
          serviceId,
          service.durationMinutes,
          upcoming.map((booking) => ({ ...booking, personId: serviceId })),
          now
        )
      : [];
    const listed = new Set(outside.map((booking) => booking.bookingId));
    const both = [...outside, ...pastWindow.filter((booking) => !listed.has(booking.bookingId))];
    return { service: answer, outsideHours: both.map(listedBookingOf) };
  });
}
