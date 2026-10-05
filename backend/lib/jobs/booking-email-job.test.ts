// A booking's emails as jobs (8a.2), against the local database with Resend faked: no test ever
// sends a real email. Every business here is a throwaway carrying this run's tag, removed after.
// Test names match the feature's Simulate page and its planned checks.

import { randomUUID } from "node:crypto";

import { and, eq, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the token key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking email job tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  emailSendingKey,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { encryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { bookTime } = await import("../booking/book-time.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { bookingEventWrites } = await import("../booking/booking-event-writes.js");
const { bookingEventMoves } = await import("../booking/booking-event-moves.js");
const { bookingEventRemovals } = await import("../booking/booking-event-removals.js");
const { jobClock } = await import("./job-clock.js");
const { jobSchema } = await import("./job-schema.js");
const { workDueJobs } = await import("./work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const TEN = new Date("2026-10-05T16:00:00Z");
const ELEVEN = new Date("2026-10-05T17:00:00Z");
const NOW = new Date("2026-10-02T14:00:00Z"); // the Friday before, as vitest.setup.ts pins it
const jane = { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0148" };
const schema = sql.identifier(jobSchema);

// Resend's side, faked: every send it is asked for, and the answer each test sets.
type ResendCallType = { key: string | null; to: string };
let calls: ResendCallType[];
let answer: (call: ResendCallType) => Response;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const failed = () =>
  json({ name: "application_error", statusCode: 500, message: "Resend is down" }, 500);

// A painting business of its own, set up to send: Marco does interior estimates, Mondays 9 to 12.
async function makeBusiness(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({
    id: business,
    name: "Primo Painters",
    slug: `test-emailjob-${name}-${tag}-dev`,
    senderEmail: "bookings@primopainters.com",
    notifyEmail: "office@primopainters.com",
  });
  await db.insert(emailSendingKey).values({
    organizationId: business,
    credentials: encryptCredentials("re_primo_send_key", readTokenKey(), business),
  });
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
  });
  await db
    .insert(bookingLinkResource)
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: marco });
  return { business, marco, estimate };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

// Booked at nine; its emails stay jobs until a test works them.
async function book(business: BusinessType): Promise<string> {
  const result = await bookTime({
    organizationId: business.business,
    bookingLinkId: business.estimate,
    personId: business.marco,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: jane,
    location: "12 Main Street, Calgary",
    details: "",
    source: "widget",
    actorUserId: null,
    now: NOW,
  });
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

// The email jobs still waiting for a booking, by kind, with their tries so far. The library's
// public view hides the payload, so its own table is read.
const jobsOf = async (bookingId: string) =>
  (await db.execute(
    sql`select payload->>'kind' as kind, attempts from ${schema}._private_jobs
        where payload->>'bookingId' = ${bookingId} order by id`
  )) as unknown as { kind: string; attempts: number }[];

// A failed job waits seconds for its next try; the tests do not wait for it.
const makeDue = (bookingId: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now() where payload->>'bookingId' = ${bookingId}`
  );

const sentEntriesOf = async (business: BusinessType) =>
  (
    await db
      .select({ payload: activity.payload })
      .from(activity)
      .where(and(eq(activity.organizationId, business.business), eq(activity.type, "email_sent")))
  ).map((row) => (row.payload as { kind: string }).kind);

beforeEach(() => {
  calls = [];
  let next = 0;
  answer = () => json({ id: `email-${++next}` });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== "https://api.resend.com/emails") throw new Error(`A test tried to reach ${url}.`);
    const body = JSON.parse(String(init?.body)) as { to: string[] };
    const call = { key: new Headers(init?.headers).get("idempotency-key"), to: body.to[0]! };
    calls.push(call);
    return answer(call);
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {}); // the SDK's own line outside production
});

// Each test starts with no job waiting: one that failed on purpose is not the next test's.
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.execute(sql`delete from ${schema}._private_jobs`);
});

afterAll(async () => {
  await bookingEventWrites.settled();
  await bookingEventMoves.settled();
  await bookingEventRemovals.settled();
  await db.delete(organization).where(like(organization.slug, `test-emailjob-%-${tag}-dev`));
  await db.$client.end();
});

describe("a booking's emails as jobs", () => {
  test("a booking, a cancel and a move each leave their email jobs and send exactly today's emails", async () => {
    const business = await makeBusiness("each");
    const id = await book(business);
    expect((await jobsOf(id)).map((job) => job.kind)).toEqual([
      "booking_confirmation",
      "booking_notification",
    ]);
    await workDueJobs();

    expect(await moveBooking({ bookingId: id, startsAt: TEN, personId: null, now: NOW })).toEqual(
      expect.objectContaining({ moved: true })
    );
    expect((await jobsOf(id)).map((job) => job.kind)).toEqual([
      "booking_move",
      "booking_move_notification",
    ]);
    await workDueJobs();

    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: false });
    expect((await jobsOf(id)).map((job) => job.kind)).toEqual([
      "booking_cancellation",
      "booking_cancellation_notification",
    ]);
    await workDueJobs();

    expect(calls.map((call) => call.key)).toEqual([
      `booking-confirmation/${id}`,
      `booking-notification/${id}`,
      `booking-moved/${id}/1`,
      `booking-moved-notification/${id}/1`,
      `booking-cancelled/${id}`,
      `booking-cancelled-notification/${id}`,
    ]);
    expect(await jobsOf(id)).toEqual([]); // every job done and gone
  });

  test("a send that fails once is sent on the retry, under the same key, recorded once", async () => {
    const business = await makeBusiness("retry");
    const id = await book(business);
    let failures = 0;
    answer = (call) =>
      call.to === jane.email && failures++ === 0 ? failed() : json({ id: `email-${calls.length}` });

    await workDueJobs();
    expect(await jobsOf(id)).toEqual([{ kind: "booking_confirmation", attempts: 1 }]);
    await makeDue(id);
    await workDueJobs();

    const janes = calls.filter((call) => call.to === jane.email);
    expect(janes.map((call) => call.key)).toEqual([
      `booking-confirmation/${id}`,
      `booking-confirmation/${id}`,
    ]);
    expect((await sentEntriesOf(business)).sort()).toEqual([
      "booking_confirmation",
      "booking_notification",
    ]);
    expect(await jobsOf(id)).toEqual([]);
  });

  test("the customer's email failing never resends the business's", async () => {
    const business = await makeBusiness("customer-down");
    const id = await book(business);
    answer = (call) => (call.to === jane.email ? failed() : json({ id: "email-business" }));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await workDueJobs();
      await makeDue(id);
    }

    expect(calls.filter((call) => call.to === jane.email)).toHaveLength(3);
    expect(calls.filter((call) => call.to === "office@primopainters.com")).toHaveLength(1);
    expect(await jobsOf(id)).toEqual([{ kind: "booking_confirmation", attempts: 3 }]);
  });

  test("a confirmation still waiting after a move or a cancel is not sent", async () => {
    const business = await makeBusiness("superseded");
    const moved = await book(business);
    await moveBooking({ bookingId: moved, startsAt: TEN, personId: null, now: NOW });
    await workDueJobs(); // the booking's two jobs run after the move

    const cancelled = await book(business);
    await cancelBooking(cancelled, NOW);
    await workDueJobs();

    expect(calls.map((call) => call.key)).toEqual([
      `booking-moved/${moved}/1`,
      `booking-moved-notification/${moved}/1`,
      `booking-cancelled/${cancelled}`,
      `booking-cancelled-notification/${cancelled}`,
    ]);
    expect(await jobsOf(moved)).toEqual([]);
    expect(await jobsOf(cancelled)).toEqual([]);
  });

  test("a move's emails still waiting after a later move are not sent", async () => {
    const business = await makeBusiness("moved-twice");
    const id = await book(business);
    await workDueJobs();
    calls.length = 0;
    await moveBooking({ bookingId: id, startsAt: TEN, personId: null, now: NOW });
    await moveBooking({ bookingId: id, startsAt: ELEVEN, personId: null, now: NOW });
    await workDueJobs(); // the first move's emails run after the second move

    expect(calls.map((call) => call.key)).toEqual([
      `booking-moved/${id}/2`,
      `booking-moved-notification/${id}/2`,
    ]);
    expect(await jobsOf(id)).toEqual([]);
    const lines = vi.mocked(console.warn).mock.calls.map(([line]) => String(line));
    expect(lines).toContain(
      `[email] booking ${id}: booking_move 1 not sent, a later move replaced it`
    );
  });

  test("no email is sent after the appointment has started", async () => {
    const business = await makeBusiness("started");
    const id = await book(business);
    const pinned = jobClock.now;
    jobClock.now = () => new Date(NINE.getTime() + 60_000); // a minute into the appointment
    try {
      await workDueJobs();
    } finally {
      jobClock.now = pinned;
    }

    expect(calls).toEqual([]);
    expect(await jobsOf(id)).toEqual([]); // not a failure: nothing left to try
    const lines = vi.mocked(console.warn).mock.calls.map(([line]) => String(line));
    expect(lines).toEqual([
      `[email] booking ${id}: booking_confirmation not sent, the appointment has started`,
      `[email] booking ${id}: booking_notification not sent, the appointment has started`,
    ]);
  });
});
