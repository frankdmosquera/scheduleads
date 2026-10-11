// Backend: saves the business's closed days and holiday picks from the owner's Days off page
// (feature 12e), and lists the upcoming bookings left on a day that is now closed. No booking is
// changed: closing a day only stops new bookings.

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";
import type { DaysOffType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { applyNewlyClosedRules } from "../bookable-hours/apply-newly-closed-rules.js";
import { businessHoursInputOf } from "../bookable-hours/business-hours-input-of.js";
import { findDaysOff, type DaysOffSettingsType } from "./find-days-off.js";
import { findPeopleHours } from "./find-people-hours.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { listedBookingOf, type ListedBookingType } from "./listed-booking.js";

export type SaveDaysOffResultType =
  | { ok: true; daysOff: DaysOffSettingsType; newlyClosed: ListedBookingType[] }
  | { ok: false; reason: "no_business_hours" };

// The business's row is read locked, as the Hours card's save does, so the list compares against
// exactly what this save replaced, and a person's save (which reads it shared) waits.
export async function saveDaysOff(
  organizationId: string,
  daysOff: DaysOffType,
  now: Date
): Promise<SaveDaysOffResultType> {
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

    // A date just closed loses the business's one-off hours on it: a one-off date opens a closed
    // day, so keeping it would leave the day open for everyone. People's own openings stay theirs.
    const added = new Set(daysOff.closedDates.filter((date) => !before.closedDates.includes(date)));
    const dateHours = before.dateHours.filter((entry) => !added.has(entry.date));
    const closedDates = [...daysOff.closedDates].sort(); // YYYY-MM-DD sorts as text
    const after = { ...before, ...daysOff, closedDates, dateHours };
    const newlyClosed = applyNewlyClosedRules(before, after, people, upcoming, now);

    await tx
      .update(availabilityRule)
      .set({
        closedDates,
        holidayCountry: daysOff.holidayCountry,
        holidayRegion: daysOff.holidayRegion,
        closedHolidays: daysOff.closedHolidays,
        dateHours,
      })
      .where(eq(availabilityRule.id, row.id));

    return {
      ok: true,
      daysOff: await findDaysOff(tx, organizationId, now),
      newlyClosed: newlyClosed.map(listedBookingOf),
    } as const;
  });
}
