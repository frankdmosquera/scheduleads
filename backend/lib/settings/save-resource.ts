// Backend: renames a person or place, or turns one off or on, from the owner's People page (feature
// 12d). Never deleted (decision 3): off stops new bookings, and the answer lists the upcoming
// bookings it still holds, unchanged, so the owner can call those customers.

import { and, count, eq, ne } from "drizzle-orm";

import { resource } from "@scheduleads-app/shared/db";
import type { SaveResourceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findUpcomingBookings } from "./find-upcoming-bookings.js";
import { listedBookingOf, type ListedBookingType } from "./listed-booking.js";
import { lockBusinessResources } from "./lock-business-resources.js";
import { nameTaken } from "./name-taken.js";
import {
  resourceSettingsColumns,
  resourceSettingsOf,
  type ResourceSettingsType,
} from "./resource-settings-of.js";

export type SaveResourceResultType =
  | { ok: true; resource: ResourceSettingsType; upcomingBookings: ListedBookingType[] }
  | { ok: false; reason: "not_found" | "name_taken" | "last_person" };

export async function saveResource(
  organizationId: string,
  resourceId: string,
  saved: SaveResourceType,
  now: Date
): Promise<SaveResourceResultType> {
  return db.transaction(async (tx) => {
    await lockBusinessResources(tx, organizationId);
    const [current] = await tx
      .select(resourceSettingsColumns)
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.id, resourceId)))
      .limit(1);
    if (!current) return { ok: false, reason: "not_found" } as const;
    if (await nameTaken(tx, organizationId, saved.name, resourceId)) {
      return { ok: false, reason: "name_taken" } as const;
    }

    // A business with nobody on can take no bookings, so the last person on stays on (decision 10).
    const turningOff = current.active && !saved.active;
    if (turningOff && current.kind === "person") {
      const [others] = await tx
        .select({ count: count() })
        .from(resource)
        .where(
          and(
            eq(resource.organizationId, organizationId),
            eq(resource.kind, "person"),
            eq(resource.active, true),
            ne(resource.id, resourceId)
          )
        );
      if (!others?.count) return { ok: false, reason: "last_person" } as const;
    }

    const [row] = await tx
      .update(resource)
      .set({ name: saved.name, active: saved.active })
      .where(and(eq(resource.organizationId, organizationId), eq(resource.id, resourceId)))
      .returning(resourceSettingsColumns);
    const upcoming = turningOff
      ? await findUpcomingBookings(
          tx,
          organizationId,
          now,
          current.kind === "person" ? { personId: resourceId } : { placeId: resourceId }
        )
      : [];
    return {
      ok: true,
      resource: resourceSettingsOf(row),
      upcomingBookings: upcoming.map(listedBookingOf),
    } as const;
  });
}
