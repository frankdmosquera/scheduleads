// Moving a booking from its page (feature 7b), through the real app against the local database.
// Every test makes a clinic of its own, removed after. Google and Resend are never reached: fetch
// throws, nobody has a Resend key, and a calendar here is only ever one needing reconnection.

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the link key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking move tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const {
  activity,
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  calendarConnection,
  commitment,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../lib/booking/book-time.js");
const { bookingEventWrites } = await import("../lib/booking/booking-event-writes.js");
const { workDueJobs } = await import("../lib/jobs/work-due-jobs.js");
const { bookingEventMoves } = await import("../lib/booking/booking-event-moves.js");
const { makeBookingPageToken } = await import("../lib/booking/booking-page-token.js");
const { addDays } = await import("../lib/local-time/add-days.js");
const { localDate } = await import("../lib/local-time/local-date.js");
const { localTimeToMoment } = await import("../lib/local-time/local-time-to-moment.js");

const tag = randomUUID().slice(0, 8);
const ZONE = "America/Edmonton";
const jane = {
  name: "Jane Doe",
  email: `jane-${tag}@example.com`,
  phone: "403 555 0148",
  location: "12 Main Street, Calgary",
  details: "Sensitive skin",
};

// The day a week from today in the clinic's zone, and a moment on it.
const day = addDays(localDate(new Date(), ZONE), 7);
const at = (hour: number, minute = 0) =>
  localTimeToMoment(day, hour * 60 + minute, ZONE)!.toISOString();

// A clinic of its own: Ana and Mei do facials (60 minutes, a start every 30), every day 9:00 to
// 17:00, in Room 3 when withRoom. Jane has a facial with Ana at 9:00.
async function makeClinic(name: string, { withRoom = false } = {}) {
  const id = () => randomUUID();
  const business = id();
  const slug = `test-moving-${name}-${tag}-dev`;
  await db.insert(organization).values({ id: business, name: "Riverbend Clinic", slug });
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: business,
    resourceId: null,
    weeklyHours: Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((weekday) => [
        weekday,
        [{ startMinute: 540, endMinute: 1020 }],
      ])
    ),
    timezone: ZONE,
    minimumNoticeMinutes: 0,
    horizonDays: 60,
    closedDates: [],
  });
  await db
    .insert(pipelineStage)
    .values({ id: id(), organizationId: business, name: "New", position: 0 });
  const [ana, mei, room, facial] = [id(), id(), id(), id()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: mei, organizationId: business, name: "Mei", kind: "person" },
    { id: room, organizationId: business, name: "Room 3", kind: "place" },
  ]);
  await db.insert(bookingLink).values({
    id: facial,
    organizationId: business,
    name: "Facial",
    slug: "facial",
    durationMinutes: 60,
    slotIntervalMinutes: 30,
  });
  await db
    .insert(bookingLinkResource)
    .values([
      { organizationId: business, bookingLinkId: facial, resourceId: ana },
      { organizationId: business, bookingLinkId: facial, resourceId: mei },
      ...(withRoom ? [{ organizationId: business, bookingLinkId: facial, resourceId: room }] : []),
    ]);
  const clinic = { business, slug, ana, mei, room, facial };
  return { ...clinic, janesBooking: await book(clinic, ana, 9) };
}

type ClinicType = Omit<Awaited<ReturnType<typeof makeClinic>>, "janesBooking">;

