// Backend: saves the business's hours from the owner's Hours card (feature 12a), and lists the
// upcoming bookings the new hours leave outside. No booking is changed.

import { randomUUID } from "node:crypto";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";

import { availabilityRule } from "@scheduleads-app/shared/db";
import type { BusinessHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import type { HoursRowsType } from "../bookable-hours/apply-outside-hours-rules.js";
import { businessHoursOf } from "./business-hours-of.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { outsideHoursOf } from "./outside-hours-of.js";
import type { OutsideHoursBookingType } from "./outside-hours-booking-type.js";
import { sortedHours } from "./sorted-hours.js";

// The first save makes the business's row with no closed days and no holidays; every later save
// changes only these five columns, so the closed days screen's settings (12e) stay as they are.
// The old row is read locked in the same transaction, so the list compares against exactly what
// the save replaced; two first saves at once still make one row (the upsert).
export async function saveBusinessHours(
  organizationId: string,
  hours: BusinessHoursType,
  now: Date
): Promise<{ business: BusinessHoursType; outsideHours: OutsideHoursBookingType[] }> {
  const saved = { ...hours, ...sortedHours(hours) };
  const { weeklyHours, dateHours, timezone, minimumNoticeMinutes, horizonDays } = saved;

  return db.transaction(async (tx) => {
    const [oldRow] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .for("update");

    // Everyone's own rows: a new time zone or one-off date can move anyone's bookings. They cannot
    // change meanwhile: a person's save reads the business's row shared first, so it waits on this one.
    const personRows = await tx
      .select({
        resourceId: availabilityRule.resourceId,
        weeklyHours: availabilityRule.weeklyHours,
        dateHours: availabilityRule.dateHours,
      })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNotNull(availabilityRule.resourceId)
        )
      );
    const people: HoursRowsType["people"] = new Map(
      personRows.map((row) => [
        row.resourceId!,
        { weeklyHours: row.weeklyHours, dateHours: row.dateHours },
      ])
    );
    const upcoming = await findUpcomingBookings(tx, organizationId, now, null);

    await tx
      .insert(availabilityRule)
      .values({
        id: randomUUID(),
        organizationId,
        resourceId: null,
        weeklyHours,
        dateHours,
        timezone,
        minimumNoticeMinutes,
        horizonDays,
        closedDates: [],
      })
      .onConflictDoUpdate({
        target: availabilityRule.organizationId,
        targetWhere: sql`${availabilityRule.resourceId} is null`, // the business row's own index
        set: { weeklyHours, dateHours, timezone, minimumNoticeMinutes, horizonDays },
      });

    const before = oldRow ? { ...businessHoursOf(oldRow), people } : null;
    const after = { timezone, weeklyHours, dateHours, people };
    return { business: saved, outsideHours: outsideHoursOf(before, after, upcoming, now) };
  });
}
