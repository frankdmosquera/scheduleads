// A booking's confirmation text as a job (feature 8b), against the local database with
// Twilio faked: no test ever sends a real text. Every business here is a throwaway carrying this
// run's tag, removed after.

import { randomInt, randomUUID } from "node:crypto";

import { and, eq, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the link key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking text job tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../../app.js");
const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  member,
  organization,
  pipelineStage,
  resource,
  textSettings,
  user,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../booking/book-time.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { makeBookingPageToken } = await import("../booking/booking-page-token.js");
const { appOrigin } = await import("../auth/auth-server.js");
const { addDays } = await import("../local-time/add-days.js");
const { localDate } = await import("../local-time/local-date.js");
const { jobClock } = await import("./job-clock.js");
const { jobSchema } = await import("./job-schema.js");
const { workDueJobs } = await import("./work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const TEN = new Date("2026-10-05T16:00:00Z");
const NOW = new Date("2026-10-02T14:00:00Z"); // the Friday before, as vitest.setup.ts pins it
const MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json";
const jane = { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0148" };
const schema = sql.identifier(jobSchema);

// Twilio's side, faked: every request, and the answers each test sets.
type TwilioCallType = { method: string; form: Record<string, string> };
let calls: TwilioCallType[];
let sendAnswer: (form: Record<string, string>) => Response;
let listAnswer: () => Response;
const sent = (sid: string) => Response.json({ sid, status: "queued" }, { status: 201 });

// A painting business of its own, open every day 9 to 12: Marco does interior estimates. Its texts
// are on unless a test changes them; each business has a made-up number of its own.
async function makeBusiness(name: string, settings: Record<string, unknown> = {}) {
  const id = () => randomUUID();
  const business = id();
  const slug = `test-textjob-${name}-${tag}-dev`;
  await db.insert(organization).values({ id: business, name: "Summit Painting", slug });
  const morning = [{ startMinute: 540, endMinute: 720 }];
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: business,
    resourceId: null,
    weeklyHours: {
      mon: morning,
      tue: morning,
      wed: morning,
      thu: morning,
      fri: morning,
      sat: morning,
      sun: morning,
    },
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
  const fromNumber = `+1587${randomInt(200, 1000)}${String(randomInt(0, 10_000)).padStart(4, "0")}`;
  if (settings !== null) {
    await db.insert(textSettings).values({
      organizationId: business,
      fromNumber,
      confirmationOn: true,
      reminderMinutesBefore: [],
      replyPhone: "+14035550100",
      replyEmail: null,
      ...settings,
    });
  }
  return { business, slug, marco, estimate, fromNumber };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

// Booked at nine on the Monday; its text stays a job until a test works it.
async function book(business: BusinessType, customer: Record<string, unknown> = jane) {
  const result = await bookTime({
    organizationId: business.business,
    bookingLinkId: business.estimate,
    personId: business.marco,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: customer as typeof jane,
    location: "12 Main Street, Calgary",
    details: "",
    source: "widget",
    actorUserId: null,
    now: NOW,
  });
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
}

const textEntriesOf = async (business: BusinessType) =>
  (
    await db
      .select({ payload: activity.payload })
      .from(activity)
      .where(and(eq(activity.organizationId, business.business), eq(activity.type, "sms_sent")))
  ).map((row) => row.payload);

const textJobsOf = async (bookingId: string) =>
  (await db.execute(
    sql`select attempts from ${schema}._private_jobs jobs
        join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
        where tasks.identifier = 'booking_text' and jobs.payload->>'bookingId' = ${bookingId}`
  )) as unknown as { attempts: number }[];

// A failed job waits seconds for its next try; the tests do not wait for it.
const makeDue = (bookingId: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now() where payload->>'bookingId' = ${bookingId}`
  );

const posts = () => calls.filter((call) => call.method === "POST");

let log: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  calls = [];
  let next = 0;
  sendAnswer = () => sent(`SM${++next}`);
  listAnswer = () => Response.json({ messages: [] });
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "test-token");
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input instanceof Request ? input.url : input));
    if (url.origin + url.pathname !== MESSAGES_URL) {
      throw new Error(`A test tried to reach ${url.origin}.`); // emails and Google stay unsent
    }
    const method = init.method ?? "GET";
    const form = Object.fromEntries(
      method === "POST" ? new URLSearchParams(String(init.body)) : url.searchParams
    );
    calls.push({ method, form });
    return method === "POST" ? sendAnswer(form) : listAnswer();
  });
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  jobClock.now = () => NOW;
  await db.execute(sql`delete from ${schema}._private_jobs`);
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-textjob-%-${tag}-dev`));
  await db.delete(user).where(like(user.email, `owner-text-${tag}@example.com`));
  await db.$client.end();
});

const loggedNotSent = (reason: string) =>
  log.mock.calls.some(
    ([line]) =>
      typeof line === "string" && line.includes("booking_confirmation not sent, " + reason)
  );

describe("a booking's confirmation text", () => {
  test("a booking through the public route sends one text from the business's number to Jane's, with her link, and one timeline entry", async () => {
    const business = await makeBusiness("route");
    // A day a week from today, so the route's own notice and horizon allow it.
    const day = addDays(localDate(new Date(), "America/Edmonton"), 7);
    const times = await (
      await app.request(
        `/public/${business.slug}/booking-links/${business.estimate}/times?from=${day}&to=${day}&person=${business.marco}`
      )
    ).json();
    const response = await app.request(`/public/${business.slug}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingLinkId: business.estimate,
        startsAt: times.startTimes[0],
        personId: business.marco,
        requestKey: randomUUID(),
        customer: jane,
        location: "12 Main Street, Calgary",
        details: "",
      }),
    });
    expect(response.status).toBe(201);
    const { booking } = await response.json();

    await workDueJobs();

    expect(calls).toHaveLength(1);
    const [{ form }] = calls;
    expect(form.From).toBe(business.fromNumber);
    expect(form.To).toBe("+14035550148");
    expect(form.Body).toMatch(
      /^Summit Painting: booked \w{3} \w{3} \d{1,2}, 9:00am\. Details or changes: /
    );
    expect(form.Body.endsWith(`${appOrigin}/b/${makeBookingPageToken(booking.id)}`)).toBe(true);
    expect(await textEntriesOf(business)).toEqual([
      { bookingId: booking.id, kind: "booking_confirmation", twilioSid: "SM1" },
    ]);
    expect(await textJobsOf(booking.id)).toEqual([]); // done and gone
  });

  test("an owner-made booking gets its confirmation text too", async () => {
    const business = await makeBusiness("owner");
    const ownerId = randomUUID();
    await db
      .insert(user)
      .values({ id: ownerId, name: "Primo", email: `owner-text-${tag}@example.com` });
    await db.insert(member).values({
      id: randomUUID(),
      organizationId: business.business,
      userId: ownerId,
      role: "owner",
    });
    const result = await bookTime({
      organizationId: business.business,
      bookingLinkId: business.estimate,
      personId: business.marco,
      startsAt: NINE,
      requestKey: null,
      customer: jane,
      location: "12 Main Street, Calgary",
      details: "",
      source: "manual",
      actorUserId: ownerId,
      now: NOW,
    });
    expect(result.booked).toBe(true);

    await workDueJobs();

    expect(posts()).toHaveLength(1);
  });

  test.each([
    ["the business has no text settings", null],
    ["the business has the confirmation text off", { confirmationOn: false }],
  ])("%s: nothing is sent", async (reason, settings) => {
    const business = await makeBusiness(reason.replace(/\W+/g, "-"), settings as never);
    await book(business);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(await textEntriesOf(business)).toEqual([]);
    expect(loggedNotSent(reason)).toBe(true);
  });

  test("a customer with no phone that takes texts: nothing is sent", async () => {
    const business = await makeBusiness("no-phone");
    await book(business, { ...jane, email: `jane-nophone-${tag}@example.com`, phone: "555-0148" });

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("no phone that takes texts")).toBe(true);
  });

  test("a booking cancelled before its text went: nothing is sent", async () => {
    const business = await makeBusiness("cancelled");
    const id = await book(business);
    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: false });

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the booking was cancelled")).toBe(true);
  });

  test("an appointment already started when the job runs: nothing is sent", async () => {
    const business = await makeBusiness("started");
    await book(business);
    jobClock.now = () => new Date(NINE.getTime() + 60_000);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the appointment has started")).toBe(true);
  });

  test("a booking moved before its text went is confirmed at its new time", async () => {
    const business = await makeBusiness("moved");
    const id = await book(business);
    expect(await moveBooking({ bookingId: id, startsAt: TEN, personId: null, now: NOW })).toEqual(
      expect.objectContaining({ moved: true })
    );

    await workDueJobs();

    expect(posts().map((call) => call.form.Body.split(". Details")[0])).toEqual([
      "Summit Painting: booked Mon Oct 5, 10:00am",
    ]);
  });

  test("a send that fails is retried, checks Twilio first, and is sent once", async () => {
    const business = await makeBusiness("retry");
    const id = await book(business);
    let failures = 0;
    sendAnswer = () =>
      failures++ === 0 ? Response.json({ code: 20503, status: 503 }, { status: 503 }) : sent("SM9");

    await workDueJobs();
    expect(await textJobsOf(id)).toEqual([{ attempts: 1 }]);
    await makeDue(id);
    await workDueJobs();

    expect(calls.map((call) => call.method)).toEqual(["POST", "GET", "POST"]);
    expect(await textEntriesOf(business)).toEqual([
      { bookingId: id, kind: "booking_confirmation", twilioSid: "SM9" },
    ]);
    expect(await textJobsOf(id)).toEqual([]);
  });

  // The booking is made at a fixed moment, so the check's "since" is pinned: the booking's creation,
  // never its appointment or the moment of the retry (decision 8).
  const MADE_AT = new Date("2026-10-01T12:00:00Z");
  test.each([
    ["a minute after the booking was made", 60_000, ["POST", "GET"], "SM7"],
    ["a minute before the booking was made", -60_000, ["POST", "GET", "POST"], "SM1"],
  ])(
    "a retry after a send whose answer was lost, with the same words sent %s",
    async (_, offset, methods, recorded) => {
      const business = await makeBusiness(`lost-${offset}`);
      const id = await book(business);
      await db.update(booking).set({ createdAt: MADE_AT }).where(eq(booking.id, id));
      let body = "";
      let lost = true;
      sendAnswer = (form) => {
        body = form.Body;
        if (!lost) return sent("SM1");
        lost = false;
        return new Response("<html>gateway</html>", { status: 201 }); // taken, the answer lost
      };
      listAnswer = () =>
        Response.json({
          messages: [
            {
              sid: "SM7",
              body,
              direction: "outbound-api",
              status: "sent",
              date_created: new Date(MADE_AT.getTime() + offset).toUTCString(),
            },
          ],
        });

      await workDueJobs();
      await makeDue(id);
      await workDueJobs();

      // Found since the booking was made: nothing sent again, the text Twilio has recorded. From
      // before it: another text, so this one is sent.
      expect(calls.map((call) => call.method)).toEqual(methods);
      expect(calls[1].form).toEqual({
        From: business.fromNumber,
        To: "+14035550148",
        PageSize: "20",
      });
      expect(await textEntriesOf(business)).toEqual([
        { bookingId: id, kind: "booking_confirmation", twilioSid: recorded },
      ]);
    }
  );

  test("a business with no time zone: nothing is sent", async () => {
    const business = await makeBusiness("no-zone");
    await book(business);
    await db.delete(availabilityRule).where(eq(availabilityRule.organizationId, business.business));

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the business has no time zone")).toBe(true);
  });

  test("a customer who texted STOP is not retried: one try, one log line, no entry", async () => {
    const business = await makeBusiness("stop");
    const id = await book(business);
    sendAnswer = () => Response.json({ code: 21610, status: 400 }, { status: 400 });

    await workDueJobs();

    expect(posts()).toHaveLength(1);
    expect(await textJobsOf(id)).toEqual([]); // finished, not waiting to try again
    expect(await textEntriesOf(business)).toEqual([]);
    expect(loggedNotSent("Twilio 21610")).toBe(true);
  });

  test("without Twilio keys in development nothing is sent, and the timeline still gets its entry, as the emails do", async () => {
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    const business = await makeBusiness("no-keys");
    const id = await book(business);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(await textEntriesOf(business)).toEqual([
      { bookingId: id, kind: "booking_confirmation", twilioSid: null },
    ]);
  });
});
