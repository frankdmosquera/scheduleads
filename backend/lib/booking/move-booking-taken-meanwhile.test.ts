// Moving a booking when the new time is taken between the check and the hold. The check reads
// taken time a moment before someone else books, so here it reads none at all (findCommitments
// answers empty), while the database holds the time: exactly the race, without its timing.

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the move tests");

// The check sees the world from just before the new time was taken.
vi.mock("../scheduling/find-commitments.js", () => ({ findCommitments: async () => [] }));

const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  commitment,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("./book-time.js");
const { moveBooking } = await import("./move-booking.js");
const { bookingEventWrites } = await import("./booking-event-writes.js");
const { bookingConfirmationEmails } = await import("./booking-confirmation-emails.js");
const { bookingEventMoves } = await import("./booking-event-moves.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const ELEVEN = new Date("2026-10-05T17:00:00Z");
const thursdayBefore = new Date("2026-10-01T14:00:00Z");

afterAll(async () => {
  await bookingEventWrites.settled();
  await bookingConfirmationEmails.settled();
  await bookingEventMoves.settled();
  await db.delete(organization).where(like(organization.slug, `test-move-meanwhile-%-${tag}`));
  await db.$client.end();
});

describe("moving a booking", () => {
  test("a hold that fails inside the move undoes all of it", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {}); // no email set up
    const id = () => randomUUID();
    const business = id();
    await db
      .insert(organization)
      .values({ id: business, name: "Clinic", slug: `test-move-meanwhile-clinic-${tag}` });
    await db.insert(availabilityRule).values({
      id: id(),
      organizationId: business,
      resourceId: null,
      weeklyHours: { mon: [{ startMinute: 540, endMinute: 720 }] },
      timezone: "America/Edmonton",
      minimumNoticeMinutes: 0,
      horizonDays: 60,
      closedDates: [],
    });
    await db
      .insert(pipelineStage)
      .values({ id: id(), organizationId: business, name: "New", position: 0 });
    const [ana, facial] = [id(), id()];
    await db
      .insert(resource)
      .values({ id: ana, organizationId: business, name: "Ana", kind: "person" });
    await db.insert(bookingLink).values({
      id: facial,
      organizationId: business,
      name: "Facial",
      slug: "facial",
      durationMinutes: 60,
    });
    await db
      .insert(bookingLinkResource)
      .values({ organizationId: business, bookingLinkId: facial, resourceId: ana });
    const book = async (startsAt: Date, name: string) => {
      const result = await bookTime({
        organizationId: business,
        bookingLinkId: facial,
        personId: ana,
        startsAt,
        requestKey: randomUUID(),
        customer: { name, email: `${name.toLowerCase()}-${tag}@example.com` },
        location: "12 Main Street",
        details: null,
        source: "widget",
        actorUserId: null,
        now: thursdayBefore,
      });
      if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
      return result.booking.id;
    };
    const janes = await book(NINE, "Jane");
    await book(ELEVEN, "Bob"); // Bob takes Ana's 11:00; the move's check does not see it

    const result = await moveBooking({
      bookingId: janes,
      startsAt: ELEVEN,
      personId: ana,
      now: thursdayBefore,
    });

    expect(result).toEqual({ moved: false, reason: "time_taken" });
    const [row] = await db
      .select({ startsAt: booking.startsAt, sequence: booking.sequence })
      .from(booking)
      .where(eq(booking.id, janes));
    expect(row).toEqual({ startsAt: NINE, sequence: 0 });
    // Her old time was released inside the transaction; undone, it is still hers.
    const held = await db
      .select({ startsAt: commitment.startsAt, status: commitment.status })
      .from(commitment)
      .where(eq(commitment.bookingId, janes));
    expect(held).toEqual([{ startsAt: NINE, status: "active" }]);
    expect(
      await db
        .select({ id: activity.id })
        .from(activity)
        .where(and(eq(activity.organizationId, business), eq(activity.type, "booking_moved")))
    ).toEqual([]);
  });
});
