// The Calendar page's week (feature 12b), called through the real app against the local database,
// with Google faked: no test ever reaches Google. Every business, login, person and booking here
// is a throwaway made below and removed after. Test names match the feature's planned checks.

import { randomUUID } from "node:crypto";

import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";
import { localDate } from "@scheduleads-app/shared/local-date";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

// The sign-in helper reads codes from the console, so no real email is ever sent.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the schedule route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const { saveCalendarConnection } = await import("../lib/calendar/save-calendar-connection.js");
const { jobSchema } = await import("../lib/jobs/job-schema.js");
const { localTimeToMoment } = await import("../lib/local-time/local-time-to-moment.js");
const {
  availabilityRule,
  booking,
  bookingLink,
  calendarConnection,
  commitment,
  contact,
  lead,
  member,
  organization,
  pipelineStage,
  resource,
  standbyDate,
  user,
} = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string) => ({
  userId: randomUUID(),
  email: `schedule-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-schedule-${letter}-${tag}-dev`,
  personId: randomUUID(), // the owner's own person
});
const summit = makeTenant("s"); // Carlos is its owner's person
const other = makeTenant("o"); // another business
const helper = {
  userId: randomUUID(),
  email: `schedule-m-${tag}@example.com`,
  personId: randomUUID(),
}; // Juan, a member of Summit
const vanId = randomUUID();
const stageId = randomUUID();
const serviceId = randomUUID();
const bookingId = randomUUID();

// The week of Monday Sep 14, 2026, in Edmonton: UTC-6, daylight time, whichever tz data the
// machine has (from 2026c Alberta keeps it all year; before, it ended in November).
const WEEK = [
  "2026-09-14",
  "2026-09-15",
  "2026-09-16",
  "2026-09-17",
  "2026-09-18",
  "2026-09-19",
  "2026-09-20",
];
const at = (iso: string) => new Date(iso);
const tuesdayTen = { start: "2026-09-15T16:00:00.000Z", end: "2026-09-15T17:00:00.000Z" }; // 10 to 11
const fridayOff = { start: "2026-09-18T19:00:00.000Z", end: "2026-09-19T00:00:00.000Z" }; // 1 to 6 pm
const wednesdayGoogle = { start: "2026-09-16T15:00:00.000Z", end: "2026-09-16T15:30:00.000Z" }; // 9 to 9:30

// Google's side, faked: free/busy answers each test sets.
type AnswerType = () => Response;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// Carlos's main calendar: his own booking's event, and a dentist appointment on Wednesday.
const googleBusy = () => json({ calendars: { primary: { busy: [tuesdayTen, wednesdayGoogle] } } });
let freeBusyAnswer: AnswerType = googleBusy;
const warnings: string[] = [];

const cookies = new Map<string, string>();

// Signs in the real way: asks for a login code and reads it where the API prints it.
async function signIn(email: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const headers = { "Content-Type": "application/json", Origin: appOrigin };
  await app.request("/api/auth/email-otp/send-verification-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, type: "sign-in" }),
  });
  const line = log.mock.calls.map((call) => String(call[0])).find((text) => text.includes(email));
  log.mockRestore();
  const otp = line?.split(": ").pop();
  if (!otp) throw new Error(`No login code was printed for ${email}.`);
  const response = await app.request("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, otp }),
  });
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const weekOf = (email: string, query = "") =>
  app.request(`/schedule${query}`, {
    headers: { Origin: appOrigin, Cookie: cookies.get(email)! },
  });

type DayType = {
  date: string;
  closed: boolean;
  hours: { startMinute: number; endMinute: number }[];
  items: { kind: string; startsAt: string; endsAt: string; booking?: Record<string, unknown> }[];
};
const dayOf = (days: DayType[], date: string) => days.find((day) => day.date === date)!;

