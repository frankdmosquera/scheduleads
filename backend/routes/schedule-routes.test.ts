// The Calendar page's week (feature 12b), called through the real app against the local database,
// with Google faked: no test ever reaches Google. Every business, login, person and booking here
// is a throwaway made below and removed after. Test names match the feature's planned checks.

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

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
const {
  availabilityRule,
  booking,
  bookingLink,
  commitment,
  contact,
  lead,
  member,
  organization,
  pipelineStage,
  resource,
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

// The week of Monday Nov 16, 2026, in Edmonton (MST, UTC-7, after the autumn change).
const WEEK = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];
const at = (iso: string) => new Date(iso);
const tuesdayTen = { start: "2026-11-17T17:00:00.000Z", end: "2026-11-17T18:00:00.000Z" }; // 10 to 11
const fridayOff = { start: "2026-11-20T20:00:00.000Z", end: "2026-11-21T00:00:00.000Z" }; // 1 to 5 pm
const wednesdayGoogle = { start: "2026-11-18T16:00:00.000Z", end: "2026-11-18T16:30:00.000Z" }; // 9 to 9:30

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
      closedDates: ["2026-11-19"], // Thursday
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
    const response = await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-11-18`);
    expect(response.status).toBe(200);
    const week = await response.json();

    expect(week).toMatchObject({
      canEdit: true,
      timezone: "America/Edmonton",
      weekOf: "2026-11-16", // the Monday of the week asked for
      resource: { id: summit.personId, name: "Carlos", kind: "person" },
      google: "read",
    });
    expect(week.days.map((day: DayType) => day.date)).toEqual(WEEK);
    // Hours past the customers' one-day horizon still show; Thursday is closed; the weekend has none.
    expect(dayOf(week.days, "2026-11-16").hours).toEqual([{ startMinute: 480, endMinute: 1020 }]);
    expect(dayOf(week.days, "2026-11-19")).toMatchObject({ closed: true, hours: [] });
    expect(dayOf(week.days, "2026-11-21").hours).toEqual([]);

    // Tuesday: the booking with its customer, once: its own Google event is not shown again.
    expect(dayOf(week.days, "2026-11-17").items).toEqual([
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
    expect(dayOf(week.days, "2026-11-18").items).toEqual([
      { kind: "google_busy", startsAt: wednesdayGoogle.start, endsAt: wednesdayGoogle.end },
    ]);
    // Friday's time off ends at midnight UTC, still Friday afternoon in Edmonton: Friday only.
    expect(dayOf(week.days, "2026-11-20").items).toEqual([
      {
        kind: "time_off",
        id: expect.any(String),
        startsAt: fridayOff.start,
        endsAt: fridayOff.end,
      },
    ]);
    expect(dayOf(week.days, "2026-11-21").items).toEqual([]);
    // People first, then places, for the owner to pick between.
    expect(week.resources.map((one: { name: string }) => one.name)).toEqual([
      "Carlos",
      "Juan",
      "Van",
    ]);
  });

  test("a place's week shows the bookings that use it, and no Google", async () => {
    const week = await (
      await weekOf(summit.email, `?resourceId=${vanId}&weekOf=2026-11-16`)
    ).json();
    expect(week.google).toBe("not_connected");
    expect(dayOf(week.days, "2026-11-17").items).toMatchObject([
      { kind: "booking", booking: { customerName: "Ana Ruiz", personName: "Carlos" } },
    ]);
    expect(dayOf(week.days, "2026-11-20").items).toEqual([]); // Carlos's time off is his, not the van's
  });

  test("Google unreadable still shows the rest of the week", async () => {
    freeBusyAnswer = () => json({ error: { code: 500 } }, 500);
    const week = await (
      await weekOf(summit.email, `?resourceId=${summit.personId}&weekOf=2026-11-16`)
    ).json();

    expect(week.google).toBe("unreadable");
    expect(dayOf(week.days, "2026-11-17").items).toMatchObject([{ kind: "booking" }]);
    expect(dayOf(week.days, "2026-11-20").items).toMatchObject([{ kind: "time_off" }]);
    expect(warnings).toEqual([
      "[calendar] a week's Google busy times could not be read: Google's free/busy failed (500).",
    ]);
  });

  test("a member sees only their own calendar, and another business's resource is 404", async () => {
    const own = await weekOf(helper.email, "?weekOf=2026-11-16");
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

  test("no session is refused with 401", async () => {
    expect((await app.request("/schedule", { headers: { Origin: appOrigin } })).status).toBe(401);
  });
});
