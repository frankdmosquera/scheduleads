// Backend: opens a closed day again from the owner's Days off page (feature 12e), for one person
// or for everyone. What it writes is decided in apply-opening-rules.ts.

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import type { OpenClosedDayType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { applyOpeningRules } from "../bookable-hours/apply-opening-rules.js";
import { businessHoursInputOf } from "../bookable-hours/business-hours-input-of.js";
import { findDaysOff, type DaysOffSettingsType } from "./find-days-off.js";

export type OpenClosedDayResultType =
  | { ok: true; daysOff: DaysOffSettingsType }
  | { ok: false; reason: "no_business_hours" | "no_person" | "not_closed" | "no_usual_hours" };

// The business's row is locked first, as every hours save locks or shares it, so nothing read
// here changes before the write. The person's resource row is read without a lock: their own
// hours save holds it and then waits on the business's row, so locking it here could deadlock.
export async function openClosedDay(
  organizationId: string,
  opening: OpenClosedDayType,
  now: Date
): Promise<OpenClosedDayResultType> {
  return db.transaction(async (tx) => {
    const [businessRow] = await tx
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
      .for("update");
    if (!businessRow) return { ok: false, reason: "no_business_hours" } as const;
    const business = businessHoursInputOf(businessRow);

    if (opening.personId === null) {
      const rule = applyOpeningRules(business, null, opening.date, now);
      if (!rule.ok) return rule;
      if (rule.whose === "business") {
        await tx
          .update(availabilityRule)
          .set({ closedDates: rule.closedDates, dateHours: rule.dateHours })
          .where(eq(availabilityRule.id, businessRow.id));
      }
      return { ok: true, daysOff: await findDaysOff(tx, organizationId, now) } as const;
    }

    // Another business's person, a place, someone turned off and an unknown id are all "no person".
    const [person] = await tx
      .select({ id: resource.id })
      .from(resource)
      .where(
        and(
          eq(resource.organizationId, organizationId),
          eq(resource.id, opening.personId),
          eq(resource.kind, "person"),
          eq(resource.active, true)
        )
      )
      .limit(1);
    if (!person) return { ok: false, reason: "no_person" } as const;

    const [personRow] = await tx
      .select({ weeklyHours: availabilityRule.weeklyHours, dateHours: availabilityRule.dateHours })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          eq(availabilityRule.resourceId, person.id)
        )
      )
      .for("update");
    // No row: they follow the business's week and have no one-off dates of their own.
    const hours = personRow ?? { weeklyHours: null, dateHours: [] };
    const rule = applyOpeningRules(business, hours, opening.date, now);
    if (!rule.ok) return rule;

    await tx
      .insert(availabilityRule)
      .values({
        id: randomUUID(),
        organizationId,
        resourceId: person.id,
        weeklyHours: hours.weeklyHours,
        dateHours: rule.dateHours,
      })
      .onConflictDoUpdate({
        target: [availabilityRule.organizationId, availabilityRule.resourceId],
        set: { dateHours: rule.dateHours },
      });
    return { ok: true, daysOff: await findDaysOff(tx, organizationId, now) } as const;
  });
}
