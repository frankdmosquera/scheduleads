// A cancelled booking's event leaving the booked person's Google, against the local database with
// Google faked: no test ever reaches Google. Every business here is a throwaway carrying this run's
// tag, removed after (its rows go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL, the token key and the Google values.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the event removal tests");

// Imported after the env is loaded: they read it the moment they load.
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
const { bookTime } = await import("../booking/book-time.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { workDueJobs } = await import("../jobs/work-due-jobs.js");
const { jobNames } = await import("../jobs/job-names.js");
const { jobTasks } = await import("../jobs/job-tasks.js");
const { saveCalendarConnection } = await import("./save-calendar-connection.js");

const tag = randomUUID().slice(0, 8);
const NOW = new Date("2026-10-02T14:00:00Z");
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const TEN = new Date("2026-10-05T16:00:00Z");

// Google's side, faked: the answers each test sets, and every call made.
type AnswerType = () => Response | Promise<Response>;
let deleteAnswer: AnswerType;
const calls: { method: string; url: string; authorization: string | null }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// A business of its own: Ana does interior estimates (60 minutes), Mondays 9 to 12.
async function makeBusiness(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({ id: business, name, slug: `test-removal-${name}-${tag}` });
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
    layout: "month",
    personChoice: "customer_picks",
  });
  await db
    .insert(bookingLinkResource)
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: ana });
  return { business, ana, estimate };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

const connect = (made: BusinessType) =>
  saveCalendarConnection({
    organizationId: made.business,
    resourceId: made.ana,
    accountEmail: `ana-${made.business.slice(0, 8)}-${tag}@gmail.com`,
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken: "1//saved-refresh",
      accessToken: "ya29.saved-access",
      accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    },
  });

// The event's jobs only: the booking's emails would add lines of their own.
const workEventJobs = () =>
  workDueJobs({
    [jobNames.bookingEventWrite]: jobTasks[jobNames.bookingEventWrite],
    [jobNames.bookingEventMove]: jobTasks[jobNames.bookingEventMove],
    [jobNames.bookingEventRemove]: jobTasks[jobNames.bookingEventRemove],
  });

