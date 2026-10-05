// The times a customer could move their booking to (feature 7b), through the real app against the
// local database. A clinic of this file's own, removed after. Google is faked where a test needs a
// calendar; anything else that reaches for the network fails the test.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the link key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking move times tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const {
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  commitment,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../lib/booking/book-time.js");
const { workDueJobs } = await import("../lib/jobs/work-due-jobs.js");
const { makeBookingPageToken } = await import("../lib/booking/booking-page-token.js");
const { saveCalendarConnection } = await import("../lib/calendar/save-calendar-connection.js");
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

// A clinic of its own: Ana and Mei do facials (60 minutes, a start every 30) in Room 3, every day
// 9:00 to 17:00. Jane has 9:00 with Ana, Bob 13:00 with Mei; each holds Room 3 too.
async function makeClinic(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({
    id: business,
    name: "Riverbend Clinic",
    slug: `test-move-${name}-${tag}-dev`,
  });
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
  await db.insert(bookingLinkResource).values([
    { organizationId: business, bookingLinkId: facial, resourceId: ana },
    { organizationId: business, bookingLinkId: facial, resourceId: mei },
    { organizationId: business, bookingLinkId: facial, resourceId: room },
  ]);
  const clinic = { business, ana, mei, room, facial };
  const janesBooking = await book(clinic, ana, 9, "Jane Doe");
  const bobsBooking = await book(clinic, mei, 13, "Bob Smith");
  return { ...clinic, janesBooking, bobsBooking };
}

type ClinicType = { business: string; facial: string };

async function book(clinic: ClinicType, personId: string, hour: number, name: string) {
  const result = await bookTime({
    organizationId: clinic.business,
    bookingLinkId: clinic.facial,
    personId,
    startsAt: new Date(at(hour)),
    requestKey: randomUUID(),
    customer: { name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: new Date(),
  });
  await workDueJobs();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

const timesFor = (bookingId: string, person?: string) =>
  app.request(
    `/public/bookings/${makeBookingPageToken(bookingId)}/times?from=${day}&to=${day}${person ? `&person=${person}` : ""}`
  );
const startTimesOf = async (response: Response) =>
  ((await response.json()) as { startTimes: string[] }).startTimes;

// A person's Google connection, saved again by each test that needs it, so no test depends on
// another having run first.
const connect = (resourceId: string, name: string) =>
  saveCalendarConnection({
    organizationId: clinic.business,
    resourceId,
    accountEmail: `${name}-${tag}@gmail.com`,
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken: "1//saved-refresh",
      accessToken: "ya29.saved-access",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

// Google, faked: every connected person's calendar holds these busy blocks.
function fakeGoogleBusy(busy: { start: string; end: string }[]) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== "https://www.googleapis.com/calendar/v3/freeBusy") {
      throw new Error(`A test tried to reach ${url}.`);
    }
    return new Response(JSON.stringify({ calendars: { primary: { busy } } }), {
      headers: { "Content-Type": "application/json" },
    });
  });
}

let clinic: Awaited<ReturnType<typeof makeClinic>>;

beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests reach Google only through the fake.");
  });
  vi.spyOn(console, "warn").mockImplementation(() => {}); // the clinic has no email set up
  vi.spyOn(console, "log").mockImplementation(() => {});
  clinic = await makeClinic("times");
});

afterEach(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests reach Google only through the fake.");
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete(organization).where(like(organization.slug, `test-move-%-${tag}-dev`));
  await db.$client.end();
});