beforeAll(async () => {
  await db.insert(user).values(
    [summit, other, helper].map((t) => ({
      id: t.userId,
      name: "",
      email: t.email,
      emailVerified: true,
    }))
  );
  await db
    .insert(organization)
    .values([summit, other].map((t) => ({ id: t.organizationId, name: t.slug, slug: t.slug })));
  await db.insert(member).values([
    ...[summit, other].map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      userId: t.userId,
      role: "owner",
    })),
    {
      id: randomUUID(),
      organizationId: summit.organizationId,
      userId: helper.userId,
      role: "member",
    },
  ]);
  await db.insert(resource).values([
    {
      id: summit.personId,
      organizationId: summit.organizationId,
      name: "Carlos",
      kind: "person",
      userId: summit.userId,
    },
    {
      id: helper.personId,
      organizationId: summit.organizationId,
      name: "Juan",
      kind: "person",
      userId: helper.userId,
    },
    { id: vanId, organizationId: summit.organizationId, name: "Van", kind: "place" },
    {
      id: other.personId,
      organizationId: other.organizationId,
      name: "Kim",
      kind: "person",
      userId: other.userId,
    },
  ]);
  const weekdays = { startMinute: 480, endMinute: 1020 }; // 8 am to 5 pm
  await db.insert(availabilityRule).values(
    [summit, other].map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      resourceId: null,
      weeklyHours: {
        mon: [weekdays],
        tue: [weekdays],
        wed: [weekdays],
        thu: [weekdays],
        fri: [weekdays],
      },
      dateHours: [],
      timezone: "America/Edmonton",
      minimumNoticeMinutes: 0,
      horizonDays: 1, // the customers' horizon ends tomorrow; the owner still sees the whole week
      closedDates: ["2026-09-17"], // Thursday
    }))
  );
  await db
    .insert(pipelineStage)
    .values({ id: stageId, organizationId: summit.organizationId, name: "New", position: 0 });
  await db.insert(bookingLink).values({
    id: serviceId,
    organizationId: summit.organizationId,
    name: "Estimate",
    slug: "estimate",
    durationMinutes: 60,
    layout: "month",
    addressMode: "not_asked",
    personChoice: "customer_picks",
  });
  const [contactId, leadId] = [randomUUID(), randomUUID()];
  await db
    .insert(contact)
    .values({ id: contactId, organizationId: summit.organizationId, name: "Ana Ruiz" });
  await db.insert(lead).values({
    id: leadId,
    organizationId: summit.organizationId,
    contactId,
    stageId,
    source: "widget",
  });
  await db.insert(booking).values({
    id: bookingId,
    organizationId: summit.organizationId,
    leadId,
    bookingLinkId: serviceId,
    personId: summit.personId,
    placeId: vanId,
    startsAt: at(tuesdayTen.start),
    endsAt: at(tuesdayTen.end),
    status: "confirmed",
  });
  await db.insert(commitment).values([
    ...[summit.personId, vanId].map((resourceId) => ({
      id: randomUUID(),
      organizationId: summit.organizationId,
      resourceId,
      kind: "booking",
      bookingId,
      startsAt: at(tuesdayTen.start),
      endsAt: at(tuesdayTen.end),
    })),
    {
      id: randomUUID(),
      organizationId: summit.organizationId,
      resourceId: summit.personId,
      kind: "time_off",
      startsAt: at(fridayOff.start),
      endsAt: at(fridayOff.end),
    },
  ]);
  await saveCalendarConnection({
    organizationId: summit.organizationId,
    resourceId: summit.personId,
    accountEmail: `carlos-${tag}@gmail.com`,
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken: "1//carlos",
      accessToken: "ya29.carlos",
      accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    },
  });

  for (const email of [summit.email, other.email, helper.email])
    cookies.set(email, await signIn(email));

  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") return freeBusyAnswer();
    throw new Error(`A test tried to reach ${url}.`);
  });
});

