// Backend: takes time for one booking or one stretch of time off: every person and place it
// needs, all at once or none. The database's no-overlap rule decides. Two holds that clash at the
// same instant can deadlock inside Postgres, which cancels one; that one tries again and, the
// other now saved, answers taken. So the two give one held and one taken. Inside a caller's
// transaction each try runs in a savepoint, so a refusal leaves that transaction usable.

import { randomUUID } from "node:crypto";

import { commitment } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type HoldTimeInputType = {
  resourceIds: string[]; // the people and places, at least one, each once
  startsAt: Date;
  endsAt: Date; // a booking's buffers are already inside startsAt to endsAt
  kind: "booking" | "time_off";
  bookingId?: string | null;
};

export type HoldTimeResultType = { held: true; ids: string[] } | { held: false };

const TAKEN = "23P01"; // the no-overlap rule refused a row
const DEADLOCK = "40P01"; // Postgres cancelled this side of a clash; nothing was saved
const ATTEMPTS = 3; // one deadlock is all a clash between two holds can cause

const postgresCode = (error: unknown) => (error as { cause?: { code?: unknown } }).cause?.code;

export async function holdTime(
  organizationId: string,
  { resourceIds, startsAt, endsAt, kind, bookingId = null }: HoldTimeInputType,
  executor: DatabaseExecutorType = db
): Promise<HoldTimeResultType> {
  if (resourceIds.length === 0) throw new Error("Holding time failed: no person or place given");
  if (new Set(resourceIds).size !== resourceIds.length) {
    throw new Error("Holding time failed: the same person or place given twice");
  }

  for (let attempt = 1; ; attempt++) {
    try {
      // One statement for every row, which Postgres runs all or nothing; in a nested transaction,
      // so a refused try is undone alone (a savepoint inside the caller's).
      const held = await executor.transaction((attemptExecutor) =>
        attemptExecutor
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
          .returning({ id: commitment.id })
      );
      return { held: true, ids: held.map((row) => row.id) };
    } catch (error) {
      // Taken: the only refusal that is an answer. Another business's person is refused by the
      // foreign key instead, never as taken (the rule compares the business too).
      if (postgresCode(error) === TAKEN) return { held: false };
      if (postgresCode(error) === DEADLOCK && attempt < ATTEMPTS) continue;
      // Never the database's own error: its message carries the query and its values.
      throw new Error(`Holding time failed: ${safeErrorReason(error)}`);
    }
  }
}
