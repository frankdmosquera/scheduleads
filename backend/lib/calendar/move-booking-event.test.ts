// A moved booking's event following it in the booked person's Google (feature 7b), against
// the local database with Google faked: no test ever reaches Google. The fake behaves as Google
// does where it matters: an event id once deleted in a calendar is refused there for good.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL, the token key and the Google values.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the event move tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  availabilityRule,
  booking,
  calendarConnection,
  bookingLink,
  bookingLinkResource,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../booking/book-time.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { bookingEventWrites } = await import("../booking/booking-event-writes.js");
const { bookingEventMoves } = await import("../booking/booking-event-moves.js");
const { workDueJobs } = await import("../jobs/work-due-jobs.js");
const { bookingEventRemovals } = await import("../booking/booking-event-removals.js");
const { saveCalendarConnection } = await import("./save-calendar-connection.js");
const { moveBookingEvent } = await import("./move-booking-event.js");

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-02T14:00:00Z"); // Friday 8:00 in Edmonton
const at = (hour: number) => new Date(`2026-10-05T${String(hour + 6).padStart(2, "0")}:00:00Z`); // Monday, Edmonton
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Google's side, faked: every call, the answer a PATCH gets, and each calendar's deleted ids.
type CallType = { method: string; url: string; authorization: string | null; body: unknown };
const calls: CallType[] = [];
let patchAnswer: () => Response | Promise<Response>;
let deleteAnswer: () => Response | Promise<Response>;
const deletedIn = new Map<string, Set<string>>(); // access token -> ids deleted in that calendar

beforeEach(() => {
  calls.length = 0;
  deletedIn.clear();
  patchAnswer = () => new Response("{}", { status: 200 });
  deleteAnswer = () => new Response(null, { status: 204 });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";
    const authorization = new Headers(init?.headers).get("Authorization");
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") {
      return new Response(JSON.stringify({ calendars: { primary: { busy: [] } } }));
    }
    if (!url.startsWith(EVENTS_URL)) throw new Error(`A test tried to reach ${url}.`);
    calls.push({ method, url, authorization, body });
    const deleted = deletedIn.get(authorization ?? "") ?? new Set<string>();
    deletedIn.set(authorization ?? "", deleted);
    if (method === "POST") {
      const id = (body as { id: string }).id;
      if (deleted.has(id)) return new Response("{}", { status: 409 }); // Google keeps a deleted id
      return new Response(JSON.stringify({ id }));
    }
    if (method === "PATCH") return patchAnswer();
    if (method === "DELETE") {
      const answer = await deleteAnswer();
      if (answer.ok) deleted.add(decodeURIComponent(url.slice(EVENTS_URL.length + 1)));
      return answer;
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
});

afterAll(async () => {
  await bookingEventWrites.settled();
  await bookingEventMoves.settled();
  await bookingEventRemovals.settled();
  await workDueJobs();
  await workDueJobs();
  await workDueJobs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete(organization).where(like(organization.slug, `test-event-move-%-${tag}`));
  await db.$client.end();
});

// A clinic of its own: Ana and Mei do facials (60 minutes), Mondays 9:00 to 12:00.
async function makeClinic(name: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {}); // no email set up
  const id = () => randomUUID();
  const business = id();
  await db
    .insert(organization)
    .values({ id: business, name, slug: `test-event-move-${name}-${tag}` });
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
    durationMinutes: 60,
  });
  await db.insert(bookingLinkResource).values([
    { organizationId: business, bookingLinkId: facial, resourceId: ana },
    { organizationId: business, bookingLinkId: facial, resourceId: mei },
  ]);
  return { business, ana, mei, facial };
}

type ClinicType = Awaited<ReturnType<typeof makeClinic>>;

