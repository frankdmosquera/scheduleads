// Cancelling a booking, against the local database. Every business here is a throwaway carrying
// this run's tag, removed after (its rows go with it). Google and Resend are never called: nobody
// here has a calendar or a Resend key, and fetch throws.

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the cancel tests");

// Imported after the env is loaded: they read it the moment they load.
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
const { bookingEventWrites } = await import("./booking-event-writes.js");
const { bookingConfirmationEmails } = await import("./booking-confirmation-emails.js");
const { cancelBooking } = await import("./cancel-booking.js");

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-02T14:00:00Z");
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const jane = {
  name: "Jane Doe",
  email: `jane-${tag}@example.com`,
  phone: "403 555 0148",
  location: "12 Main Street, Calgary",
  details: "Two bedrooms, ceilings too",
};

// A business of its own with one booking: Marco, an interior estimate (60 minutes, 15 after),
// Monday 9:00.
async function makeBooking(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({ id: business, name, slug: `test-cancel-${name}-${tag}` });
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
  const [marco, estimate] = [id(), id()];
  await db
    .insert(resource)
    .values({ id: marco, organizationId: business, name: "Marco", kind: "person" });
  await db.insert(bookingLink).values({
    id: estimate,
    organizationId: business,
    name: "Interior estimate",
    slug: "interior-estimate",
    durationMinutes: 60,
    bufferAfterMinutes: 15,
  });
  await db
    .insert(bookingLinkResource)
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: marco });
  const result = await bookTime({
    organizationId: business,
    bookingLinkId: estimate,
    personId: marco,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: { name: jane.name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: NOW,
  });
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return { business, bookingId: result.booking.id };
}

type MadeType = Awaited<ReturnType<typeof makeBooking>>;

const rowsOf = async ({ business, bookingId }: MadeType) => ({
  status: (
    await db.select({ status: booking.status }).from(booking).where(eq(booking.id, bookingId))
  )[0]?.status,
  held: (
    await db
      .select({ status: commitment.status })
      .from(commitment)
      .where(and(eq(commitment.organizationId, business), eq(commitment.bookingId, bookingId)))
  ).map((row) => row.status),
  cancelledEntries: await db
    .select({ payload: activity.payload, actorUserId: activity.actorUserId })
    .from(activity)
    .where(and(eq(activity.organizationId, business), eq(activity.type, "booking_cancelled"))),
});

beforeAll(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests never call Google or Resend.");
  });
  vi.spyOn(console, "log").mockImplementation(() => {}); // the businesses send no email: one line each
});

afterAll(async () => {
  await bookingEventWrites.settled();
  await bookingConfirmationEmails.settled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete(organization).where(like(organization.slug, `test-cancel-%-${tag}`));
  await db.$client.end();
});

