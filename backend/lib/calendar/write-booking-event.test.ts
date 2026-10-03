// The booking's event in the booked person's Google, against the local database with Google faked:
// no test ever reaches Google. Every business here is a throwaway carrying this run's tag, removed
// after (its rows go with it).

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL, the token key and the Google values.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking event tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  calendarConnection,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { decryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { bookTime } = await import("../booking/book-time.js");
const { bookingEventWrites } = await import("../booking/booking-event-writes.js");
const { writeBookingEvent } = await import("./write-booking-event.js");
const { saveCalendarConnection } = await import("./save-calendar-connection.js");
const { CalendarReconnectNeededError } = await import("./calendar-reconnect-needed-error.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton

// Google's side, faked: the answers each test sets, and every call made.
type AnswerType = (init?: RequestInit) => Response | Promise<Response>;
let tokenAnswer: AnswerType;
let eventAnswer: AnswerType;
const calls: { url: string; authorization: string | null; body: string }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// A clinic of its own: Ana does interior estimates (60 minutes, 15 after), bookable Mondays 9 to 12.
async function makeClinic(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({ id: business, name, slug: `test-event-${name}-${tag}` });
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
  const [ana, estimate] = [id(), id()];
  await db
    .insert(resource)
    .values({ id: ana, organizationId: business, name: "Ana", kind: "person" });
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
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: ana });
  return { business, ana, estimate };
}

type ClinicType = Awaited<ReturnType<typeof makeClinic>>;

const connect = (clinic: ClinicType, expiresInMs = 60 * 60 * 1000) =>
  saveCalendarConnection({
    organizationId: clinic.business,
    resourceId: clinic.ana,
    accountEmail: `ana-${clinic.business.slice(0, 8)}-${tag}@gmail.com`,
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken: "1//saved-refresh",
      accessToken: "ya29.saved-access",
      accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
  });

// Booked, then Google's write waited for: the customer's answer does not wait for it, these tests do.
const book = async (clinic: ClinicType, changes: Partial<Parameters<typeof bookTime>[0]> = {}) => {
  const result = await bookTime({
    organizationId: clinic.business,
    bookingLinkId: clinic.estimate,
    personId: clinic.ana,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0101" },
    location: "12 Main Street, Calgary",
    details: "Two bedrooms, ceilings too",
    source: "widget",
    actorUserId: null,
    now: new Date("2026-10-02T14:00:00Z"),
    ...changes,
  });
  await bookingEventWrites.settled();
  return result;
};

const bookedId = async (
  clinic: ClinicType,
  changes: Partial<Parameters<typeof bookTime>[0]> = {}
) => {
  const result = await book(clinic, changes);
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
};

const eventIdOf = async (bookingId: string) =>
  (
    await db.select({ id: booking.calendarEventId }).from(booking).where(eq(booking.id, bookingId))
  )[0]?.id;

// The id Google is given: the booking's own, without its dashes.
const googleIdOf = (bookingId: string) => bookingId.replace(/-/g, "");

const eventCalls = () => calls.filter((call) => call.url.endsWith("/calendars/primary/events"));

beforeEach(() => {
  calls.length = 0;
  tokenAnswer = () =>
    json({ access_token: "ya29.fresh-access", expires_in: 3599, token_type: "Bearer" });
  eventAnswer = () => json({ id: "evt-123" });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({
      url,
      authorization: new Headers(init?.headers).get("Authorization"),
      body: String(init?.body),
    });
    if (url === "https://oauth2.googleapis.com/token") return tokenAnswer(init);
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") {
      return json({ calendars: { primary: { busy: [] } } });
    }
    if (url === "https://www.googleapis.com/calendar/v3/calendars/primary/events")
      return eventAnswer(init);
    throw new Error(`A test tried to reach ${url}.`);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await bookingEventWrites.settled();
  await db.delete(organization).where(like(organization.slug, `test-event-%-${tag}`));
  await db.$client.end();
});