async function book(clinic: ClinicType, personId: string, hour: number, minute = 0) {
  const result = await bookTime({
    organizationId: clinic.business,
    bookingLinkId: clinic.facial,
    personId,
    startsAt: new Date(at(hour, minute)),
    requestKey: randomUUID(),
    customer: { name: jane.name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: new Date(),
  });
  await bookingEventWrites.settled();
  await workDueJobs();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

const move = (bookingId: string, startsAt: string, personId: string | null = null) =>
  app.request(`/public/bookings/${makeBookingPageToken(bookingId)}/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ startsAt, personId }),
  });
const codeOf = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

const bookingRow = async (bookingId: string) =>
  (
    await db
      .select({
        startsAt: booking.startsAt,
        personId: booking.personId,
        sequence: booking.sequence,
        status: booking.status,
      })
      .from(booking)
      .where(eq(booking.id, bookingId))
  )[0];
const heldRows = (bookingId: string) =>
  db
    .select({
      resourceId: commitment.resourceId,
      startsAt: commitment.startsAt,
      status: commitment.status,
    })
    .from(commitment)
    .where(eq(commitment.bookingId, bookingId));
// Calendars that cannot be read: each connection needs reconnecting, so Google is never asked.
const unreadableCalendars = (clinic: ClinicType, resourceIds: string[]) =>
  db.insert(calendarConnection).values(
    resourceIds.map((resourceId) => ({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId,
      provider: "google",
      accountEmail: `${resourceId}@example.com`,
      credentials: "not read: the connection needs reconnecting first",
      grantedScopes: "",
      status: "needs_reconnect",
    }))
  );
const movedEntries = (clinic: ClinicType) =>
  db
    .select({ payload: activity.payload, actorUserId: activity.actorUserId })
    .from(activity)
    .where(and(eq(activity.organizationId, clinic.business), eq(activity.type, "booking_moved")));

beforeAll(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests never call Google or Resend.");
  });
  vi.spyOn(console, "warn").mockImplementation(() => {}); // the clinics have no email set up
});

afterAll(async () => {
  await bookingEventMoves.settled(); // no Google work outlives the database
  await workDueJobs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete(organization).where(like(organization.slug, `test-moving-%-${tag}-dev`));
  await db.$client.end();
});

describe("moving a booking", () => {
  test("a move changes the times, releases the old rows, holds the new ones and writes one entry", async () => {
    const clinic = await makeClinic("moves");
    const response = await move(clinic.janesBooking, at(11), clinic.ana);

    expect(response.status).toBe(200);
    const { booking: view } = (await response.json()) as {
      booking: { startsAt: string; canMove: boolean };
    };
    expect(view.startsAt).toBe(at(11));
    expect(view.canMove).toBe(true);
    expect(await bookingRow(clinic.janesBooking)).toMatchObject({
      startsAt: new Date(at(11)),
      personId: clinic.ana,
      sequence: 1,
      status: "confirmed",
    });
    const rows = await heldRows(clinic.janesBooking);
    expect(rows.filter((row) => row.status === "active").map((row) => row.startsAt)).toEqual([
      new Date(at(11)),
    ]);
    expect(rows.filter((row) => row.status === "cancelled").map((row) => row.startsAt)).toEqual([
      new Date(at(9)),
    ]);
    expect(await movedEntries(clinic)).toEqual([
      {
        payload: {
          bookingId: clinic.janesBooking,
          fromStartsAt: at(9),
          toStartsAt: at(11),
          fromPersonId: clinic.ana,
          toPersonId: clinic.ana,
          sequence: 1,
        },
        actorUserId: null,
      },
    ]);
  });

  test("moving into a time overlapping the old one works", async () => {
    const clinic = await makeClinic("overlap");
    const response = await move(clinic.janesBooking, at(9, 30), clinic.ana);

    expect(response.status).toBe(200);
    expect((await bookingRow(clinic.janesBooking)).startsAt).toEqual(new Date(at(9, 30)));
  });

  test("moving to another person changes the person and holds their time", async () => {
    const clinic = await makeClinic("person");
    const response = await move(clinic.janesBooking, at(10), clinic.mei);

    expect(response.status).toBe(200);
    expect((await bookingRow(clinic.janesBooking)).personId).toBe(clinic.mei);
    const active = (await heldRows(clinic.janesBooking)).filter((row) => row.status === "active");
    expect(active).toEqual([
      { resourceId: clinic.mei, startsAt: new Date(at(10)), status: "active" },
    ]);
  });

  test("a move in a room takes the room again at the new time", async () => {
    const clinic = await makeClinic("room", { withRoom: true });
    const response = await move(clinic.janesBooking, at(9, 30), clinic.ana); // overlaps her own room time

    expect(response.status).toBe(200);
    const active = (await heldRows(clinic.janesBooking)).filter((row) => row.status === "active");
    expect(active.map((row) => row.resourceId).sort()).toEqual([clinic.ana, clinic.room].sort());
    expect(active.every((row) => row.startsAt.getTime() === new Date(at(9, 30)).getTime())).toBe(
      true
    );
  });

  test("any available moves to whoever is free at the new time", async () => {
    const clinic = await makeClinic("anyone");
    await book(clinic, clinic.ana, 11); // Ana is taken at 11:00
    const response = await move(clinic.janesBooking, at(11)); // any available

    expect(response.status).toBe(200);
    expect(await bookingRow(clinic.janesBooking)).toMatchObject({
      startsAt: new Date(at(11)),
      personId: clinic.mei,
    });
  });

  test("any available does not count the booking being moved", async () => {
    const clinic = await makeClinic("own-count");
    // Ana has only Jane's own booking that day, Mei none. Counted, Jane would go to Mei; left out,
    // both have none and the tie goes by name, so she stays with Ana.
    const response = await move(clinic.janesBooking, at(14));

    expect(response.status).toBe(200);
    expect((await bookingRow(clinic.janesBooking)).personId).toBe(clinic.ana);
  });

  test("the free-times route offers the old time again", async () => {
    const clinic = await makeClinic("freed");
    await move(clinic.janesBooking, at(14), clinic.ana);
    const response = await app.request(
      `/public/${clinic.slug}/booking-links/${clinic.facial}/times?from=${day}&to=${day}&person=${clinic.ana}`
    );

    expect(((await response.json()) as { startTimes: string[] }).startTimes).toContain(at(9));
  });

  test("a second press to the same time writes nothing more", async () => {
    const clinic = await makeClinic("twice");
    await move(clinic.janesBooking, at(11), clinic.ana);
    const again = await move(clinic.janesBooking, at(11), clinic.ana);
    const anyone = await move(clinic.janesBooking, at(11)); // any available, already there

    expect(again.status).toBe(200);
    expect(anyone.status).toBe(200);
    expect((await bookingRow(clinic.janesBooking)).sequence).toBe(1);
    expect(await movedEntries(clinic)).toHaveLength(1);
  });

  test("a time taken meanwhile is refused and nothing changes", async () => {
    const clinic = await makeClinic("taken");
    await book(clinic, clinic.ana, 13); // someone else takes Ana's 13:00
    const response = await move(clinic.janesBooking, at(13), clinic.ana);

    expect(response.status).toBe(409);
    expect(await codeOf(response)).toBe("time_taken");
    expect(await bookingRow(clinic.janesBooking)).toMatchObject({
      startsAt: new Date(at(9)),
      sequence: 0,
    });
    expect(
      (await heldRows(clinic.janesBooking)).filter((row) => row.status === "active")
    ).toHaveLength(1);
    expect(await movedEntries(clinic)).toEqual([]);
  });

  test("a picked person whose calendar cannot be read answers 503 and nothing changes", async () => {
    const clinic = await makeClinic("unreadable");
    await unreadableCalendars(clinic, [clinic.mei]);
    const response = await move(clinic.janesBooking, at(13), clinic.mei);

    expect(response.status).toBe(503);
    expect(await codeOf(response)).toBe("unavailable");
    expect(await bookingRow(clinic.janesBooking)).toMatchObject({
      startsAt: new Date(at(9)),
      personId: clinic.ana,
      sequence: 0,
    });
    expect(
      (await heldRows(clinic.janesBooking)).filter((row) => row.status === "active")
    ).toHaveLength(1);
    expect(await movedEntries(clinic)).toEqual([]);
  });

  test("any available with every calendar unreadable answers 503, not taken", async () => {
    const clinic = await makeClinic("all-unreadable");
    await unreadableCalendars(clinic, [clinic.ana, clinic.mei]);
    const response = await move(clinic.janesBooking, at(13));

    expect(response.status).toBe(503);
    expect(await codeOf(response)).toBe("unavailable");
    expect(await bookingRow(clinic.janesBooking)).toMatchObject({
      startsAt: new Date(at(9)),
      sequence: 0,
    });
    expect(await movedEntries(clinic)).toEqual([]);
  });

  test("two moves at the same instant to the same time make one", async () => {
    const clinic = await makeClinic("race");
    const answers = await Promise.all([
      move(clinic.janesBooking, at(15), clinic.ana),
      move(clinic.janesBooking, at(15), clinic.ana),
    ]);

    expect(answers.map((answer) => answer.status)).toEqual([200, 200]);
    expect((await bookingRow(clinic.janesBooking)).sequence).toBe(1);
    expect(await movedEntries(clinic)).toHaveLength(1);
    expect(
      (await heldRows(clinic.janesBooking)).filter((row) => row.status === "active")
    ).toHaveLength(1);
  });

  test("a started or cancelled booking is refused", async () => {
    const clinic = await makeClinic("refused");
    const cancelled = await book(clinic, clinic.mei, 11);
    await app.request(`/public/bookings/${makeBookingPageToken(cancelled)}/cancel`, {
      method: "POST",
    });
    await db
      .update(booking)
      .set({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_540_000) })
      .where(eq(booking.id, clinic.janesBooking));

    const cancelledAnswer = await move(cancelled, at(14), clinic.mei);
    const startedAnswer = await move(clinic.janesBooking, at(14), clinic.ana);
    expect(cancelledAnswer.status).toBe(409);
    expect(await codeOf(cancelledAnswer)).toBe("already_cancelled");
    expect(startedAnswer.status).toBe(409);
    expect(await codeOf(startedAnswer)).toBe("already_started");
    expect(await movedEntries(clinic)).toEqual([]);
  });

  test("another business's booking is never touched", async () => {
    const primo = await makeClinic("ours");
    const other = await makeClinic("theirs");
    const othersRowsBefore = await heldRows(other.janesBooking);
    // A person of another business can never be picked for this booking.
    const foreign = await move(primo.janesBooking, at(11), other.ana);
    // A real move of ours, to a time the other business also has booked, leaves theirs alone.
    const ours = await move(primo.janesBooking, at(9, 30), primo.ana);

    expect(foreign.status).toBe(404);
    expect(ours.status).toBe(200);
    expect(await bookingRow(other.janesBooking)).toMatchObject({
      startsAt: new Date(at(9)),
      sequence: 0,
    });
    expect(await heldRows(other.janesBooking)).toEqual(othersRowsBefore);
    expect(await movedEntries(other)).toEqual([]);
  });

  test("nothing in the answer, the log or the timeline payload carries the customer's details", async () => {
    const clinic = await makeClinic("private");
    const log = vi.spyOn(console, "log");
    const warn = vi.mocked(console.warn);
    warn.mockClear();
    const response = await move(clinic.janesBooking, at(11), clinic.ana);
    const refused = await move(clinic.janesBooking, at(11), clinic.mei); // a refusal says nothing either
    const said = [
      await response.text(),
      JSON.stringify(await movedEntries(clinic)),
      JSON.stringify(log.mock.calls),
      JSON.stringify(warn.mock.calls),
      await refused.text(),
    ].join("\n");

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    for (const detail of [jane.name, jane.email, jane.phone, jane.location, jane.details]) {
      expect(said).not.toContain(detail);
    }
  });

  test("a booking whose service was switched off can still move, while new bookings cannot", async () => {
    const clinic = await makeClinic("switched-off");
    await db.update(bookingLink).set({ active: false }).where(eq(bookingLink.id, clinic.facial));
    const formTimes = await app.request(
      `/public/${clinic.slug}/booking-links/${clinic.facial}/times?from=${day}&to=${day}`
    );
    const moveTimes = await app.request(
      `/public/bookings/${makeBookingPageToken(clinic.janesBooking)}/times?from=${day}&to=${day}`
    );
    const moved = await move(clinic.janesBooking, at(11), clinic.ana);

    expect(formTimes.status).toBe(404); // a new booking needs the service switched on
    expect(moveTimes.status).toBe(200);
    expect(((await moveTimes.json()) as { startTimes: string[] }).startTimes).toContain(at(11));
    expect(moved.status).toBe(200);
  });

  test("a body that is not JSON, or too large, is refused in the same shape", async () => {
    const clinic = await makeClinic("bodies");
    const url = `/public/bookings/${makeBookingPageToken(clinic.janesBooking)}/move`;
    const notJson = await app.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const tooLarge = await app.request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: at(11), personId: null, padding: "x".repeat(5000) }),
    });

    expect(notJson.status).toBe(400);
    expect(await codeOf(notJson)).toBe("bad_request");
    expect(tooLarge.status).toBe(413);
    expect(await codeOf(tooLarge)).toBe("bad_request");
    expect((await bookingRow(clinic.janesBooking)).sequence).toBe(0);
  });

  test("a bad link or a start that is not a time moves nothing", async () => {
    const clinic = await makeClinic("bad");
    const badLink = await app.request("/public/bookings/made-up/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startsAt: at(11), personId: null }),
    });
    const badStart = await move(clinic.janesBooking, "Thursday morning");

    expect(badLink.status).toBe(404);
    expect(badStart.status).toBe(400);
    expect((await bookingRow(clinic.janesBooking)).sequence).toBe(0);
  });
});
