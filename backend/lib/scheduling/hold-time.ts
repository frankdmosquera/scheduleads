// Backend: takes time for one booking or one stretch of time off: every person and place it
// needs, all at once or none. The database's no-overlap rule decides, so two holds for the same
// time at the same instant give one held and one taken.

import { randomUUID } from "node:crypto";

import { commitment } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type HoldTimeInputType = {
  resourceIds: string[]; // the people and places, at least one, each once
  startsAt: Date;
  endsAt: Date; // a booking's buffers are already inside startsAt to endsAt
  kind: "booking" | "time_off";
  bookingId?: string | null;
};

export type HoldTimeResultType = { held: true; ids: string[] } | { held: false };

export async function holdTime(
  organizationId: string,
  { resourceIds, startsAt, endsAt, kind, bookingId = null }: HoldTimeInputType
): Promise<HoldTimeResultType> {
  if (resourceIds.length === 0) throw new Error("Holding time failed: no person or place given");
  if (new Set(resourceIds).size !== resourceIds.length) {
    throw new Error("Holding time failed: the same person or place given twice");
  }

  try {
    // One statement for every row, which Postgres runs all or nothing.
    const held = await db
      .insert(commitment)
      .values(
        resourceIds.map((resourceId) => ({
          id: randomUUID(),
          organizationId,
          resourceId,
          kind,
          bookingId,
          startsAt,
          endsAt,
        }))
      )
      .returning({ id: commitment.id });
    return { held: true, ids: held.map((row) => row.id) };
  } catch (error) {
    // Taken: the only refusal that is an answer. Another business's person is refused by the
    // foreign key instead, never as taken (the rule compares the business too).
    if ((error as { cause?: { code?: unknown } }).cause?.code === "23P01") return { held: false };
    // Never the database's own error: its message carries the query and its values.
    throw new Error(`Holding time failed: ${safeErrorReason(error)}`);
  }
}