const connect = (clinic: ClinicType, resourceId: string, name: string) =>
  saveCalendarConnection({
    organizationId: clinic.business,
    resourceId,
    accountEmail: `${name}-${clinic.business.slice(0, 8)}-${tag}@gmail.com`,
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken: "1//saved-refresh",
      accessToken: `ya29.${name}`,
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

// Jane's facial with Ana at 9:00, its event written into Ana's Google when she is connected.
async function bookJane(clinic: ClinicType) {
  const result = await bookTime({
    organizationId: clinic.business,
    bookingLinkId: clinic.facial,
    personId: clinic.ana,
    startsAt: at(9),
    requestKey: randomUUID(),
    customer: { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0148" },
    location: "12 Main Street, Calgary",
    details: null,
    source: "widget",
    actorUserId: null,
    now: NOW,
  });
  await bookingEventWrites.settled();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

const moveTo = async (bookingId: string, hour: number, personId: string | null) => {
  const result = await moveBooking({ bookingId, startsAt: at(hour), personId, now: NOW });
  await bookingEventMoves.settled();
  return result;
};
const savedEventId = async (bookingId: string) =>
  (
    await db.select({ id: booking.calendarEventId }).from(booking).where(eq(booking.id, bookingId))
  )[0]?.id;
const base = (bookingId: string) => bookingId.replace(/-/g, "");
const eventCalls = () =>
  calls.map(({ method, url, authorization }) => ({
    method,
    id: url.length > EVENTS_URL.length ? decodeURIComponent(url.slice(EVENTS_URL.length + 1)) : "",
    authorization,
  }));

describe("a moved booking's Google event", () => {
  test("a move patches the event with the new times", async () => {
    const clinic = await makeClinic("patch");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    calls.length = 0;

    expect(await moveTo(janes, 10, clinic.ana)).toEqual({ moved: true, unchanged: false });
    expect(eventCalls()).toEqual([
      { method: "PATCH", id: base(janes), authorization: "Bearer ya29.ana" },
    ]);
    expect(calls[0].body).toMatchObject({
      start: { dateTime: at(10).toISOString(), timeZone: "America/Edmonton" },
      end: { dateTime: at(11).toISOString(), timeZone: "America/Edmonton" },
    });
    expect(await savedEventId(janes)).toBe(base(janes));
  });

  test("an event never written gets written", async () => {
    const clinic = await makeClinic("unwritten");
    const janes = await bookJane(clinic); // nobody connected yet, so no event
    await connect(clinic, clinic.ana, "ana");
    patchAnswer = () => new Response("{}", { status: 404 });

    await moveTo(janes, 10, clinic.ana);
    expect(eventCalls().map((call) => call.method)).toEqual(["PATCH", "POST"]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("a move to another person removes the old person's event and writes the new person's", async () => {
    const clinic = await makeClinic("person");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    calls.length = 0;

    await moveTo(janes, 10, clinic.mei);
    expect(eventCalls()).toEqual([
      { method: "POST", id: "", authorization: "Bearer ya29.mei" },
      { method: "DELETE", id: base(janes), authorization: "Bearer ya29.ana" },
    ]);
    expect((calls[0].body as { id: string }).id).toBe(`${base(janes)}s1`);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("moving back to the first person is not refused", async () => {
    const clinic = await makeClinic("back");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    await moveTo(janes, 10, clinic.mei);
    calls.length = 0;

    await moveTo(janes, 11, clinic.ana); // Ana's calendar once deleted this booking's first id
    const post = calls.find((call) => call.method === "POST");
    expect(post?.authorization).toBe("Bearer ya29.ana");
    expect((post?.body as { id: string }).id).toBe(`${base(janes)}s2`);
    expect(deletedIn.get("Bearer ya29.ana")?.has(`${base(janes)}s2`)).toBe(false);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s2`);
  });

  test("a cancel after a person change removes the event from the new person's calendar", async () => {
    const clinic = await makeClinic("cancel");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    await moveTo(janes, 10, clinic.mei);
    calls.length = 0;

    await cancelBooking(janes, NOW);
    await bookingEventRemovals.settled();
    expect(eventCalls()).toEqual([
      { method: "DELETE", id: `${base(janes)}s1`, authorization: "Bearer ya29.mei" },
    ]);
  });

  test("the new person gets the event even when the first calendar needs reconnecting", async () => {
    const clinic = await makeClinic("reconnect");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(eq(calendarConnection.resourceId, clinic.ana));
    const warn = vi.mocked(console.warn);
    warn.mockClear();
    calls.length = 0;

    await moveTo(janes, 10, clinic.mei);
    expect(eventCalls()).toEqual([{ method: "POST", id: "", authorization: "Bearer ya29.mei" }]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
    expect(warn.mock.calls.filter((args) => args.join(" ").includes(janes))).toHaveLength(1);
  });

  test("the new person gets the event even when the first calendar refuses the removal", async () => {
    const clinic = await makeClinic("refused");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    deleteAnswer = () => new Response("{}", { status: 503 });
    calls.length = 0;

    await moveTo(janes, 10, clinic.mei);
    expect(eventCalls().map((call) => call.method)).toEqual(["POST", "DELETE"]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("a person change with no first calendar still writes the new person's", async () => {
    const clinic = await makeClinic("no-first");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic); // Ana has no calendar: no event yet
    calls.length = 0;

    await moveTo(janes, 10, clinic.mei);
    expect(eventCalls()).toEqual([{ method: "POST", id: "", authorization: "Bearer ya29.mei" }]);
  });

  test("an event found but never saved gets its id saved", async () => {
    const clinic = await makeClinic("unsaved");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await db.update(booking).set({ calendarEventId: null }).where(eq(booking.id, janes));

    await moveTo(janes, 10, clinic.ana); // Google answers the PATCH: the event was there
    expect(await savedEventId(janes)).toBe(base(janes));
  });

  test("two moves at once to the same time move the event once", async () => {
    const clinic = await makeClinic("at-once");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    calls.length = 0;

    await Promise.all([
      moveBooking({ bookingId: janes, startsAt: at(10), personId: clinic.ana, now: NOW }),
      moveBooking({ bookingId: janes, startsAt: at(10), personId: clinic.ana, now: NOW }),
    ]);
    await bookingEventMoves.settled();
    expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  });

  test("a cancelled booking's event is not moved", async () => {
    const clinic = await makeClinic("cancelled");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await db.update(booking).set({ status: "cancelled" }).where(eq(booking.id, janes));
    calls.length = 0;

    expect(await moveBookingEvent(clinic.business, janes, clinic.ana)).toBe("nothing");
    expect(calls).toEqual([]);
  });

  test("no connection makes no call", async () => {
    const clinic = await makeClinic("unconnected");
    const janes = await bookJane(clinic);

    await moveTo(janes, 10, clinic.mei);
    expect(calls).toEqual([]);
  });

  test("the call carries the person's own access key", async () => {
    const clinic = await makeClinic("key");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    calls.length = 0;

    await moveTo(janes, 10, clinic.ana);
    expect(calls.map((call) => call.authorization)).toEqual(["Bearer ya29.ana"]);
  });

  test("a Google error keeps the move and logs one line", async () => {
    const clinic = await makeClinic("error");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    const warn = vi.mocked(console.warn);
    warn.mockClear();
    patchAnswer = () => new Response("{}", { status: 500 });

    expect(await moveTo(janes, 10, clinic.ana)).toEqual({ moved: true, unchanged: false });
    const [row] = await db
      .select({ startsAt: booking.startsAt })
      .from(booking)
      .where(eq(booking.id, janes));
    expect(row.startsAt).toEqual(at(10));
    const lines = warn.mock.calls
      .map((args) => args.join(" "))
      .filter((line) => line.includes(janes));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain("Jane");
    expect(lines[0]).not.toContain("12 Main Street");
  });

  test("a second press to the same time makes no call", async () => {
    const clinic = await makeClinic("twice");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await moveTo(janes, 10, clinic.ana);
    calls.length = 0;

    expect(await moveTo(janes, 10, clinic.ana)).toEqual({ moved: true, unchanged: true });
    expect(calls).toEqual([]);
  });

  test("the move's answer does not wait for Google", async () => {
    const clinic = await makeClinic("no-wait");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    let answer!: () => void;
    patchAnswer = () =>
      new Promise((resolve) => {
        answer = () => resolve(new Response("{}", { status: 200 }));
      });

    const result = await moveBooking({
      bookingId: janes,
      startsAt: at(10),
      personId: clinic.ana,
      now: NOW,
    });
    expect(result).toEqual({ moved: true, unchanged: false }); // answered while Google still waits
    await vi.waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    answer();
    await bookingEventMoves.settled();
  });
});