// Booked, with its event written into Ana's Google when she is connected.
async function bookIn(made: BusinessType) {
  const result = await bookTime({
    organizationId: made.business,
    bookingLinkId: made.estimate,
    personId: made.ana,
    startsAt: NINE,
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

const eventIdOf = async (bookingId: string) =>
  (
    await db.select({ id: booking.calendarEventId }).from(booking).where(eq(booking.id, bookingId))
  )[0]?.id;
const statusOf = async (bookingId: string) =>
  (await db.select({ status: booking.status }).from(booking).where(eq(booking.id, bookingId)))[0]
    ?.status;
const googleIdOf = (bookingId: string) => bookingId.replace(/-/g, "");
const deleteCalls = () =>
  calls.filter((call) => call.method === "DELETE").map(({ method, url }) => ({ method, url }));

beforeEach(() => {
  calls.length = 0;
  deleteAnswer = () => new Response(null, { status: 204 });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";
    calls.push({ method, url, authorization: new Headers(init?.headers).get("Authorization") });
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") {
      return json({ calendars: { primary: { busy: [] } } });
    }
    if (url === EVENTS_URL && method === "POST") {
      return json({ id: googleIdOf(JSON.parse(String(init?.body)).id) });
    }
    if (url.startsWith(`${EVENTS_URL}/`) && method === "DELETE") return deleteAnswer();
    if (url.startsWith(`${EVENTS_URL}/`) && method === "PATCH") return json({});
    throw new Error(`A test tried to reach ${method} ${url}.`);
  });
  vi.spyOn(console, "log").mockImplementation(() => {}); // no business here sends email: one line each
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-removal-%-${tag}`));
  await db.$client.end();
});

describe("a cancelled booking's Google event", () => {
  test("a cancel removes the event and clears its id", async () => {
    const made = await makeBusiness("removed");
    await connect(made);
    const bookingId = await bookIn(made);
    expect(await eventIdOf(bookingId)).toBe(googleIdOf(bookingId));

    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(deleteCalls()).toEqual([
      { method: "DELETE", url: `${EVENTS_URL}/${googleIdOf(bookingId)}` },
    ]);
    expect(await eventIdOf(bookingId)).toBeNull();
    // Ana's own key, the one saved with her connection.
    expect(calls.find((call) => call.method === "DELETE")?.authorization).toBe(
      "Bearer ya29.saved-access"
    );
  });

  test("an event already gone counts as removed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const made = await makeBusiness("gone");
    await connect(made);
    const bookingId = await bookIn(made);
    deleteAnswer = () => json({ error: { code: 410 } }, 410);

    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(await eventIdOf(bookingId)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  test("no connection makes no call to Google", async () => {
    const made = await makeBusiness("unconnected");
    const bookingId = await bookIn(made);

    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(calls).toEqual([]);
  });

  test("pressing cancel again makes no second call", async () => {
    const made = await makeBusiness("again");
    await connect(made);
    const bookingId = await bookIn(made);

    await cancelBooking(bookingId, NOW);
    await workEventJobs();
    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(deleteCalls()).toHaveLength(1);
  });

  test("a Google error keeps the cancel, logs one line and leaves the event's id", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const made = await makeBusiness("google-error");
    await connect(made);
    const bookingId = await bookIn(made);
    deleteAnswer = () => json({ error: { code: 500 } }, 500);

    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(await statusOf(bookingId)).toBe("cancelled");
    expect(await eventIdOf(bookingId)).toBe(googleIdOf(bookingId));
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(bookingId);
    expect(line).toContain("Google refused to remove the event (500)");
    expect(line).not.toContain("Jane");
  });

  test("the cancel's answer does not wait for Google", async () => {
    const made = await makeBusiness("no-wait");
    await connect(made);
    const bookingId = await bookIn(made);
    let answerGoogle = () => {};
    const googleAnswered = new Promise<void>((resolve) => (answerGoogle = resolve));
    deleteAnswer = async () => {
      await googleAnswered; // Google is slow: it answers only when the test lets it
      return new Response(null, { status: 204 });
    };

    expect(await cancelBooking(bookingId, NOW)).toEqual({
      cancelled: true,
      alreadyCancelled: false,
    });
    expect(await eventIdOf(bookingId)).toBe(googleIdOf(bookingId)); // answered before Google is asked

    const working = workEventJobs();
    await vi.waitFor(() => expect(deleteCalls()).toHaveLength(1), { timeout: 10_000 }); // Google still at work
    expect(await eventIdOf(bookingId)).toBe(googleIdOf(bookingId));
    answerGoogle();
    await working;
    expect(await eventIdOf(bookingId)).toBeNull();
  });

  test("an event whose id was not saved yet is removed by its own id, and Google's 404 is done", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    deleteAnswer = () => json({ error: { code: 404 } }, 404); // never written, as far as Google knows
    const made = await makeBusiness("unsaved");
    await connect(made);
    const bookingId = await bookIn(made);
    await db.update(booking).set({ calendarEventId: null }).where(eq(booking.id, bookingId));

    await cancelBooking(bookingId, NOW);
    await workEventJobs();

    expect(deleteCalls()).toEqual([
      { method: "DELETE", url: `${EVENTS_URL}/${googleIdOf(bookingId)}` },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  test("a booking still confirmed keeps its event", async () => {
    const made = await makeBusiness("confirmed");
    await connect(made);
    const bookingId = await bookIn(made);

    await moveBooking({ bookingId, startsAt: TEN, personId: made.ana, now: NOW }); // Ana still
    await workEventJobs();
    expect(deleteCalls()).toEqual([]);
    expect(await eventIdOf(bookingId)).toBe(googleIdOf(bookingId));
  });
});
