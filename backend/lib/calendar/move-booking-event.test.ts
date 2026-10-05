// A moved booking's event following it in the booked person's Google (feature 7b), against
// the local database with Google faked: no test ever reaches Google. The fake behaves as Google
// does where it matters: an event id once deleted in a calendar is refused there for good.

import { randomUUID } from "node:crypto";

import { eq, like, sql } from "drizzle-orm";
import { runOnce } from "graphile-worker";
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
const { workDueJobs } = await import("../jobs/work-due-jobs.js");
const { jobNames } = await import("../jobs/job-names.js");
const { jobTasks } = await import("../jobs/job-tasks.js");
const { jobRunnerOptions } = await import("../jobs/job-runner-options.js");
const { jobSchema } = await import("../jobs/job-schema.js");
const { jobClock } = await import("../jobs/job-clock.js");
const { saveCalendarConnection } = await import("./save-calendar-connection.js");
const { moveBookingEvent } = await import("./move-booking-event.js");

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-02T14:00:00Z"); // Friday 8:00 in Edmonton
const at = (hour: number) => new Date(`2026-10-05T${String(hour + 6).padStart(2, "0")}:00:00Z`); // Monday, Edmonton
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Google's side, faked: every call, the events each calendar holds and the ids it has deleted,
// and the answers a test sets. A held write is taken by Google first, as a slow answer is.
type CallType = { method: string; url: string; authorization: string | null; body: unknown };
const calls: CallType[] = [];
let patchAnswer: (() => Response | Promise<Response>) | null; // null: as Google, by its events
let deleteAnswer: () => Response | Promise<Response>;
let postFails: (authorization: string | null) => boolean; // refused, nothing written
let postHold: (authorization: string | null) => Promise<void> | null; // written, answer late
// Taken by Google, then answered with an error, as when its answer is lost: a write or update.
let takenThenFails: (method: string) => boolean;
const liveIn = new Map<string, Map<string, string>>(); // access token -> event id -> start
const deletedIn = new Map<string, Set<string>>(); // access token -> ids deleted in that calendar