describe("cancelling a booking", () => {
  test("a cancel marks the booking cancelled, releases its rows and writes one timeline entry", async () => {
    const made = await makeBooking("cancel");
    expect((await rowsOf(made)).held).toEqual(["active"]);

    expect(await cancelBooking(made.bookingId, NOW)).toEqual({
      cancelled: true,
      alreadyCancelled: false,
    });

    expect(await rowsOf(made)).toEqual({
      status: "cancelled",
      held: ["cancelled"], // kept, no longer blocking
      cancelledEntries: [{ payload: { bookingId: made.bookingId }, actorUserId: null }],
    });
  });

  test("a second cancel answers the same and writes nothing more", async () => {
    const made = await makeBooking("twice");
    await cancelBooking(made.bookingId, NOW);

    expect(await cancelBooking(made.bookingId, NOW)).toEqual({
      cancelled: true,
      alreadyCancelled: true,
    });
    expect((await rowsOf(made)).cancelledEntries).toHaveLength(1);
  });

  test("a started booking is refused and nothing changes", async () => {
    const made = await makeBooking("started");

    expect(await cancelBooking(made.bookingId, NINE)).toEqual({
      cancelled: false,
      reason: "already_started",
    });
    expect(await rowsOf(made)).toEqual({
      status: "confirmed",
      held: ["active"],
      cancelledEntries: [],
    });
  });

  test("two cancels at the same instant make one cancel", async () => {
    const made = await makeBooking("at-once");

    const results = await Promise.all([
      cancelBooking(made.bookingId, NOW),
      cancelBooking(made.bookingId, NOW),
    ]);

    expect(results.map((result) => result.cancelled && result.alreadyCancelled).sort()).toEqual([
      false,
      true,
    ]);
    expect((await rowsOf(made)).cancelledEntries).toHaveLength(1);
  });

  // Two at the same instant rarely overlap in a test, so this one makes them: another cancel holds
  // the booking while this one starts, then commits first.
  test("a cancel racing another cancel of the same booking makes one cancel", async () => {
    const made = await makeBooking("race");
    let locked = () => {};
    const isLocked = new Promise<void>((resolve) => (locked = resolve));
    let letGo = () => {};
    const goes = new Promise<void>((resolve) => (letGo = resolve));
    const first = db.transaction(async (tx) => {
      await tx
        .select({ id: booking.id })
        .from(booking)
        .where(eq(booking.id, made.bookingId))
        .for("update");
      locked();
      await goes;
      await tx.update(booking).set({ status: "cancelled" }).where(eq(booking.id, made.bookingId));
    });
    await isLocked;

    const second = cancelBooking(made.bookingId, NOW);
    await new Promise((resolve) => setTimeout(resolve, 200)); // the second now waits on the row
    letGo();
    await first;

    expect(await second).toEqual({ cancelled: true, alreadyCancelled: true });
    expect((await rowsOf(made)).cancelledEntries).toHaveLength(0); // the first wrote none here
  });

  test("only the cancelled booking's time is released", async () => {
    const made = await makeBooking("two");
    const [marco] = await db
      .select({ resourceId: commitment.resourceId })
      .from(commitment)
      .where(eq(commitment.bookingId, made.bookingId));
    const [estimate] = await db
      .select({ id: booking.bookingLinkId })
      .from(booking)
      .where(eq(booking.id, made.bookingId));
    const second = await bookTime({
      organizationId: made.business,
      bookingLinkId: estimate.id,
      personId: marco.resourceId,
      startsAt: new Date("2026-10-05T17:00:00Z"), // Monday 11:00
      requestKey: randomUUID(),
      customer: { name: jane.name, email: jane.email },
      location: jane.location,
      details: null,
      source: "widget",
      actorUserId: null,
      now: NOW,
    });
    if (!second.booked) throw new Error(`expected a booking, got ${second.reason}`);

    await cancelBooking(made.bookingId, NOW);

    expect((await rowsOf({ business: made.business, bookingId: second.booking.id })).held).toEqual([
      "active",
    ]);
  });

  test("another business's booking is never touched", async () => {
    const mine = await makeBooking("mine");
    const theirs = await makeBooking("theirs");

    await cancelBooking(mine.bookingId, NOW);

    expect(await rowsOf(theirs)).toEqual({
      status: "confirmed",
      held: ["active"],
      cancelledEntries: [],
    });
  });

  test("a booking that does not exist is not found", async () => {
    expect(await cancelBooking(randomUUID(), NOW)).toEqual({
      cancelled: false,
      reason: "not_found",
    });
  });

  test("nothing in the timeline entry or a log line carries the customer's details", async () => {
    const lines: string[] = [];
    const keep = (...args: unknown[]) => lines.push(args.map(String).join(" "));
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "warn").mockImplementation(keep);
    const made = await makeBooking("private");
    await cancelBooking(made.bookingId, NOW);

    const everything = `${lines.join("\n")}\n${JSON.stringify((await rowsOf(made)).cancelledEntries)}`;
    for (const detail of ["Jane", jane.email, jane.phone, jane.location, jane.details]) {
      expect(everything).not.toContain(detail);
    }
  });
});
