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

// The reminder jobs still waiting for a booking: when each is due, and which reminder it is.
const reminderJobsOf = async (bookingId: string) =>
  (
    (await db.execute(
      sql`select jobs.run_at, jobs.payload->>'minutesBefore' as minutes,
          jobs.payload->>'sequence' as sequence
          from ${schema}._private_jobs jobs
          join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
          where tasks.identifier = 'booking_text' and jobs.payload->>'bookingId' = ${bookingId}
          and jobs.payload->>'kind' = 'reminder' order by jobs.run_at`
    )) as unknown as { run_at: string | Date; minutes: string; sequence: string }[]
  ).map((job) => ({
    runAt: new Date(job.run_at).toISOString(),
    minutesBefore: Number(job.minutes),
    sequence: Number(job.sequence),
  }));

const reminderPosts = () => posts().filter((call) => call.form.Body.includes(" reminder: "));
const reminderMinutesSent = async (business: BusinessType) =>
  (await textEntriesOf(business))
    .map((entry) => entry as { kind: string; minutesBefore?: number })
    .filter((entry) => entry.kind === "booking_reminder")
    .map((entry) => entry.minutesBefore ?? 0)
    .sort((a, b) => a - b);
const loggedReminderNotSent = (reason: string) =>
  log.mock.calls.some(
    ([line]) => typeof line === "string" && line.includes("booking_reminder not sent, " + reason)
  );

const TWO_REMINDERS = { reminderMinutesBefore: [1200, 60] };

// Reminders run first, being due earliest: the 1200-minute one goes, the 60-minute one finds
// Twilio down on its first try.
const failSecondReminder = () => {
  let remindersAsked = 0;
  sendAnswer = (form) =>
    form.Body.includes(" reminder: ") && ++remindersAsked === 2
      ? Response.json({ code: 20503, status: 503 }, { status: 503 })
      : sent(`SM${calls.length}`);
};

// The cases on the feature's Simulate page in the build log, under the same names.
describe("a booking's reminders", () => {
  test("a booking gets its reminders at the right instants in the business's time zone", async () => {
    const business = await makeBusiness("rem-a", TWO_REMINDERS);
    const id = await book(business);

    // Monday 9:00 in Edmonton, minus 1200 minutes is Sunday 1:00 p.m.; minus 60 is 8:00 a.m.
    expect(await reminderJobsOf(id)).toEqual([
      { runAt: "2026-10-04T19:00:00.000Z", minutesBefore: 1200, sequence: 0 },
      { runAt: "2026-10-05T14:00:00.000Z", minutesBefore: 60, sequence: 0 },
    ]);
    await workDueJobs();

    expect(reminderPosts().map((call) => call.form.Body.split(". Details")[0])).toEqual([
      "Summit Painting reminder: Mon Oct 5, 9:00am",
      "Summit Painting reminder: Mon Oct 5, 9:00am",
    ]);
    expect(await reminderMinutesSent(business)).toEqual([60, 1200]);
  });

  test("after a move only the new ones send, at the new times", async () => {
    const business = await makeBusiness("rem-b", TWO_REMINDERS);
    const id = await book(business);
    expect(await moveBooking({ bookingId: id, startsAt: TEN, personId: null, now: NOW })).toEqual(
      expect.objectContaining({ moved: true })
    );
    expect((await reminderJobsOf(id)).filter((job) => job.sequence === 1)).toEqual([
      { runAt: "2026-10-04T20:00:00.000Z", minutesBefore: 1200, sequence: 1 },
      { runAt: "2026-10-05T15:00:00.000Z", minutesBefore: 60, sequence: 1 },
    ]);

    await workDueJobs();

    expect(reminderPosts().map((call) => call.form.Body.split(". Details")[0])).toEqual([
      "Summit Painting reminder: Mon Oct 5, 10:00am",
      "Summit Painting reminder: Mon Oct 5, 10:00am",
    ]);
    expect(loggedReminderNotSent("a later move replaced it")).toBe(true);
  });

  test("after a cancel none send", async () => {
    const business = await makeBusiness("rem-c", TWO_REMINDERS);
    const id = await book(business);
    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: false });

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedReminderNotSent("the booking was cancelled")).toBe(true);
  });

  test("a reminder removed from the settings does not send", async () => {
    const business = await makeBusiness("rem-d", TWO_REMINDERS);
    await book(business);
    await db
      .update(textSettings)
      .set({ reminderMinutesBefore: [60] })
      .where(eq(textSettings.organizationId, business.business));

    await workDueJobs();

    expect(await reminderMinutesSent(business)).toEqual([60]);
    expect(loggedReminderNotSent("the business no longer has that reminder")).toBe(true);
  });

  test("a booking made 30 minutes ahead gets no 1200-minute reminder", async () => {
    const business = await makeBusiness("rem-e", TWO_REMINDERS);
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
      now: new Date(NINE.getTime() - 30 * 60_000), // 8:30 the same morning
    });
    if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);

    // 1200 minutes before had long passed, and so had 60: neither is added.
    expect(await reminderJobsOf(result.booking.id)).toEqual([]);
    await workDueJobs();

    // Her confirmation still goes.
    expect(posts().map((call) => call.form.Body.split(". Details")[0])).toEqual([
      "Summit Painting: booked Mon Oct 5, 9:00am",
    ]);
  });

  test("a reminder still failing when the appointment starts is never sent", async () => {
    const business = await makeBusiness("rem-f", TWO_REMINDERS);
    const id = await book(business);
    failSecondReminder();

    await workDueJobs();
    expect(await reminderJobsOf(id)).toEqual([
      { runAt: expect.any(String), minutesBefore: 60, sequence: 0 },
    ]);
    jobClock.now = () => new Date(NINE.getTime() + 60_000); // Twilio still down at 9:00
    await makeDue(id);
    await workDueJobs();

    expect(reminderPosts()).toHaveLength(2); // the 1200 that went, the 60 that failed
    expect(await reminderMinutesSent(business)).toEqual([1200]);
    expect(await reminderJobsOf(id)).toEqual([]); // finished, not waiting for another try
    expect(loggedReminderNotSent("the appointment has started")).toBe(true);
  });

  test("the 60-minute reminder's retry still sends after the 1200-minute one went", async () => {
    const business = await makeBusiness("rem-g", TWO_REMINDERS);
    const id = await book(business);
    // Made on the Friday, before either reminder: a retry counting from the booking's creation
    // would take the 1200-minute text for this one and stay quiet.
    await db.update(booking).set({ createdAt: NOW }).where(eq(booking.id, id));
    failSecondReminder();
    // Twilio lists the 1200-minute reminder: the same words, sent at its own time.
    listAnswer = () =>
      Response.json({
        messages: [
          {
            sid: "SM-1200",
            body: reminderPosts()[0]!.form.Body,
            direction: "outbound-api",
            status: "delivered",
            date_created: new Date(NINE.getTime() - 1200 * 60_000).toUTCString(),
          },
        ],
      });

    await workDueJobs();
    await makeDue(id);
    await workDueJobs();

    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1); // the retry checked
    expect(reminderPosts()).toHaveLength(3); // 1200, the 60 that failed, the 60 on its retry
    expect(await reminderMinutesSent(business)).toEqual([60, 1200]);
  });
});