beforeEach(() => {
  calls.length = 0;
  liveIn.clear();
  deletedIn.clear();
  patchAnswer = null;
  deleteAnswer = () => new Response(null, { status: 204 });
  postFails = () => false;
  postHold = () => null;
  takenThenFails = () => false;
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
    const key = authorization ?? "";
    const live = liveIn.get(key) ?? new Map<string, string>();
    liveIn.set(key, live);
    const deleted = deletedIn.get(key) ?? new Set<string>();
    deletedIn.set(key, deleted);
    const start = (body as { start?: { dateTime: string } } | null)?.start?.dateTime ?? "";
    if (method === "POST") {
      const id = (body as { id: string }).id;
      if (postFails(authorization)) return new Response("{}", { status: 503 });
      if (deleted.has(id) || live.has(id)) return new Response("{}", { status: 409 }); // Google keeps a deleted id
      live.set(id, start);
      await postHold(authorization);
      if (takenThenFails(method)) return new Response("{}", { status: 503 });
      return new Response(JSON.stringify({ id }));
    }
    const id = decodeURIComponent(url.slice(EVENTS_URL.length + 1));
    if (method === "PATCH") {
      const answer = patchAnswer
        ? await patchAnswer()
        : new Response("{}", { status: live.has(id) ? 200 : 404 });
      if (answer.ok && live.has(id)) live.set(id, start);
      if (answer.ok && takenThenFails(method)) return new Response("{}", { status: 503 });
      return answer;
    }
    if (method === "DELETE") {
      const answer = await deleteAnswer();
      if (answer.ok) {
        live.delete(id);
        deleted.add(id);
      }
      return answer;
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
});

// The events a person's calendar holds now, with their starts.
const liveEvents = (name: string) =>
  [...(liveIn.get(`Bearer ya29.${name}`) ?? new Map<string, string>())].map(([id, start]) => ({
    id,
    start,
  }));

afterAll(async () => {
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

// The event's jobs only: the booking's emails would add lines of their own.
const eventJobTasks = {
  [jobNames.bookingEventWrite]: jobTasks[jobNames.bookingEventWrite],
  [jobNames.bookingEventMove]: jobTasks[jobNames.bookingEventMove],
  [jobNames.bookingEventRemove]: jobTasks[jobNames.bookingEventRemove],
};
const workEventJobs = () => workDueJobs(eventJobTasks);

// A failed job waits seconds for its next try; the tests do not wait for it.
const makeDue = (bookingId: string) =>
  db.execute(
    sql`update ${sql.identifier(jobSchema)}._private_jobs set run_at = now()
        where payload->>'bookingId' = ${bookingId}`
  );
const eventJobsOf = async (bookingId: string) =>
  (await db.execute(
    sql`select attempts from ${sql.identifier(jobSchema)}._private_jobs
        where payload->>'bookingId' = ${bookingId} and payload->>'kind' is null`
  )) as unknown as { attempts: number }[];

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
  await workEventJobs();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

const moveTo = async (bookingId: string, hour: number, personId: string | null) => {
  const result = await moveBooking({ bookingId, startsAt: at(hour), personId, now: NOW });
  await workEventJobs();
  return result;
};
// The calls sorted, where two jobs' order is not promised.
const sortedById = <T extends { id: string; method: string; authorization: string | null }>(
  list: T[]
) => {
  const key = (call: T) => `${call.method} ${call.id} ${call.authorization}`;
  return [...list].sort((a, b) => key(a).localeCompare(key(b)));
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

    await moveTo(janes, 10, clinic.ana); // with no id saved, the last write's id is taken out
    expect(
      eventCalls()
        .map((call) => call.method)
        .sort()
    ).toEqual(["DELETE", "POST"]);
    expect(liveEvents("ana")).toEqual([{ id: `${base(janes)}s1`, start: at(10).toISOString() }]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("a move to another person removes the old person's event and writes the new person's", async () => {
    const clinic = await makeClinic("person");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    calls.length = 0;

    await moveTo(janes, 10, clinic.mei);
    // Two jobs, each on its own: their order is not promised (decision 5).
    expect(sortedById(eventCalls())).toEqual([
      { method: "DELETE", id: base(janes), authorization: "Bearer ya29.ana" },
      { method: "POST", id: "", authorization: "Bearer ya29.mei" },
    ]);
    const post = calls.find((call) => call.method === "POST");
    expect((post?.body as { id: string }).id).toBe(`${base(janes)}s1`);
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
    await workEventJobs();
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
    expect(
      eventCalls()
        .map((call) => call.method)
        .sort()
    ).toEqual(["DELETE", "POST"]);
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

  test("an event written but never saved is replaced, never left behind", async () => {
    const clinic = await makeClinic("unsaved");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await db.update(booking).set({ calendarEventId: null }).where(eq(booking.id, janes));

    await moveTo(janes, 10, clinic.ana);
    expect(liveEvents("ana")).toEqual([{ id: `${base(janes)}s1`, start: at(10).toISOString() }]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
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
    await workEventJobs();
    expect(calls.filter((call) => call.method === "PATCH")).toHaveLength(1);
  });

  test("a cancelled booking's event is not moved", async () => {
    const clinic = await makeClinic("cancelled");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await db.update(booking).set({ status: "cancelled" }).where(eq(booking.id, janes));
    calls.length = 0;

    expect(await moveBookingEvent(clinic.business, janes)).toBe("nothing");
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
    calls.length = 0;
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
    expect(result).toEqual({ moved: true, unchanged: false }); // answered before Google is asked
    expect(calls).toEqual([]);
    const working = workEventJobs();
    await vi.waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    answer();
    await working;
  });
});

describe("a booking's Google event as jobs", () => {
  // Jane's facial with Ana at 9:00, its event's job not worked yet.
  async function bookJaneUnwritten(clinic: ClinicType) {
    const result = await bookTime({
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      personId: clinic.ana,
      startsAt: at(9),
      requestKey: randomUUID(),
      customer: { name: "Jane Doe", email: `jane-${tag}@example.com` },
      location: "12 Main Street, Calgary",
      details: null,
      source: "widget",
      actorUserId: null,
      now: NOW,
    });
    if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
    return result.booking.id;
  }

  // Holds the next write into a person's calendar mid-call: Google has the event, its answer waits.
  function holdNextWrite(name: string) {
    let reach!: () => void;
    let release!: () => void;
    const reached = new Promise<void>((resolve) => (reach = resolve));
    let used = false;
    postHold = (authorization) => {
      if (used || authorization !== `Bearer ya29.${name}`) return null;
      used = true;
      reach();
      return new Promise<void>((resolve) => (release = resolve));
    };
    return { reached, release: () => release() };
  }

  const move = (bookingId: string, hour: number, personId: string) =>
    moveBooking({ bookingId, startsAt: at(hour), personId, now: NOW });
  const event = (bookingId: string, sequence: number, hour: number) => ({
    id: sequence === 0 ? base(bookingId) : `${base(bookingId)}s${sequence}`,
    start: at(hour).toISOString(),
  });

  test("a move whose first calendar needs reconnecting removes the old event once it is reconnected", async () => {
    const clinic = await makeClinic("f149");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(eq(calendarConnection.resourceId, clinic.ana));

    await moveTo(janes, 10, clinic.mei); // Mei gets hers; Ana's removal fails and waits
    expect(liveEvents("mei")).toEqual([event(janes, 1, 10)]);
    expect(liveEvents("ana")).toEqual([event(janes, 0, 9)]);
    expect(await eventJobsOf(janes)).toEqual([{ attempts: 1 }]);

    await connect(clinic, clinic.ana, "ana"); // Ana reconnects
    await makeDue(janes);
    await workEventJobs();
    expect(liveEvents("ana")).toEqual([]);
    expect(await eventJobsOf(janes)).toEqual([]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("two moves close together leave one event, at the last time, in the last person's calendar", async () => {
    const clinic = await makeClinic("f150");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic); // Ana's event, 9:00

    await move(janes, 10, clinic.mei);
    const meis = holdNextWrite("mei");
    const working = workEventJobs();
    await meis.reached;
    await move(janes, 11, clinic.ana); // back to Ana while Mei's write is mid-call
    meis.release();
    await working;
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([event(janes, 2, 11)]);
    expect(liveEvents("mei")).toEqual([]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s2`);
  });

  test("two moves with the same person during the booking's write leave one event", async () => {
    const clinic = await makeClinic("same-twice");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJaneUnwritten(clinic);

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached; // Google has the 9:00 event, its id not saved
    await move(janes, 10, clinic.ana);
    await move(janes, 11, clinic.ana);
    write.release();
    await working;
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([event(janes, 2, 11)]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s2`);
  });

  test("quick moves ask Google to remove one event per move, and leave one", async () => {
    const clinic = await makeClinic("quick-moves");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJaneUnwritten(clinic);
    calls.length = 0;

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached; // nothing saved while Jane keeps moving
    const people = [clinic.mei, clinic.ana, clinic.ana, clinic.mei, clinic.ana];
    for (const [index, personId] of people.entries()) {
      await move(janes, index % 2 === 0 ? 10 : 11, personId);
    }
    write.release();
    await working;
    await workEventJobs();

    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(people.length);
    expect(liveEvents("ana")).toEqual([event(janes, 5, 10)]);
    expect(liveEvents("mei")).toEqual([]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s5`);
  });

  test("a cancel during a same-person move's write leaves no event", async () => {
    const clinic = await makeClinic("same-cancel");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJaneUnwritten(clinic);

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached;
    await move(janes, 10, clinic.ana);
    const moved = holdNextWrite("ana");
    write.release();
    await moved.reached; // the move's own write is mid-call
    await cancelBooking(janes, NOW);
    moved.release();
    await working;
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([]);
    expect(await savedEventId(janes)).toBeNull();
  });

  test("a cancel while a same-person move's write waits for its retry leaves no event", async () => {
    const clinic = await makeClinic("same-retry");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJaneUnwritten(clinic);

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached;
    await move(janes, 10, clinic.ana);
    let failures = 0;
    // The move's own call (after the booking's held write) reaches Google, but its answer fails
    // once: the job waits to retry.
    takenThenFails = () => failures++ === 1;
    write.release();
    await working;
    await cancelBooking(janes, NOW);
    await makeDue(janes);
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([]);
    expect(await eventJobsOf(janes)).toEqual([]);
  });

  test("a move to another person during a same-person move's write leaves one event", async () => {
    const clinic = await makeClinic("same-then-mei");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJaneUnwritten(clinic);

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached;
    await move(janes, 10, clinic.ana);
    const moved = holdNextWrite("ana");
    write.release();
    await moved.reached;
    await move(janes, 11, clinic.mei);
    moved.release();
    await working;
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([]);
    expect(liveEvents("mei")).toEqual([event(janes, 2, 11)]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s2`);
  });

  test("a failed write into the new person's calendar still lets the old event be removed", async () => {
    const clinic = await makeClinic("f169");
    await connect(clinic, clinic.ana, "ana");
    await connect(clinic, clinic.mei, "mei");
    const janes = await bookJane(clinic);
    let meiFailures = 0;
    postFails = (authorization) => authorization === "Bearer ya29.mei" && meiFailures++ === 0;

    await moveTo(janes, 10, clinic.mei);
    expect(liveEvents("ana")).toEqual([]);
    expect(liveEvents("mei")).toEqual([]);
    expect(await savedEventId(janes)).toBeNull();

    await makeDue(janes);
    await workEventJobs(); // the write's retry
    expect(liveEvents("mei")).toEqual([event(janes, 1, 10)]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
    expect(await eventJobsOf(janes)).toEqual([]);
  });

  test("a cancel right after booking, before the event's id is saved, still removes it", async () => {
    const clinic = await makeClinic("early-cancel");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJaneUnwritten(clinic);

    const write = holdNextWrite("ana");
    const working = workEventJobs();
    await write.reached;
    await cancelBooking(janes, NOW); // the write is still in Google's hands
    write.release();
    await working;
    await workEventJobs();

    expect(liveEvents("ana")).toEqual([]);
    expect(await savedEventId(janes)).toBeNull();
  });

  test("two of one booking's jobs never run at the same time", async () => {
    const clinic = await makeClinic("lane");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    calls.length = 0;
    let answerAna!: () => void;
    patchAnswer = () =>
      new Promise((resolve) => (answerAna = () => resolve(new Response("{}", { status: 200 }))));

    await move(janes, 10, clinic.ana);
    const first = workEventJobs();
    await vi.waitFor(() => expect(calls.some((call) => call.method === "PATCH")).toBe(true));
    await cancelBooking(janes, NOW); // its removal waits in the same lane
    await runOnce(jobRunnerOptions(eventJobTasks)); // a second runner finds nothing it may take
    expect(eventCalls().map((call) => call.method)).toEqual(["PATCH"]);

    answerAna();
    await first;
    await workEventJobs();
    expect(eventCalls().map((call) => call.method)).toEqual(["PATCH", "DELETE"]);
    expect(liveEvents("ana")).toEqual([]);
  });

  test("a booking moved before its event was written gets one event, at the moved time", async () => {
    const clinic = await makeClinic("moved-early");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJaneUnwritten(clinic);

    await moveTo(janes, 10, clinic.ana); // the booking's own write is replaced by the move's
    expect(liveEvents("ana")).toEqual([event(janes, 1, 10)]);
    expect(await savedEventId(janes)).toBe(`${base(janes)}s1`);
  });

  test("no event is changed once the appointment has started", async () => {
    const clinic = await makeClinic("started");
    await connect(clinic, clinic.ana, "ana");
    const janes = await bookJane(clinic);
    await move(janes, 10, clinic.ana);
    calls.length = 0;
    const warn = vi.mocked(console.warn);
    warn.mockClear();
    const pinned = jobClock.now;
    jobClock.now = () => new Date(at(10).getTime() + 60_000); // a minute into the appointment
    try {
      await workEventJobs();
    } finally {
      jobClock.now = pinned;
    }

    expect(calls).toEqual([]);
    expect(await eventJobsOf(janes)).toEqual([]); // not a failure: nothing left to try
    expect(warn.mock.calls.map(([line]) => String(line))).toEqual([
      `[calendar] booking ${janes}: event not changed, the appointment has started`,
    ]);
  });
});
