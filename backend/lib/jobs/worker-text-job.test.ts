// The booked worker's text when a booking lands on their day (feature 8c), as a job, against the
// local database with Twilio faked: no test ever sends a real text. Every business here is a
// throwaway carrying this run's tag, removed after.

import { randomInt, randomUUID } from "node:crypto";

import { and, asc, eq, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the link key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the worker text job tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../../app.js");
const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  member,
  organization,
  pipelineStage,
  resource,
  textSettings,
  user,
  workerTextSettings,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../booking/book-time.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { addDays } = await import("@scheduleads-app/shared/add-days");
const { localDate } = await import("@scheduleads-app/shared/local-date");
const { jobClock } = await import("./job-clock.js");
const { jobSchema } = await import("./job-schema.js");
const { workDueJobs } = await import("./work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const TEN = new Date("2026-10-05T16:00:00Z");
const NOW = new Date("2026-10-02T14:00:00Z"); // the Friday before, as vitest.setup.ts pins it
const MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json";
const MARCOS_PHONE = "+14035550161";
const jane = { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0148" };
const schema = sql.identifier(jobSchema);

// Twilio's side, faked: every request, and the answers each test sets.
type TwilioCallType = { method: string; form: Record<string, string> };
let calls: TwilioCallType[];
let sendAnswer: (form: Record<string, string>) => Response;
let listAnswer: () => Response;
const sent = (sid: string) => Response.json({ sid, status: "queued" }, { status: 201 });

const freshNumber = () =>
  `+1587${randomInt(200, 1000)}${String(randomInt(0, 10_000)).padStart(4, "0")}`;

// A painting business of its own, open every day 9 to 12: Marco and Pedro do interior estimates.
// It texts from a made-up number with the customer's texts off, so the only texts are the
// worker's; Marco gets them unless a test changes his settings.
async function makeBusiness(
  name: string,
  {
    texts = {},
    marcosTexts = {},
  }: {
    texts?: Record<string, unknown> | null;
    marcosTexts?: Record<string, unknown> | null;
  } = {}
) {
  const id = () => randomUUID();
  const business = id();
  const slug = `test-workertext-${name}-${tag}-dev`;
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
  const [marco, pedro, estimate] = [id(), id(), id()];
  await db.insert(resource).values([
    { id: marco, organizationId: business, name: "Marco", kind: "person" },
    { id: pedro, organizationId: business, name: "Pedro", kind: "person" },
  ]);
  await db.insert(bookingLink).values({
    id: estimate,
    organizationId: business,
    name: "Interior estimate",
    slug: "interior-estimate",
    durationMinutes: 60,
    layout: "month",
    personChoice: "customer_picks",
  });
  await db.insert(bookingLinkResource).values([
    { organizationId: business, bookingLinkId: estimate, resourceId: marco },
    { organizationId: business, bookingLinkId: estimate, resourceId: pedro },
  ]);
  const fromNumber = freshNumber();
  if (texts !== null) {
    await db.insert(textSettings).values({
      organizationId: business,
      fromNumber,
      confirmationOn: false,
      reminderMinutesBefore: [],
      replyPhone: "+14035550100",
      replyEmail: null,
      ...texts,
    });
  }
  if (marcosTexts !== null) {
    await db.insert(workerTextSettings).values({
      personId: marco,
      organizationId: business,
      phone: MARCOS_PHONE,
      addedOn: true,
      movedOn: true,
      removedOn: true,
      ...marcosTexts,
    });
  }
  return { business, slug, marco, pedro, estimate, fromNumber };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

// Booked with Marco at nine on the Monday; his text stays a job until a test works it.
async function book(business: BusinessType, requestKey: string = randomUUID()) {
  const result = await bookTime({
    organizationId: business.business,
    bookingLinkId: business.estimate,
    personId: business.marco,
    startsAt: NINE,
    requestKey,
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

const workerTextEntriesOf = async (business: BusinessType) =>
  (
    await db
      .select({ payload: activity.payload })
      .from(activity)
      .where(and(eq(activity.organizationId, business.business), eq(activity.type, "sms_sent")))
      .orderBy(asc(activity.occurredAt), asc(activity.createdAt))
  )
    .map((row) => row.payload as Record<string, unknown>)
    .filter((payload) => String(payload.kind).startsWith("worker_"));

const workerJobsOf = async (bookingId: string) =>
  (await db.execute(
    sql`select attempts, payload from ${schema}._private_jobs jobs
        join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
        where tasks.identifier = 'worker_text' and jobs.payload->>'bookingId' = ${bookingId}`
  )) as unknown as { attempts: number; payload: Record<string, unknown> }[];

// A failed job waits seconds for its next try; the tests do not wait for it.
const makeDue = (bookingId: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now() where payload->>'bookingId' = ${bookingId}`
  );

// A failed try's retry comes seconds later; held back here so it runs only when a test says.
const holdRetries = (bookingId: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now() + interval '1 hour'
        where attempts > 0 and payload->>'bookingId' = ${bookingId}`
  );

// Releases held retries ahead of every other due job: the runner breaks no tie between jobs due
// at the same moment, so the order a test means to prove is set here.
const releaseRetries = (bookingId: string) =>
  db.execute(
    sql`update ${schema}._private_jobs set run_at = now() - interval '1 hour'
        where attempts > 0 and payload->>'bookingId' = ${bookingId}`
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
  await db.delete(organization).where(like(organization.slug, `test-workertext-%-${tag}-dev`));
  await db.delete(user).where(like(user.email, `owner-workertext-${tag}@example.com`));
  await db.$client.end();
});

const loggedNotSent = (reason: string) =>
  log.mock.calls.some(
    ([line]) => typeof line === "string" && line.includes("worker_added not sent, " + reason)
  );

describe("the worker's text when a booking lands on their day", () => {
  test("a booking from the form texts its person from the business's number", async () => {
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

    expect(posts()).toHaveLength(1);
    const [{ form }] = posts();
    expect(form.From).toBe(business.fromNumber);
    expect(form.To).toBe(MARCOS_PHONE);
    expect(form.Body).toMatch(
      /^Summit Painting: new booking \w{3} \w{3} \d{1,2}, 9:00am\. Jane Doe, Interior estimate, 12 Main Street, Calgary$/
    );
    // Never the customer's phone or her private link.
    expect(form.Body.replace(/\D/g, "")).not.toContain("4035550148");
    expect(form.Body).not.toContain("http");
    expect(await workerTextEntriesOf(business)).toEqual([
      {
        bookingId: booking.id,
        kind: "worker_added",
        personId: business.marco,
        sequence: 0,
        twilioSid: "SM1",
      },
    ]);
    expect(await workerJobsOf(booking.id)).toEqual([]); // done and gone
  });

  test("an owner's booking texts its person too", async () => {
    const business = await makeBusiness("owner");
    const ownerId = randomUUID();
    await db
      .insert(user)
      .values({ id: ownerId, name: "Primo", email: `owner-workertext-${tag}@example.com` });
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

    expect(posts().map((call) => call.form.To)).toEqual([MARCOS_PHONE]);
    expect(posts()[0].form.Body).toBe(
      "Summit Painting: new booking Mon Oct 5, 9:00am. Jane Doe, Interior estimate, 12 Main Street, Calgary"
    );
  });

  test.each([
    [
      "a person with no row gets nothing and one log line",
      "the person has no worker text settings",
      { marcosTexts: null },
    ],
    [
      "a person with the added switch off gets nothing and one log line",
      "the person has that text off",
      { marcosTexts: { addedOn: false } },
    ],
    [
      "a business without text settings sends nothing and one log line",
      "the business has no text settings",
      { texts: null },
    ],
  ])("%s", async (_, reason, options) => {
    const business = await makeBusiness(reason.replace(/\W+/g, "-"), options);
    await book(business);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(await workerTextEntriesOf(business)).toEqual([]);
    expect(loggedNotSent(reason)).toBe(true);
  });

  test("an inactive person gets nothing and one log line", async () => {
    const business = await makeBusiness("inactive");
    await book(business);
    await db.update(resource).set({ active: false }).where(eq(resource.id, business.marco));

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the person is inactive")).toBe(true);
  });

  test("a business with no time zone: nothing is sent", async () => {
    const business = await makeBusiness("no-zone");
    await book(business);
    await db.delete(availabilityRule).where(eq(availabilityRule.organizationId, business.business));

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the business has no time zone")).toBe(true);
  });

  test("a person whose phone is a texting number gets nothing and one log line", async () => {
    const other = await makeBusiness("other-number");
    const business = await makeBusiness("texting-number", {
      marcosTexts: { phone: other.fromNumber },
    });
    await book(business);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(await workerTextEntriesOf(business)).toEqual([]);
    expect(loggedNotSent("the person's phone is a texting number")).toBe(true);
  });

  test("a booking cancelled before the text went: nothing is sent", async () => {
    const business = await makeBusiness("cancelled");
    const id = await book(business);
    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: false });

    await workDueJobs();

    expect(posts()).toEqual([]);
    expect(loggedNotSent("the booking was cancelled")).toBe(true);
  });

  test("a booking started before the job ran sends nothing", async () => {
    const business = await makeBusiness("started");
    await book(business);
    jobClock.now = () => new Date(NINE.getTime() + 60_000);

    await workDueJobs();

    expect(calls).toEqual([]);
    expect(loggedNotSent("the appointment has started")).toBe(true);
  });

  test("a booking moved to another person before the text went: nothing is sent", async () => {
    const business = await makeBusiness("other-person");
    const id = await book(business);
    expect(
      await moveBooking({ bookingId: id, startsAt: NINE, personId: business.pedro, now: NOW })
    ).toEqual(expect.objectContaining({ moved: true }));

    await workDueJobs();

    expect(posts()).toEqual([]);
    expect(loggedNotSent("the booking is another person's now")).toBe(true);
  });

  test("a booking moved to another time before the job ran says the new time", async () => {
    const business = await makeBusiness("other-time");
    const id = await book(business);
    expect(await moveBooking({ bookingId: id, startsAt: TEN, personId: null, now: NOW })).toEqual(
      expect.objectContaining({ moved: true })
    );

    await workDueJobs();

    expect(posts().map((call) => call.form.Body.split(". Jane")[0])).toEqual([
      "Summit Painting: new booking Mon Oct 5, 10:00am",
    ]);
  });

  test("a resent form adds no second job", async () => {
    const business = await makeBusiness("resent");
    const requestKey = randomUUID();
    const id = await book(business, requestKey);
    expect(await book(business, requestKey)).toBe(id);

    expect(await workerJobsOf(id)).toEqual([
      {
        attempts: 0,
        payload: {
          organizationId: business.business,
          bookingId: id,
          personId: business.marco,
          sequence: 0,
          changedAt: NOW.toISOString(),
          kind: "added",
          startsAt: null,
        },
      },
    ]);
  });

  // The change was saved at NOW, so the check's "since" is pinned there (decision 7).
  test.each([
    ["a minute after the booking was saved", 60_000, ["POST", "GET"], "SM7"],
    ["a minute before the booking was saved", -60_000, ["POST", "GET", "POST"], "SM1"],
  ])(
    "a retry after a send whose answer was lost, with the same words sent %s",
    async (_, offset, methods, recorded) => {
      const business = await makeBusiness(`lost-${offset}`);
      const id = await book(business);
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
              date_created: new Date(NOW.getTime() + offset).toUTCString(),
            },
          ],
        });

      await workDueJobs();
      await makeDue(id);
      await workDueJobs();

      // Found since the booking was saved: nothing sent again, the text Twilio has recorded. From
      // before it: another text, so this one is sent.
      expect(calls.map((call) => call.method)).toEqual(methods);
      expect(calls[1].form).toEqual({
        From: business.fromNumber,
        To: MARCOS_PHONE,
        PageSize: "20",
      });
      expect(await workerTextEntriesOf(business)).toEqual([
        {
          bookingId: id,
          kind: "worker_added",
          personId: business.marco,
          sequence: 0,
          twilioSid: recorded,
        },
      ]);
    }
  );

  test("a refusal no retry can change is not retried: one try, one log line, no entry", async () => {
    const business = await makeBusiness("stop");
    const id = await book(business);
    sendAnswer = () => Response.json({ code: 21610, status: 400 }, { status: 400 });

    await workDueJobs();

    expect(posts()).toHaveLength(1);
    expect(await workerJobsOf(id)).toEqual([]); // finished, not waiting to try again
    expect(await workerTextEntriesOf(business)).toEqual([]);
    expect(loggedNotSent("Twilio 21610")).toBe(true);
  });
});

