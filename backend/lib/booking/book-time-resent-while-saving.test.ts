// The same form sent again while its first copy is still being saved. The second copy reads
// the form's key before the first is saved, then its check is held until the first has booked, so
// the check sees the first copy's own time as taken: exactly the race, without its timing.

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

// The first check made is held until the test lets it go; every later one runs straight through.
const held = vi.hoisted(() => {
  let reach = () => {};
  let release = () => {};
  return {
    reached: new Promise<void>((resolve) => (reach = resolve)),
    released: new Promise<void>((resolve) => (release = resolve)),
    reach: () => reach(),
    release: () => release(),
    first: true,
  };
});
vi.mock("../scheduling/find-free-times.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../scheduling/find-free-times.js")>();
  return {
    findFreeTimes: async (input: Parameters<typeof actual.findFreeTimes>[0]) => {
      if (held.first) {
        held.first = false;
        held.reach();
        await held.released;
      }
      return actual.findFreeTimes(input);
    },
  };
});

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
const { bookingEventWrites } = await import("./booking-event-writes.js");
const { workDueJobs } = await import("../jobs/work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const fridayMorning = new Date("2026-10-02T14:00:00Z");

afterAll(async () => {
  await bookingEventWrites.settled(); // no Google write outlives the database
  await workDueJobs(); // nor an email
  await db.delete(organization).where(like(organization.slug, `test-resent-%-${tag}`));
  await db.$client.end();
});

describe("booking a time", () => {
  test("a form sent again while its first copy is saved gets that booking, never time taken", async () => {
    const id = () => randomUUID();
    const business = id();
    await db
      .insert(organization)
      .values({ id: business, name: "Painter", slug: `test-resent-painter-${tag}` });
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
    // One painter, so a second copy cannot find someone else free: Primo's shape.
    const [pedro, estimate] = [id(), id()];
    await db
      .insert(resource)
      .values({ id: pedro, organizationId: business, name: "Pedro", kind: "person" });
    await db.insert(bookingLink).values({
      id: estimate,
      organizationId: business,
      name: "Estimate",
      slug: "estimate",
      durationMinutes: 60,
    });
    await db
      .insert(bookingLinkResource)
      .values({ organizationId: business, bookingLinkId: estimate, resourceId: pedro });

    const form = {
      organizationId: business,
      bookingLinkId: estimate,
      personId: pedro,
      startsAt: NINE,
      requestKey: id(),
      customer: { name: "Jane Doe", email: `jane-${tag}@example.com` },
      location: "12 Elm Street",
      details: null,
      source: "widget" as const,
      actorUserId: null,
      now: fridayMorning,
    };

    const second = bookTime(form); // reads the key (nothing yet), then waits at its check
    await held.reached;
    const first = await bookTime(form); // the first copy, saved meanwhile
    held.release();
    const resent = await second;

    expect(first.booked).toBe(true);
    expect(resent).toEqual({
      booked: true,
      alreadyBooked: true,
      booking: first.booked ? first.booking : null,
    });
    const rows = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.organizationId, business));
    expect(rows).toHaveLength(1);
  });
});
