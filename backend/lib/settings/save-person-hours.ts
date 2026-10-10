// Backend: saves one person's hours from their card on the owner's Hours section (feature 12a), and
// lists their upcoming bookings the new hours leave outside. No booking is changed.

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import type { PersonHoursType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { businessHoursOf } from "./business-hours-of.js";
import type { PersonHoursSettingsType } from "./find-hours-settings.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { outsideHoursOf } from "./outside-hours-of.js";
import type { OutsideHoursBookingType } from "./outside-hours-booking-type.js";
import { sortedHours } from "./sorted-hours.js";

export type SavePersonHoursResultType =
  | { ok: true; person: PersonHoursSettingsType; outsideHours: OutsideHoursBookingType[] }
  | { ok: false; reason: "no_person" | "no_business_hours" };

// Makes or updates the person's row; back on the business's week it keeps their one-off dates.
// The row is never deleted here. Everything the list compares against is read locked in the same
// transaction, so it is exactly what the save replaced: the person (two saves of one person wait
// for each other, even before they have a row), then the business's row, shared, which the
// business's own save holds for update, so the two saves never interleave.
export async function savePersonHours(
  organizationId: string,
  personId: string,
  hours: PersonHoursType,
  now: Date
): Promise<SavePersonHoursResultType> {
  return db.transaction(async (tx) => {
    // Another business's person, a place and an unknown id are all "no person".
    const [person] = await tx
      .select({ id: resource.id, name: resource.name })
      .from(resource)
      .where(
        and(
          eq(resource.organizationId, organizationId),
          eq(resource.id, personId),
          eq(resource.kind, "person"),
          eq(resource.active, true)
        )
      )
      .limit(1)
      .for("no key update"); // still lets a booking for them be made meanwhile
    if (!person) return { ok: false, reason: "no_person" } as const;

    // A person's hours mean nothing until the business has its own: its time zone and notice.
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
      .select({ weeklyHours: availabilityRule.weeklyHours, dateHours: availabilityRule.dateHours })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          eq(availabilityRule.resourceId, person.id)
        )
      )
      .for("update");
    const upcoming = await findUpcomingBookings(tx, organizationId, now, person.id);

    const { weeklyHours, dateHours } = sortedHours(hours);
    await tx
      .insert(availabilityRule)
      .values({ id: randomUUID(), organizationId, resourceId: person.id, weeklyHours, dateHours })
      .onConflictDoUpdate({
        target: [availabilityRule.organizationId, availabilityRule.resourceId],
        set: { weeklyHours, dateHours },
      });

    // No old row: they followed the business's week with no one-off dates of their own.
    const business = businessHoursOf(businessRow);
    const before = {
      ...business,
      people: new Map(oldRow ? [[person.id, oldRow]] : []),
    };
    const after = { ...business, people: new Map([[person.id, { weeklyHours, dateHours }]]) };
    return {
      ok: true,
      person: { id: person.id, name: person.name, weeklyHours, dateHours },
      outsideHours: outsideHoursOf(before, after, upcoming, now),
    } as const;
  });
}
