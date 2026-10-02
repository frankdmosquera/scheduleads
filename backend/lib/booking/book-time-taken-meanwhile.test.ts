// Booking a time when the first choice is taken between the check and the hold. The check reads
// taken time a moment before someone else books, so here it reads none at all (findCommitments
// answers empty), while the database holds Ana's time: exactly the race, without its timing.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking tests");

// The check sees the world from just before Ana was taken.
vi.mock("../scheduling/find-commitments.js", () => ({ findCommitments: async () => [] }));

const { db } = await import("../../database.js");
const {
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("./book-time.js");
const { holdTime } = await import("../scheduling/hold-time.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-meanwhile-%-${tag}`));
  await db.$client.end();
});

describe("booking a time", () => {
  test("any available whose first choice is taken meanwhile goes to the next", async () => {
    const id = () => randomUUID();
    const business = id();
    await db
      .insert(organization)
      .values({ id: business, name: "Clinic", slug: `test-meanwhile-clinic-${tag}` });
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
    const [ana, mei, facial] = [id(), id(), id()];
    await db.insert(resource).values([
      { id: ana, organizationId: business, name: "Ana", kind: "person" },
      { id: mei, organizationId: business, name: "Mei", kind: "person" },
    ]);
    await db.insert(bookingLink).values({
      id: facial,
      organizationId: business,
      name: "Facial",
      slug: "facial",
      durationMinutes: 75,
    });
    await db.insert(bookingLinkResource).values([
      { organizationId: business, bookingLinkId: facial, resourceId: ana },
      { organizationId: business, bookingLinkId: facial, resourceId: mei },
    ]);
    // Someone took Ana at 9:00; the check above does not see it, the database does.
    await holdTime(business, {
      resourceIds: [ana],
      startsAt: NINE,
      endsAt: new Date("2026-10-05T16:15:00Z"),
      kind: "time_off",
    });

    const result = await bookTime({
      organizationId: business,
      bookingLinkId: facial,
      personId: null, // "any available": Ana first by name (no bookings either), then Mei
      startsAt: NINE,
      requestKey: randomUUID(),
      customer: { name: "Jane" },
      location: "12 Main Street",
      details: null,
      source: "widget",
      actorUserId: null,
      now: new Date("2026-10-02T14:00:00Z"),
    });

    expect(result).toMatchObject({ booked: true, booking: { personId: mei } });
    const [saved] = await db.select().from(booking).where(eq(booking.organizationId, business));
    expect(saved.personId).toBe(mei); // the booking row was moved to the person who held
  });
});