describe("the booking's event in Google", () => {
  test("the event's title, address, description, times and zone", async () => {
    const clinic = await makeClinic("content");
    await connect(clinic);
    const id = await bookedId(clinic);

    const [call] = eventCalls();
    expect(call.authorization).toBe("Bearer ya29.saved-access");
    expect(JSON.parse(call.body)).toEqual({
      id: googleIdOf(id),
      summary: "Interior estimate: Jane Doe",
      location: "12 Main Street, Calgary",
      description: `Phone: 403 555 0101\nEmail: jane-${tag}@example.com\n\nTwo bedrooms, ceilings too`,
      // The appointment itself, 9:00 to 10:00, not its 15 after.
      start: { dateTime: "2026-10-05T15:00:00.000Z", timeZone: "America/Edmonton" },
      end: { dateTime: "2026-10-05T16:00:00.000Z", timeZone: "America/Edmonton" },
    }); // and no attendees: Google invites nobody
  });

  test("the customer's answer does not wait for Google", async () => {
    const clinic = await makeClinic("no-wait");
    await connect(clinic);
    let answerGoogle = () => {};
    const googleAnswered = new Promise<void>((resolve) => (answerGoogle = resolve));
    eventAnswer = async () => {
      await googleAnswered; // Google is slow: it answers only when the test lets it
      return json({ id: "evt-slow" });
    };

    const result = await bookTime({
      organizationId: clinic.business,
      bookingLinkId: clinic.estimate,
      personId: clinic.ana,
      startsAt: NINE,
      requestKey: randomUUID(),
      customer: { name: "Jane Doe", email: `jane-${tag}@example.com` },
      location: "12 Main Street, Calgary",
      details: null,
      source: "widget",
      actorUserId: null,
      now: new Date("2026-10-02T14:00:00Z"),
    });
    if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
    expect(await eventIdOf(result.booking.id)).toBeNull(); // answered while Google still works

    answerGoogle();
    await bookingEventWrites.settled();
    expect(await eventIdOf(result.booking.id)).toBe("evt-slow");
  });

  test("the event's id is saved on the booking", async () => {
    const clinic = await makeClinic("saved");
    await connect(clinic);
    expect(await eventIdOf(await bookedId(clinic))).toBe("evt-123");
  });

  test("no connection makes no call to Google", async () => {
    const clinic = await makeClinic("unconnected");
    const id = await bookedId(clinic);

    expect(calls).toEqual([]);
    expect(await eventIdOf(id)).toBeNull();
  });

  test("a Google error keeps the booking and leaves the event empty", async () => {
    const clinic = await makeClinic("google-error");
    await connect(clinic);
    eventAnswer = () => json({ error: { code: 500 } }, 500);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const id = await bookedId(clinic); // booked all the same
    expect(await eventIdOf(id)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("Google refused the event (500)");
    expect(String(warn.mock.calls[0][0])).not.toContain("Jane"); // ids and reasons only
    warn.mockRestore();
  });

  test("a connection needing reconnection, or a timeout, keeps the booking", async () => {
    const clinic = await makeClinic("reconnect");
    const id = await bookedId(clinic); // booked before the calendar went wrong
    await connect(clinic);

    // Google stops answering: the event's own ten-second limit ends the wait.
    const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const limit = new AbortController();
      limit.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));
      return limit.signal;
    });
    eventAnswer = (init) =>
      new Promise((_, reject) => {
        const signal = init?.signal;
        if (!signal) return reject(new Error("The request to Google had no time limit."));
        if (signal.aborted) return reject(signal.reason);
        signal.addEventListener("abort", () => reject(signal.reason));
      });
    try {
      await expect(writeBookingEvent(clinic.business, id)).rejects.toThrow(
        "aborted due to timeout"
      );
      expect(timeout).toHaveBeenCalledWith(10_000);
    } finally {
      timeout.mockRestore();
    }

    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(
        and(
          eq(calendarConnection.organizationId, clinic.business),
          eq(calendarConnection.resourceId, clinic.ana)
        )
      );
    await expect(writeBookingEvent(clinic.business, id)).rejects.toBeInstanceOf(
      CalendarReconnectNeededError
    );

    const [kept] = await db.select().from(booking).where(eq(booking.id, id));
    expect(kept).toMatchObject({ status: "confirmed", calendarEventId: null });
  });

  test("an expired token is refreshed through the one shared helper", async () => {
    const clinic = await makeClinic("refresh");
    const id = await bookedId(clinic); // booked before connecting: only the event write needs a key
    await connect(clinic, 30_000); // under a minute left

    await writeBookingEvent(clinic.business, id);
    expect(calls.filter((call) => call.url === "https://oauth2.googleapis.com/token")).toHaveLength(
      1
    );
    expect(eventCalls()[0].authorization).toBe("Bearer ya29.fresh-access");
    const [row] = await db
      .select()
      .from(calendarConnection)
      .where(eq(calendarConnection.organizationId, clinic.business));
    const saved = JSON.parse(decryptCredentials(row.credentials, readTokenKey(), clinic.ana));
    expect(saved.accessToken).toBe("ya29.fresh-access"); // kept, locked, for the next call
  });

  test("a phone, an email or a note left out leaves its line out", async () => {
    const clinic = await makeClinic("only-given");
    await connect(clinic);
    await bookedId(clinic, {
      customer: { name: "Sam", email: `sam-${tag}@example.com` },
      details: null,
    });

    expect(JSON.parse(eventCalls()[0].body).description).toBe(`Email: sam-${tag}@example.com`);
  });

  test("writing the event again never makes a second one", async () => {
    const clinic = await makeClinic("twice");
    await connect(clinic);
    const id = await bookedId(clinic);

    // Written already: the saved id is the answer and Google is not asked again.
    expect(await writeBookingEvent(clinic.business, id)).toBe("evt-123");
    expect(eventCalls()).toHaveLength(1);
  });

  test("a retry after a lost answer finds the event Google already made", async () => {
    const clinic = await makeClinic("lost-answer");
    await connect(clinic);
    // Google made the event on an earlier try, but its answer never arrived: now it says the id exists.
    eventAnswer = () =>
      json({ error: { code: 409, message: "The requested identifier already exists." } }, 409);
    const id = await bookedId(clinic);

    expect(await eventIdOf(id)).toBe(googleIdOf(id));
  });

  test("a returning customer's new phone reaches this booking's event", async () => {
    const clinic = await makeClinic("returning");
    await connect(clinic);
    // Jane's saved phone is 403 555 0101; this time she gives 403 555 0199.
    await bookedId(clinic);
    calls.length = 0;
    await bookedId(clinic, {
      startsAt: new Date("2026-10-12T15:00:00Z"),
      customer: { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0199" },
    });

    expect(JSON.parse(eventCalls()[0].body).description).toContain("Phone: 403 555 0199");
  });

  test("a cancelled booking gets no event", async () => {
    const clinic = await makeClinic("cancelled");
    const id = await bookedId(clinic);
    await db.update(booking).set({ status: "cancelled" }).where(eq(booking.id, id));
    await connect(clinic);

    expect(await writeBookingEvent(clinic.business, id)).toBeNull();
    expect(eventCalls()).toEqual([]);
  });
});
