// Backend: one write of the business's closed days from the Days off page (feature 12e), shared by
// the save and by closing a day, and the upcoming bookings it leaves on a day now closed. No
// booking is changed: closing a day only stops new bookings.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";
import type { DateHoursType, DaysOffType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import type { BusinessHoursInputType } from "../bookable-hours/apply-bookable-hours-rules.js";
import { applyNewlyClosedRules } from "../bookable-hours/apply-newly-closed-rules.js";
import { businessHoursInputOf } from "../bookable-hours/business-hours-input-of.js";
import { findDaysOff, type DaysOffSettingsType } from "./find-days-off.js";
import { findPeopleHours } from "./find-people-hours.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { listedBookingOf, type ListedBookingType } from "./listed-booking.js";

export type WriteDaysOffResultType =
  | { ok: true; daysOff: DaysOffSettingsType; newlyClosed: ListedBookingType[] }
  | { ok: false; reason: "no_business_hours" };

// The business's row is read locked, as the Hours card's save does, so the list compares against
// exactly what this write replaced, and a person's save (which reads it shared) waits.
export async function writeDaysOff(
  organizationId: string,
  change: (before: BusinessHoursInputType) => DaysOffType & { dateHours: DateHoursType },
  now: Date
): Promise<WriteDaysOffResultType> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .for("update");
    if (!row) return { ok: false, reason: "no_business_hours" } as const;

    const before = businessHoursInputOf(row);
    const people = await findPeopleHours(tx, organizationId);
    const upcoming = await findUpcomingBookings(tx, organizationId, now, null);
    const written = change(before);
    const after = { ...before, ...written };
    const newlyClosed = applyNewlyClosedRules(before, after, people, upcoming, now);

    await tx
      .update(availabilityRule)
      .set({
        closedDates: written.closedDates,
        holidayCountry: written.holidayCountry,
        holidayRegion: written.holidayRegion,
        closedHolidays: written.closedHolidays,
        dateHours: written.dateHours,
      })
      .where(eq(availabilityRule.id, row.id));

    return {
      ok: true,
      daysOff: await findDaysOff(tx, organizationId, now),
      newlyClosed: newlyClosed.map(listedBookingOf),
    } as const;
  });
}
