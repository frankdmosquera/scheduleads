// Backend: what a person's worker texts already told them about a booking (feature 8c, decision 5),
// read from the sms_sent entries on the customer's timeline: the move numbers their "new booking"
// and "moved" texts described (on their day), and those their "off your day" texts were sent at.
// Both empty: no text about it reached them.

import { and, eq, inArray, sql } from "drizzle-orm";

import { activity } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type WorkerTextsLookupType = {
  organizationId: string;
  contactId: string;
  bookingId: string;
  personId: string;
};

export type WorkerTextsToldType = {
  onTheirDay: number[];
  offTheirDay: number[];
};

export async function findWorkerTextsTold(
  lookup: WorkerTextsLookupType
): Promise<WorkerTextsToldType> {
  const rows = await db
    .select({
      kind: sql<string>`${activity.payload}->>'kind'`,
      sequence: sql<number>`coalesce((${activity.payload}->>'sequence')::int, -1)`,
    })
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, lookup.organizationId),
        eq(activity.contactId, lookup.contactId),
        eq(activity.type, "sms_sent"),
        sql`${activity.payload}->>'bookingId' = ${lookup.bookingId}`,
        sql`${activity.payload}->>'personId' = ${lookup.personId}`,
        inArray(sql`${activity.payload}->>'kind'`, [
          "worker_added",
          "worker_moved",
          "worker_removed",
        ])
      )
    );
  const sequencesOf = (removed: boolean) =>
    rows
      .filter((row) => (row.kind === "worker_removed") === removed)
      .map((row) => Number(row.sequence));
  return { onTheirDay: sequencesOf(false), offTheirDay: sequencesOf(true) };
}