beforeEach(() => {
  freeBusyAnswer = googleBusy;
  warnings.length = 0;
  vi.spyOn(console, "warn").mockImplementation((...parts) => {
    warnings.push(parts.join(" "));
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  // Bookings and held time keep their people (no action on delete), so they go first.
  await db
    .delete(commitment)
    .where(inArray(commitment.organizationId, [summit.organizationId, other.organizationId]));
  await db
    .delete(booking)
    .where(inArray(booking.organizationId, [summit.organizationId, other.organizationId]));
  await db
    .delete(organization)
    .where(inArray(organization.id, [summit.organizationId, other.organizationId]));
  await db.delete(user).where(inArray(user.id, [summit.userId, other.userId, helper.userId]));
  await db.$client.end();
});

describe("the Calendar page's week (feature 12b)", () => {
  test("the week shows hours, closed days, bookings, time off and Google busy apart, in the business's zone", async () => {
    const response = await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-09-16`);
    expect(response.status).toBe(200);
    const week = await response.json();

    expect(week).toMatchObject({
      canEdit: true,
      timezone: "America/Edmonton",
      weekOf: "2026-09-14", // the Monday of the week asked for
      resource: { id: summit.personId, name: "Carlos", kind: "person" },
      google: "read",
    });
    expect(week.days.map((day: DayType) => day.date)).toEqual(WEEK);
    // Hours past the customers' one-day horizon still show; Thursday is closed; the weekend has none.
    expect(dayOf(week.days, "2026-09-14").hours).toEqual([{ startMinute: 480, endMinute: 1020 }]);
    expect(dayOf(week.days, "2026-09-17")).toMatchObject({ closed: true, hours: [] });
    expect(dayOf(week.days, "2026-09-19").hours).toEqual([]);

    // Tuesday: the booking with its customer, once: its own Google event is not shown again.
    expect(dayOf(week.days, "2026-09-15").items).toEqual([
      {
        kind: "booking",
        startsAt: tuesdayTen.start,
        endsAt: tuesdayTen.end,
        booking: {
          id: bookingId,
          leadId: expect.any(String),
          customerName: "Ana Ruiz",
          serviceName: "Estimate",
          personName: "Carlos",
          placeName: "Van",
        },
      },
    ]);
    expect(dayOf(week.days, "2026-09-16").items).toEqual([
      { kind: "google_busy", startsAt: wednesdayGoogle.start, endsAt: wednesdayGoogle.end },
    ]);
    // Friday's time off ends at midnight UTC, still Friday afternoon in Edmonton: Friday only.
    expect(dayOf(week.days, "2026-09-18").items).toEqual([
      {
        kind: "time_off",
        id: expect.any(String),
        startsAt: fridayOff.start,
        endsAt: fridayOff.end,
      },
    ]);
    expect(dayOf(week.days, "2026-09-19").items).toEqual([]);
    // People first, then places, for the owner to pick between.
    expect(week.resources.map((one: { name: string }) => one.name)).toEqual([
      "Carlos",
      "Juan",
      "Van",
    ]);
  });

  test("a place's week shows the bookings that use it, and no Google", async () => {
    const week = await (
      await weekOf(summit.email, `?resourceId=${vanId}&weekOf=2026-09-14`)
    ).json();
    expect(week.google).toBe("not_connected");
    expect(dayOf(week.days, "2026-09-15").items).toMatchObject([
      { kind: "booking", booking: { customerName: "Ana Ruiz", personName: "Carlos" } },
    ]);
    expect(dayOf(week.days, "2026-09-18").items).toEqual([]); // Carlos's time off is his, not the van's
  });

  test("Google unreadable still shows the rest of the week", async () => {
    freeBusyAnswer = () => json({ error: { code: 500 } }, 500);
    const week = await (
      await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-09-14`)
    ).json();

    expect(week.google).toBe("unreadable");
    expect(dayOf(week.days, "2026-09-15").items).toMatchObject([{ kind: "booking" }]);
    expect(dayOf(week.days, "2026-09-18").items).toMatchObject([{ kind: "time_off" }]);
    expect(warnings).toEqual([
      "[calendar] a week's Google busy times could not be read: Google's free/busy failed (500).",
    ]);
  });

  test("a member sees only their own calendar, and another business's resource is 404", async () => {
    const own = await weekOf(helper.email, "?weekOf=2026-09-14");
    expect(own.status).toBe(200);
    expect(await own.json()).toMatchObject({
      canEdit: false,
      resource: { id: helper.personId, name: "Juan" },
      resources: [{ id: helper.personId, name: "Juan", kind: "person" }],
    });
    expect((await weekOf(helper.email, `?resourceId=${summit.personId}`)).status).toBe(403);
    expect((await weekOf(helper.email, `?resourceId=${vanId}`)).status).toBe(403);

    expect((await weekOf(summit.email, `?resourceId=${other.personId}`)).status).toBe(404);
    expect((await weekOf(summit.email, `?resourceId=${randomUUID()}`)).status).toBe(404);
  });

  test("with nothing asked, the owner sees their own person this week; a bad date is refused", async () => {
    const week = await (await weekOf(summit.email)).json();
    expect(week.resource.id).toBe(summit.personId);
    expect(new Date(`${week.weekOf}T12:00:00Z`).getUTCDay()).toBe(1); // a Monday
    expect((await weekOf(summit.email, "?weekOf=2026-02-30")).status).toBe(400);
    expect((await weekOf(summit.email, "?weekOf=soon")).status).toBe(400);
  });

  test("a standby day shows no bookable hours, as the booking window offers none", async () => {
    await db.insert(standbyDate).values({
      organizationId: summit.organizationId,
      resourceId: summit.personId,
      date: "2026-09-16",
    });
    try {
      const week = await (
        await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-09-14`)
      ).json();
      expect(dayOf(week.days, "2026-09-16")).toMatchObject({
        standby: true,
        closed: false,
        hours: [],
      });
      expect(dayOf(week.days, "2026-09-16").items).toMatchObject([{ kind: "google_busy" }]);
      expect(dayOf(week.days, "2026-09-15")).toMatchObject({ standby: false });
    } finally {
      await db.delete(standbyDate).where(inArray(standbyDate.resourceId, [summit.personId]));
    }
  });

  test("an item across several local days shows on each, and only those", async () => {
    // Saturday 10 am to Sunday 7 pm in Edmonton: past midnight UTC on both days.
    const weekend = {
      id: randomUUID(),
      organizationId: summit.organizationId,
      resourceId: summit.personId,
      kind: "time_off",
      startsAt: at("2026-09-19T16:00:00.000Z"),
      endsAt: at("2026-09-21T01:00:00.000Z"),
    };
    await db.insert(commitment).values(weekend);
    try {
      const week = await (
        await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-09-14`)
      ).json();
      const holding = week.days
        .filter((day: DayType) =>
          day.items.some(
            (item) => item.kind === "time_off" && item.startsAt === weekend.startsAt.toISOString()
          )
        )
        .map((day: DayType) => day.date);
      expect(holding).toEqual(["2026-09-19", "2026-09-20"]);
    } finally {
      await db.delete(commitment).where(inArray(commitment.id, [weekend.id]));
    }
  });

  test("a week with the spring clock change has seven days, and places items by the clock after it", async () => {
    // Sunday March 8, 2026, the clocks go forward at 2 am (UTC-7 to UTC-6). 05:00 UTC on Monday the
    // 9th is 11 pm on Sunday; 06:00 UTC is midnight, so Monday, next week. Read at the old offset,
    // both would be Sunday.
    const rows = [
      { at: "2026-03-09T05:00:00.000Z", until: "2026-03-09T05:30:00.000Z" }, // Sunday 11 pm
      { at: "2026-03-09T06:00:00.000Z", until: "2026-03-09T06:30:00.000Z" }, // Monday midnight
    ].map((row) => ({
      id: randomUUID(),
      organizationId: summit.organizationId,
      resourceId: summit.personId,
      kind: "time_off",
      startsAt: at(row.at),
      endsAt: at(row.until),
    }));
    await db.insert(commitment).values(rows);
    try {
      const week = await (
        await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-03-04`)
      ).json();
      expect(week.days.map((day: DayType) => day.date)).toEqual([
        "2026-03-02",
        "2026-03-03",
        "2026-03-04",
        "2026-03-05",
        "2026-03-06",
        "2026-03-07",
        "2026-03-08",
      ]);
      expect(dayOf(week.days, "2026-03-08").items).toEqual([
        {
          kind: "time_off",
          id: rows[0].id,
          startsAt: rows[0].startsAt.toISOString(),
          endsAt: rows[0].endsAt.toISOString(),
        },
      ]);
      expect(dayOf(week.days, "2026-03-02").hours).toEqual([{ startMinute: 480, endMinute: 1020 }]);
    } finally {
      await db.delete(commitment).where(
        inArray(
          commitment.id,
          rows.map((row) => row.id)
        )
      );
    }
  });

  test("no session is refused with 401", async () => {
    expect((await app.request("/schedule", { headers: { Origin: appOrigin } })).status).toBe(401);
  });
});

// Step 12b.2: the owner books by hand, a phone estimate or a walk-in.
describe("booking by hand (feature 12b)", () => {
  const ZONE = "America/Edmonton";
  // Three weeks ahead, a day the test owns: well clear of the fixtures above.
  const day = localDate(new Date(Date.now() + 21 * 86_400_000), ZONE);
  const book = (email: string, changes: Record<string, unknown> = {}) =>
    app.request("/schedule/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
        Cookie: cookies.get(email)!,
      },
      body: JSON.stringify({
        bookingLinkId: serviceId,
        personId: summit.personId,
        date: day,
        startMinute: 1110, // 6:30 pm: after Carlos's hours, which end at 5
        customer: { name: "Mrs Lee", phone: "403 555 0123" },
        ...changes,
      }),
    });
  const jobsOf = async (bookingId: string) =>
    (
      (await db.execute(
        sql`select tasks.identifier as task from ${sql.identifier(jobSchema)}._private_jobs jobs
            join ${sql.identifier(jobSchema)}._private_tasks tasks on tasks.id = jobs.task_id
            where jobs.payload->>'bookingId' = ${bookingId} order by task`
      )) as unknown as { task: string }[]
    ).map((job) => job.task);
  const made: string[] = [];

  afterAll(async () => {
    // Its jobs never run here: the Google event and messages belong to a business about to go.
    await db.execute(
      sql`delete from ${sql.identifier(jobSchema)}._private_jobs where payload->>'bookingId' in ${made.length ? made : ["none"]}`
    );
  });

  test("a booking by hand outside bookable hours is made, with a lead and its jobs", async () => {
    const response = await book(summit.email);
    expect(response.status).toBe(201);
    const { booking: made1 } = await response.json();
    made.push(made1.id);

    // 6:30 pm in Edmonton on that day, whatever its offset.
    expect(localDate(new Date(made1.startsAt), ZONE)).toBe(day);
    expect(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(made1.startsAt))
    ).toBe("18:30");
    const [row] = await db
      .select({ source: lead.source, contactId: lead.contactId })
      .from(lead)
      .where(inArray(lead.id, [made1.leadId]));
    expect(row.source).toBe("manual");
    const [customer] = await db
      .select({ name: contact.name, phone: contact.phone })
      .from(contact)
      .where(inArray(contact.id, [row.contactId]));
    expect(customer.name).toBe("Mrs Lee");
    // Carlos has Google connected: his event is queued with the booking, as for a website booking.
    expect(await jobsOf(made1.id)).toContain("booking_event_write");

    // It shows on the calendar.
    const week = await (
      await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=${day}`)
    ).json();
    expect(dayOf(week.days, day).items).toMatchObject([
      {
        kind: "booking",
        booking: { id: made1.id, customerName: "Mrs Lee", serviceName: "Estimate" },
      },
    ]);
  });

  test("a busy time, time off and a past time are refused", async () => {
    // A time of its own, then the same time again: Carlos is busy with Ms Kay.
    const first = await book(summit.email, { startMinute: 1290, customer: { name: "Ms Kay" } });
    expect(first.status).toBe(201);
    made.push((await first.json()).booking.id);
    const again = await book(summit.email, { startMinute: 1290, customer: { name: "Mr Park" } });
    expect(again.status).toBe(409);
    expect((await again.json()).error.code).toBe("time_taken");

    // Time off: the morning off, booked into.
    const offId = randomUUID();
    const nine = localTimeToMoment(day, 540, ZONE)!;
    await db.insert(commitment).values({
      id: offId,
      organizationId: summit.organizationId,
      resourceId: summit.personId,
      kind: "time_off",
      startsAt: nine,
      endsAt: new Date(nine.getTime() + 3 * 3_600_000),
    });
    try {
      const off = await book(summit.email, { startMinute: 600, customer: { name: "Ms Ito" } });
      expect(off.status).toBe(409);
    } finally {
      await db.delete(commitment).where(inArray(commitment.id, [offId]));
    }

    const yesterday = localDate(new Date(Date.now() - 86_400_000), ZONE);
    const past = await book(summit.email, { date: yesterday, customer: { name: "Mr Oak" } });
    expect(past.status).toBe(400);
    expect((await past.json()).error.code).toBe("in_the_past");
  });

  test("a person whose Google needs reconnecting is told so, never to try again", async () => {
    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(inArray(calendarConnection.resourceId, [summit.personId]));
    try {
      const response = await book(summit.email, { startMinute: 1380, customer: { name: "Mr Ng" } });
      expect(response.status).toBe(409);
      expect((await response.json()).error.code).toBe("reconnect_needed");
    } finally {
      await db
        .update(calendarConnection)
        .set({ status: "connected" })
        .where(inArray(calendarConnection.resourceId, [summit.personId]));
    }
  });

  test("a member without the permission cannot book by hand", async () => {
    const response = await book(helper.email, { startMinute: 1200, customer: { name: "Mr Fox" } });
    expect(response.status).toBe(403);
  });

  test("another business's person, an unknown service and a bad time are refused", async () => {
    expect((await book(summit.email, { personId: other.personId, startMinute: 1230 })).status).toBe(
      404
    );
    expect(
      (await book(summit.email, { bookingLinkId: randomUUID(), startMinute: 1230 })).status
    ).toBe(404);
    const late = await book(summit.email, { startMinute: 1440 });
    expect(late.status).toBe(400);
    expect(await late.json()).toMatchObject({ field: "startMinute" });
  });
});