const ELEVEN = new Date("2026-10-05T17:00:00Z");
const PEDROS_PHONE = "+14035550162";

// Pedro's own worker-text settings, every switch on unless a test changes them.
const givePedroTexts = (business: BusinessType, changes: Record<string, unknown> = {}) =>
  db.insert(workerTextSettings).values({
    personId: business.pedro,
    organizationId: business.business,
    phone: PEDROS_PHONE,
    addedOn: true,
    movedOn: true,
    removedOn: true,
    ...changes,
  });

const move = async (bookingId: string, startsAt: Date, personId: string) =>
  expect(await moveBooking({ bookingId, startsAt, personId, now: NOW })).toEqual(
    expect.objectContaining({ moved: true })
  );

// The texts each phone got, in the order they went.
const textsTo = (phone: string) =>
  posts()
    .filter((call) => call.form.To === phone)
    .map((call) => call.form.Body);

const loggedWorkerNotSent = (kind: string, reason: string) =>
  log.mock.calls.some(
    ([line]) => typeof line === "string" && line.includes(`${kind} not sent, ${reason}`)
  );

const JANE = "Jane Doe, Interior estimate";
const AT_JANES = `${JANE}, 12 Main Street, Calgary`;

describe("the worker's texts when a booking moves or comes off their day", () => {
  test("a move that keeps the person texts them the new time", async () => {
    const business = await makeBusiness("moved");
    const id = await book(business);
    await workDueJobs();
    await move(id, TEN, business.marco);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: moved to Mon Oct 5, 10:00am. ${AT_JANES}`,
    ]);
    const entries = await workerTextEntriesOf(business);
    expect(entries.sort((a, b) => Number(a.sequence) - Number(b.sequence))).toEqual([
      {
        bookingId: id,
        kind: "worker_added",
        personId: business.marco,
        sequence: 0,
        twilioSid: "SM1",
      },
      {
        bookingId: id,
        kind: "worker_moved",
        personId: business.marco,
        sequence: 1,
        twilioSid: "SM2",
      },
    ]);
  });

  test("a move to another person texts the first off your day with the time they had and the second new booking", async () => {
    const business = await makeBusiness("to-pedro");
    await givePedroTexts(business);
    const id = await book(business);
    await workDueJobs();
    await move(id, TEN, business.pedro);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
    expect(textsTo(PEDROS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 10:00am. ${AT_JANES}`,
    ]);
    const kinds = (await workerTextEntriesOf(business)).map((entry) => [
      entry.kind,
      entry.personId,
    ]);
    expect(kinds).toHaveLength(3);
    expect(kinds).toEqual(
      expect.arrayContaining([
        ["worker_added", business.marco],
        ["worker_removed", business.marco],
        ["worker_added", business.pedro],
      ])
    );
  });

  test('a booking moved away and back sends the first no taken off, and one moved away and straight back before the jobs ran texts the first "new booking" once, not twice', async () => {
    // Told first, then away and back: no "off your day", and the move back is news.
    const told = await makeBusiness("back-told");
    const toldId = await book(told);
    await workDueJobs();
    await move(toldId, NINE, told.pedro);
    await move(toldId, NINE, told.marco);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
    ]);
    expect(loggedWorkerNotSent("worker_removed", "the booking is this person's again")).toBe(true);

    // Away and straight back before any job ran: one "new booking", not two.
    calls = [];
    const quick = await makeBusiness("back-quick");
    const quickId = await book(quick);
    await move(quickId, NINE, quick.pedro);
    await move(quickId, NINE, quick.marco);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
    ]);
    expect(
      loggedWorkerNotSent("worker_added", "the person was already told after this change")
    ).toBe(true);
  });

  test("one moved to a second person and straight back before the jobs ran texts the second nothing", async () => {
    const business = await makeBusiness("pedro-quick");
    await givePedroTexts(business);
    const id = await book(business);
    await move(id, NINE, business.pedro);
    await move(id, NINE, business.marco);

    await workDueJobs();

    expect(textsTo(PEDROS_PHONE)).toEqual([]);
    expect(loggedWorkerNotSent("worker_added", "the booking is another person's now")).toBe(true);
    expect(loggedWorkerNotSent("worker_removed", "the person never knew of this booking")).toBe(
      true
    );
  });

  test("a cancel texts the person off your day", async () => {
    const business = await makeBusiness("cancel");
    const id = await book(business);
    await workDueJobs();
    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: false });

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
    expect((await workerTextEntriesOf(business)).map((entry) => entry.kind)).toEqual([
      "worker_added",
      "worker_removed",
    ]);
  });

  test("a second cancel press adds nothing", async () => {
    const business = await makeBusiness("cancel-twice");
    const id = await book(business);
    await workDueJobs();
    await cancelBooking(id, NOW);
    expect(await cancelBooking(id, NOW)).toEqual({ cancelled: true, alreadyCancelled: true });

    expect((await workerJobsOf(id)).map((job) => job.payload.kind)).toEqual(["removed"]);
  });

  test("a later move replaces an earlier moved text, which then sends nothing", async () => {
    const business = await makeBusiness("moved-twice");
    const id = await book(business);
    await workDueJobs();
    await move(id, TEN, business.marco);
    await move(id, ELEVEN, business.marco);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: moved to Mon Oct 5, 11:00am. ${AT_JANES}`,
    ]);
    expect(loggedWorkerNotSent("worker_moved", "a later move replaced it")).toBe(true);
  });

  test("a booking cancelled before its added text went sends no taken off, unless the person's added switch is off", async () => {
    const never = await makeBusiness("cancel-untold");
    await cancelBooking(await book(never), NOW);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toEqual([]);
    expect(loggedWorkerNotSent("worker_removed", "the person never knew of this booking")).toBe(
      true
    );

    // With the added switch off he learns of bookings elsewhere, so he is told it is off.
    const elsewhere = await makeBusiness("cancel-elsewhere", { marcosTexts: { addedOn: false } });
    await cancelBooking(await book(elsewhere), NOW);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
  });

  test("taken off for a start already passed sends nothing", async () => {
    const business = await makeBusiness("too-late");
    const id = await book(business);
    await workDueJobs();
    await cancelBooking(id, NOW);
    jobClock.now = () => new Date(NINE.getTime() + 60_000);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toHaveLength(1); // only the "new booking"
    expect(loggedWorkerNotSent("worker_removed", "the time they had has passed")).toBe(true);
  });

  test("each switch off stops only its own text", async () => {
    const business = await makeBusiness("one-off", { marcosTexts: { movedOn: false } });
    const id = await book(business);
    await workDueJobs();
    await move(id, TEN, business.marco);
    await workDueJobs();
    await cancelBooking(id, NOW);
    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 10:00am. ${JANE}`,
    ]);
    expect(loggedWorkerNotSent("worker_moved", "the person has that text off")).toBe(true);

    // The "off your day" switch alone: told of the booking and its move, not of its cancel.
    calls = [];
    const noOff = await makeBusiness("off-off", { marcosTexts: { removedOn: false } });
    const noOffId = await book(noOff);
    await workDueJobs();
    await move(noOffId, TEN, noOff.marco);
    await workDueJobs();
    await cancelBooking(noOffId, NOW);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: moved to Mon Oct 5, 10:00am. ${AT_JANES}`,
    ]);
    expect(loggedWorkerNotSent("worker_removed", "the person has that text off")).toBe(true);
  });

  test('a moved text that a late "new booking" already covered sends nothing', async () => {
    const business = await makeBusiness("covered");
    const id = await book(business);
    await move(id, TEN, business.marco);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 10:00am. ${AT_JANES}`,
    ]);
    expect(
      loggedWorkerNotSent("worker_moved", "the person was already told after this change")
    ).toBe(true);
  });

  test("a booking's worker texts wait in one lane, in the order they were added", async () => {
    const business = await makeBusiness("lane");
    const id = await book(business);
    await move(id, TEN, business.pedro);
    await cancelBooking(id, NOW);

    const jobs = (await db.execute(
      sql`select queues.queue_name, jobs.payload->>'kind' as kind from ${schema}._private_jobs jobs
          join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
          join ${schema}._private_job_queues queues on queues.id = jobs.job_queue_id
          where tasks.identifier = 'worker_text' and jobs.payload->>'bookingId' = ${id}
          order by jobs.id`
    )) as unknown as { queue_name: string; kind: string }[];
    expect(jobs.map((job) => job.kind)).toEqual(["added", "removed", "added", "removed"]);
    expect(new Set(jobs.map((job) => job.queue_name))).toEqual(
      new Set([`worker-text-${id.slice(-2).toLowerCase()}`])
    );
  });

  test("an off your day still goes when the new booking may have reached them and waits to retry", async () => {
    const business = await makeBusiness("in-doubt");
    const id = await book(business);
    // Twilio took the "new booking", but its answer was lost: the job waits to try again.
    sendAnswer = () => new Response("<html>gateway</html>", { status: 201 });
    await workDueJobs();
    expect((await workerJobsOf(id)).map((job) => [job.payload.kind, job.attempts])).toEqual([
      ["added", 1],
    ]);
    await holdRetries(id);
    sendAnswer = () => sent("SM9");
    await cancelBooking(id, NOW);

    await workDueJobs(); // only the cancel's text is due: the retry waits behind it

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
    // The retry then finds the booking cancelled and sends nothing more.
    await makeDue(id);
    await workDueJobs();
    expect(textsTo(MARCOS_PHONE)).toHaveLength(2);
    expect(await workerJobsOf(id)).toEqual([]);
  });

  test("a person already told a booking is off their day gets no second off your day", async () => {
    const business = await makeBusiness("off-twice");
    const id = await book(business);
    await workDueJobs();
    await move(id, NINE, business.pedro);
    await workDueJobs(); // Marco: "off your day"
    // Back to Marco and cancelled before either text went: he still thinks it is off.
    await move(id, NINE, business.marco);
    await cancelBooking(id, NOW);

    await workDueJobs();

    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
    expect(
      loggedWorkerNotSent("worker_removed", "the person was already told it is off their day")
    ).toBe(true);
  });

  // A text Twilio took whose answer was lost: its words are kept so its retry finds it there.
  const loseFirst = (startsWith: string) => {
    let lostBody = "";
    let next = 0;
    sendAnswer = (form) => {
      if (!lostBody && form.Body.startsWith(startsWith)) {
        lostBody = form.Body;
        return new Response("<html>gateway</html>", { status: 201 });
      }
      return sent(`SM${++next}`);
    };
    listAnswer = () =>
      Response.json({
        messages: lostBody
          ? [
              {
                sid: "SM99",
                body: lostBody,
                direction: "outbound-api",
                status: "sent",
                date_created: new Date(NOW.getTime() + 60_000).toUTCString(),
              },
            ]
          : [],
      });
  };

  test("a lost off your day found on its retry does not stop a later one after a new booking", async () => {
    const business = await makeBusiness("lost-off");
    const id = await book(business);
    await workDueJobs(); // Marco: "new booking"
    loseFirst("Summit Painting: off your day");
    await move(id, NINE, business.pedro);
    await workDueJobs(); // Marco's "off your day" went, its answer lost: it waits to retry
    await holdRetries(id);
    await move(id, NINE, business.marco);
    await workDueJobs(); // Marco: "new booking" again
    await move(id, NINE, business.pedro);

    await releaseRetries(id); // the lost try's retry runs first, finds its text, then the change's
    await workDueJobs();

    const texts = textsTo(MARCOS_PHONE);
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(texts).toHaveLength(4);
    expect(texts.at(-1)).toBe(`Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`);
  });

  test("a lost new booking found on its retry does not stop a later one after an off your day", async () => {
    const business = await makeBusiness("lost-new");
    loseFirst("Summit Painting: new booking");
    const id = await book(business);
    await workDueJobs(); // Marco's "new booking" went, its answer lost: it waits to retry
    await holdRetries(id);
    await move(id, NINE, business.pedro);
    await workDueJobs(); // Marco: "off your day", since the new booking may have reached him
    await move(id, NINE, business.marco);

    await releaseRetries(id); // the lost try's retry runs first, finds its text, then the move back's
    await workDueJobs();

    const texts = textsTo(MARCOS_PHONE);
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(texts).toHaveLength(3);
    expect(texts.at(-1)).toBe(`Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`);
  });

  test("a lost new booking found on its retry after a cancel still texts the person off your day", async () => {
    const business = await makeBusiness("lost-then-cancel");
    loseFirst("Summit Painting: new booking");
    const id = await book(business);
    await workDueJobs(); // Marco's "new booking" went, its answer lost: it waits to retry
    await holdRetries(id);
    await cancelBooking(id, NOW);

    await releaseRetries(id); // the retry runs first: the booking is cancelled, its job ends
    await workDueJobs();

    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(textsTo(MARCOS_PHONE)).toEqual([
      `Summit Painting: new booking Mon Oct 5, 9:00am. ${AT_JANES}`,
      `Summit Painting: off your day, Mon Oct 5, 9:00am. ${JANE}`,
    ]);
    expect((await workerTextEntriesOf(business)).map((entry) => entry.kind)).toEqual([
      "worker_added",
      "worker_removed",
    ]);
    expect(await workerJobsOf(id)).toEqual([]);
  });

  test("a new booking its retry finds never went sends no off your day after a cancel", async () => {
    const business = await makeBusiness("never-then-cancel");
    sendAnswer = () => new Response("<html>gateway</html>", { status: 502 });
    const id = await book(business);
    await workDueJobs(); // Marco's "new booking" failed: it waits to retry
    await holdRetries(id);
    sendAnswer = () => sent("SM9");
    await cancelBooking(id, NOW);

    await releaseRetries(id); // the retry runs first, asks Twilio, finds nothing
    await workDueJobs();

    expect(calls.filter((call) => call.method === "GET")).toHaveLength(1);
    expect(textsTo(MARCOS_PHONE)).toHaveLength(1);
    expect(loggedWorkerNotSent("worker_added", "the booking was cancelled")).toBe(true);
    expect(loggedWorkerNotSent("worker_removed", "the person never knew of this booking")).toBe(
      true
    );
    expect(await workerJobsOf(id)).toEqual([]);
  });
});
