// Backend: the move numbers of the booking that a person's "new booking" and "moved" texts told
// them about (feature 8c, decision 5), read from the sms_sent entries on the customer's timeline.
// Empty: they were never told of it. A number at or past a change's means they already heard of
// that change.

import { and, eq, inArray, sql } from "drizzle-orm";

import { activity } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type WorkerNewsLookupType = {
  organizationId: string;
  contactId: string;
  bookingId: string;
  personId: string;
};

export async function findWorkerNewsTold(lookup: WorkerNewsLookupType): Promise<number[]> {
  const rows = await db
    .select({ sequence: sql<number>`coalesce((${activity.payload}->>'sequence')::int, -1)` })
    .from(activity)
    .where(
      and(
        eq(activity.organizationId, lookup.organizationId),
        eq(activity.contactId, lookup.contactId),
        eq(activity.type, "sms_sent"),
        sql`${activity.payload}->>'bookingId' = ${lookup.bookingId}`,
        sql`${activity.payload}->>'personId' = ${lookup.personId}`,
        inArray(sql`${activity.payload}->>'kind'`, ["worker_added", "worker_moved"])
      )
    );
  return rows.map((row) => Number(row.sequence));
}