// Step 12b.3: time off, with the bookings in its way moved or cancelled in one save. The first four
// names are the Simulate page's cases.
describe("time off (feature 12b)", () => {
  const ZONE = "America/Edmonton";
  // Each test owns its days, weeks ahead and apart from the tests above.
  const dayAhead = (days: number) => localDate(new Date(Date.now() + days * 86_400_000), ZONE);
  const json = (method: string, path: string, email: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
        Cookie: cookies.get(email)!,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const made: string[] = [];
  const bookOn = async (date: string, startMinute: number, name: string) => {
    const response = await json("POST", "/schedule/bookings", summit.email, {
      bookingLinkId: serviceId,
      personId: summit.personId,
      date,
      startMinute,
      customer: { name, email: `${name.toLowerCase()}-${tag}@example.com` },
    });
    expect(response.status).toBe(201);
    const { booking: madeOne } = await response.json();
    made.push(madeOne.id);
    return madeOne.id as string;
  };
  const wholeDay = (date: string) => ({
    resourceId: summit.personId,
    from: { date, minute: 0 },
    to: { date, minute: 1440 },
  });
  const timeOffOf = async (date: string) =>
    (
      await db
        .select()
        .from(commitment)
        .where(inArray(commitment.resourceId, [summit.personId]))
    ).filter(
      (row) =>
        row.kind === "time_off" && row.status === "active" && localDate(row.startsAt, ZONE) === date
    );
  const bookingOf = async (id: string) =>
    (
      await db
        .select({ status: booking.status, startsAt: booking.startsAt })
        .from(booking)
        .where(inArray(booking.id, [id]))
    )[0];
  const emailsOf = async (bookingId: string) =>
    (
      (await db.execute(
        sql`select jobs.payload->>'kind' as kind from ${sql.identifier(jobSchema)}._private_jobs jobs
            join ${sql.identifier(jobSchema)}._private_tasks tasks on tasks.id = jobs.task_id
            where tasks.identifier = 'booking_email' and jobs.payload->>'bookingId' = ${bookingId}
            order by kind`
      )) as unknown as { kind: string }[]
    ).map((job) => job.kind);

  afterAll(async () => {
    await db.execute(
      sql`delete from ${sql.identifier(jobSchema)}._private_jobs where payload->>'bookingId' in ${made.length ? made : ["none"]}`
    );
  });

  test("time off with no bookings in the way is saved", async () => {
    const day = dayAhead(30);
    const saved = await json("POST", "/schedule/time-off", summit.email, {
      resourceId: summit.personId,
      from: { date: day, minute: 780 }, // 1 pm
      to: { date: day, minute: 1020 }, // 5 pm
      bookings: [],
    });
    expect(saved.status).toBe(201);
    expect(await timeOffOf(day)).toHaveLength(1);
    // Nobody books into it, the owner included.
    const into = await json("POST", "/schedule/bookings", summit.email, {
      bookingLinkId: serviceId,
      personId: summit.personId,
      date: day,
      startMinute: 840,
      customer: { name: "Mr Into" },
    });
    expect(into.status).toBe(409);
  });

  test("time off over a booking with no choice is refused, and nothing is saved", async () => {
    const day = dayAhead(33);
    const ana = await bookOn(day, 600, "Ana");
    const refused = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [],
    });

    expect(refused.status).toBe(409);
    const body = await refused.json();
    expect(body.error.code).toBe("bookings_in_the_way");
    expect(body.bookings).toMatchObject([
      {
        id: ana,
        customerName: "Ana",
        serviceName: "Estimate",
        started: false,
        people: expect.arrayContaining([{ id: summit.personId, name: "Carlos" }]),
      },
    ]);
    expect(await timeOffOf(day)).toEqual([]);
    expect((await bookingOf(ana)).status).toBe("confirmed");
  });

  test("one booking moved and one cancelled in one save: the time off is saved and both customers are told", async () => {
    const day = dayAhead(36);
    const nextDay = dayAhead(37);
    const ana = await bookOn(day, 600, "Ana");
    const ben = await bookOn(day, 840, "Ben");

    const saved = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [
        {
          bookingId: ana,
          action: "move",
          date: nextDay,
          startMinute: 540,
          personId: summit.personId,
        },
        { bookingId: ben, action: "cancel" },
      ],
    });
    expect(saved.status).toBe(201);
    expect(await timeOffOf(day)).toHaveLength(1);
    const moved = await bookingOf(ana);
    expect(moved.status).toBe("confirmed");
    expect(localDate(moved.startsAt, ZONE)).toBe(nextDay);
    expect((await bookingOf(ben)).status).toBe("cancelled");
    // Each customer hears what happened to their own booking; the business is not told what it did.
    expect(await emailsOf(ana)).toContain("booking_move");
    expect(await emailsOf(ana)).not.toContain("booking_move_notification");
    expect(await emailsOf(ben)).toContain("booking_cancellation");
    expect(await emailsOf(ben)).not.toContain("booking_cancellation_notification");
  });

  test("a move to a time taken meanwhile saves nothing, not even the cancel", async () => {
    const day = dayAhead(40);
    const nextDay = dayAhead(41);
    const ana = await bookOn(day, 600, "Ana");
    const ben = await bookOn(day, 840, "Ben");
    // While the owner was choosing, someone else took the next day at 9 am.
    await bookOn(nextDay, 540, "Cara");

    const refused = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [
        {
          bookingId: ana,
          action: "move",
          date: nextDay,
          startMinute: 540,
          personId: summit.personId,
        },
        { bookingId: ben, action: "cancel" },
      ],
    });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ error: { code: "time_taken" }, bookingId: ana });
    expect((await bookingOf(ben)).status).toBe("confirmed");
    expect(localDate((await bookingOf(ana)).startsAt, ZONE)).toBe(day);
    expect(await timeOffOf(day)).toEqual([]);
  });

  test("two moves to one free time save nothing: the second is refused inside the one transaction", async () => {
    const day = dayAhead(44);
    const nextDay = dayAhead(45);
    const ana = await bookOn(day, 600, "Ana");
    const ben = await bookOn(day, 840, "Ben");

    const refused = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [
        {
          bookingId: ana,
          action: "move",
          date: nextDay,
          startMinute: 600,
          personId: summit.personId,
        },
        {
          bookingId: ben,
          action: "move",
          date: nextDay,
          startMinute: 600,
          personId: summit.personId,
        },
      ],
    });
    expect(refused.status).toBe(409);
    // Both still on their own day, and no time off: the first move was undone with the second.
    expect(localDate((await bookingOf(ana)).startsAt, ZONE)).toBe(day);
    expect(localDate((await bookingOf(ben)).startsAt, ZONE)).toBe(day);
    expect(await timeOffOf(day)).toEqual([]);
  });

  test("a move inside the time off itself is refused", async () => {
    const day = dayAhead(48);
    const ana = await bookOn(day, 600, "Ana");
    const refused = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [
        { bookingId: ana, action: "move", date: day, startMinute: 900, personId: summit.personId },
      ],
    });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toMatchObject({ bookingId: ana });
    expect(await timeOffOf(day)).toEqual([]);
  });

  test("removing time off frees the time", async () => {
    const day = dayAhead(52);
    const saved = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [],
    });
    const { timeOff } = await saved.json();

    expect((await json("DELETE", `/schedule/time-off/${timeOff.id}`, summit.email)).status).toBe(
      204
    );
    expect(await timeOffOf(day)).toEqual([]);
    await bookOn(day, 600, "Dee"); // free again
    expect((await json("DELETE", `/schedule/time-off/${timeOff.id}`, summit.email)).status).toBe(
      404
    );
  });

  test("a member without the permission cannot mark time off or remove it, nor touch another business's", async () => {
    const day = dayAhead(56);
    const asHelper = await json("POST", "/schedule/time-off", helper.email, {
      ...wholeDay(day),
      bookings: [],
    });
    expect(asHelper.status).toBe(403);
    const theirs = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      resourceId: other.personId,
      bookings: [],
    });
    expect(theirs.status).toBe(404);
    const saved = await json("POST", "/schedule/time-off", summit.email, {
      ...wholeDay(day),
      bookings: [],
    });
    const { timeOff } = await saved.json();
    expect((await json("DELETE", `/schedule/time-off/${timeOff.id}`, helper.email)).status).toBe(
      403
    );
    expect((await json("DELETE", `/schedule/time-off/${timeOff.id}`, other.email)).status).toBe(
      404
    );
    expect(await timeOffOf(day)).toHaveLength(1);
  });

  test("the dashboard's browser may send the remove: its preflight allows DELETE", async () => {
    const preflight = await app.request(`/schedule/time-off/${randomUUID()}`, {
      method: "OPTIONS",
      headers: { Origin: appOrigin, "Access-Control-Request-Method": "DELETE" },
    });
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("DELETE");
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe(appOrigin);
  });

  test("time off that ends before it starts is refused", async () => {
    const day = dayAhead(58);
    const backwards = await json("POST", "/schedule/time-off", summit.email, {
      resourceId: summit.personId,
      from: { date: day, minute: 900 },
      to: { date: day, minute: 600 },
      bookings: [],
    });
    expect(backwards.status).toBe(400);
    expect(await backwards.json()).toMatchObject({ field: "to" });
  });
});