describe("free times for moving a booking", () => {
  test("a time overlapping the booking's own old time is offered", async () => {
    const response = await timesFor(clinic.janesBooking, clinic.ana);

    expect(response.status).toBe(200);
    expect(await startTimesOf(response)).toContain(at(9, 30)); // overlaps her own 9:00 to 10:00
  });

  test("another person who offers the service is offered too, and any available covers everyone", async () => {
    const response = await timesFor(clinic.janesBooking);
    const answer = (await response.json()) as { people: { name: string }[]; startTimes: string[] };

    expect(answer.people.map((person) => person.name)).toEqual(["Ana", "Mei"]);
    expect(answer.startTimes).toContain(at(9, 30));
  });

  test("a room held only by this booking does not block it", async () => {
    // Mei is free at 9:30; only Room 3 is taken then, and only by Jane's own booking.
    expect(await startTimesOf(await timesFor(clinic.janesBooking, clinic.mei))).toContain(
      at(9, 30)
    );
  });

  test("the same time is not offered for another booking of the same service", async () => {
    // For Bob, Jane's booking is real: Room 3 is taken at 9:30, so Mei cannot have it.
    expect(await startTimesOf(await timesFor(clinic.bobsBooking, clinic.mei))).not.toContain(
      at(9, 30)
    );
  });

  test("another booking, time off and the person's Google still block", async () => {
    await db.insert(commitment).values({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId: clinic.ana,
      kind: "time_off",
      startsAt: new Date(at(15)),
      endsAt: new Date(at(16)),
    });
    await connect(clinic.ana, "ana");
    fakeGoogleBusy([
      { start: at(9), end: at(10) }, // Jane's own event
      { start: at(11), end: at(12) }, // Ana's dentist
    ]);
    const anaTimes = await startTimesOf(await timesFor(clinic.janesBooking, clinic.ana));
    const meiTimes = await startTimesOf(await timesFor(clinic.janesBooking, clinic.mei));

    expect(anaTimes).not.toContain(at(11)); // Ana's own Google event
    expect(anaTimes).not.toContain(at(15)); // Ana's time off
    expect(meiTimes).not.toContain(at(13)); // Bob's booking with Mei
  });

  test("the booking's own Google event does not block", async () => {
    await connect(clinic.ana, "ana");
    fakeGoogleBusy([{ start: at(9), end: at(10) }]); // Ana's 9:00 to 10:00 is Jane's own booking
    const anaTimes = await startTimesOf(await timesFor(clinic.janesBooking, clinic.ana));

    expect(anaTimes).toContain(at(9));
    expect(anaTimes).toContain(at(9, 30));
  });

  test("the booking's own hour is crossed off only for its own person", async () => {
    await connect(clinic.ana, "ana");
    await connect(clinic.mei, "mei");
    // Both calendars say 9:00 to 10:00. For Ana that is Jane; for Mei it is something of her own.
    fakeGoogleBusy([{ start: at(9), end: at(10) }]);
    const meiTimes = await startTimesOf(await timesFor(clinic.janesBooking, clinic.mei));

    expect(meiTimes).not.toContain(at(9));
    expect(meiTimes).not.toContain(at(9, 30));
  });

  test("a person whose calendar cannot be read answers 503, never free", async () => {
    await connect(clinic.ana, "ana");
    vi.stubGlobal("fetch", async () => new Response("", { status: 500 })); // Google fails
    const response = await timesFor(clinic.janesBooking, clinic.ana);

    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe("unavailable");
  });

  test("a person who does not offer the service, or another business's, answers 404", async () => {
    const stranger = await app.request(
      `/public/bookings/${makeBookingPageToken(clinic.janesBooking)}/times?from=${day}&to=${day}&person=${clinic.room}`
    );
    const elsewhere = await timesFor(clinic.janesBooking, randomUUID());

    expect(stranger.status).toBe(404); // Room 3 is a place, not a person who can be picked
    expect(elsewhere.status).toBe(404);
    expect(await elsewhere.json()).toEqual(await stranger.json());
  });

  test("a bad link answers 404 with the same body", async () => {
    const token = makeBookingPageToken(clinic.janesBooking);
    const changed = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    const bodies = await Promise.all(
      [changed, "made-up", `${randomUUID()}.${token.split(".")[1]}`].map(async (bad) => {
        const response = await app.request(`/public/bookings/${bad}/times?from=${day}&to=${day}`);
        expect(response.status).toBe(404);
        return response.json();
      })
    );
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
  });

  test("a started or cancelled booking answers 409", async () => {
    fakeGoogleBusy([]); // whoever is connected is free; their event writes simply fail and log
    const cancelled = await book(clinic, clinic.mei, 16, "Cara Lee");
    await app.request(`/public/bookings/${makeBookingPageToken(cancelled)}/cancel`, {
      method: "POST",
    });
    const started = await book(clinic, clinic.mei, 10, "Dan Roe");
    await db
      .update(booking)
      .set({ startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_540_000) })
      .where(eq(booking.id, started));

    const cancelledAnswer = await timesFor(cancelled);
    const startedAnswer = await timesFor(started);
    expect(cancelledAnswer.status).toBe(409);
    expect(((await cancelledAnswer.json()) as { error: { code: string } }).error.code).toBe(
      "already_cancelled"
    );
    expect(startedAnswer.status).toBe(409);
    expect(((await startedAnswer.json()) as { error: { code: string } }).error.code).toBe(
      "already_started"
    );
  });

  test("the answer names the last date the business takes bookings", async () => {
    fakeGoogleBusy([]);
    const response = await timesFor(clinic.janesBooking);
    // Today in the clinic's zone, plus its 60 days ahead, worked out apart from the code.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => Number(parts.find((each) => each.type === type)?.value);
    const lastDate = new Date(Date.UTC(part("year"), part("month") - 1, part("day") + 60))
      .toISOString()
      .slice(0, 10);

    expect(response.status).toBe(200);
    expect(((await response.json()) as { lastDate: string }).lastDate).toBe(lastDate);
  });

  test("nothing in the answer carries the customer's details", async () => {
    const response = await timesFor(clinic.janesBooking);
    const text = await response.text();

    expect(response.headers.get("Cache-Control")).toBe("no-store");
    for (const detail of [jane.name, jane.email, jane.phone, jane.location, jane.details]) {
      expect(text).not.toContain(detail);
    }
  });
});
