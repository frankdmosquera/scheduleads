// Backend: changes a service from the owner's Services page (feature 12d). Its slug and look stay
// as they are; hiding it stops new bookings and keeps every one already made. A new length changes
// no booking: the answer lists the upcoming ones that would no longer fit the hours (decision 9).

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, bookingLink } from "@scheduleads-app/shared/db";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { applyLengthChangeRules } from "../bookable-hours/apply-length-change-rules.js";
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

    // Read shared, so a save of hours running meanwhile finishes first and the list uses its hours.
    const [businessRow] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .for("share");
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
    return { service: answer, outsideHours: outside.map(listedBookingOf) };
  });
}
