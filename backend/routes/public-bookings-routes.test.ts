// The public booking route, called through the real app against the local database. Bookings go
// into a clinic of this file's own, removed after (its rows go with it), so a failed run never
// leaves bookings in the seeded clinic. Google is never called: fetch throws, a person with no
// connection has no Google busy time, and the unreadable case is a connection needing reconnection.

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

// These tests add rows and remove them, which must never happen anywhere else.
assertLocalDevDatabase(process.env.DATABASE_URL, "run the public booking route tests");

// Imported after the env is loaded: both read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const {
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  bookingQuestion,
  calendarConnection,
  lead,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { localDate } = await import("@scheduleads-app/shared/local-date");
const { workDueJobs } = await import("../lib/jobs/work-due-jobs.js");
const { addDays } = await import("@scheduleads-app/shared/add-days");

const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3400";
const tag = randomUUID().slice(0, 8);
const id = () => randomUUID();

// A clinic of its own, bookable every day 9:00 to 17:00: Ana and Mei do facials (60 minutes), Luis
// does none, and Kim's calendar needs reconnecting. A second facial is switched off. An estimate is
// one the business assigns (feature 9, decision 3): Ana does it, never picked by the customer.
const clinic = {
  id: id(),
  slug: `test-bookings-${tag}-dev`,
  facial: id(),
  switchedOff: id(),
  estimate: id(),
  ana: id(),
  mei: id(),
  luis: id(),
  kim: id(),
};
// Two more businesses, for the contact limits: a shop, counted apart from the clinic, and one with
// no pipeline stage, where every booking fails as it must without one.
const shop = { id: id(), slug: `test-bookings-shop-${tag}-dev`, quote: id(), sam: id() };
const bare = { id: id(), slug: `test-bookings-bare-${tag}-dev`, quote: id(), sam: id() };
const day = addDays(localDate(new Date(), "America/Edmonton"), 7); // inside the horizon, past notice
const bookingsPath = `/public/${clinic.slug}/bookings`;
let clinicDevFacialId = "";

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// The free start times of one person on the test day, from the times route itself.
async function freeTimes(personId: string): Promise<string[]> {
  const response = await app.request(
    `/public/${clinic.slug}/booking-links/${clinic.facial}/times?from=${day}&to=${day}&person=${personId}`
  );
  return (await response.json()).startTimes;
}

// A filled form; every test sends its own key unless it is testing the key.
const form = (startsAt: string, change: Record<string, unknown> = {}) => ({
  bookingLinkId: clinic.facial,
  startsAt,
  personId: clinic.ana,
  requestKey: id(),
  customer: { name: "Jane Doe", email: `jane-${tag}@example.com`, phone: "403 555 0100" },
  location: "12 Elm Street",
  details: "The front room",
  ...change,
});

beforeAll(async () => {
  // A dev login can connect a real calendar; no test may reach Google.
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests never call Google.");
  });

  await db.insert(organization).values({ id: clinic.id, name: "Test bookings", slug: clinic.slug });
  const everyDay = [{ startMinute: 540, endMinute: 1020 }];
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: clinic.id,
    resourceId: null,
    weeklyHours: {
      mon: everyDay,
      tue: everyDay,
      wed: everyDay,
      thu: everyDay,
      fri: everyDay,
      sat: everyDay,
      sun: everyDay,
    },
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 0,
    horizonDays: 30,
    closedDates: [],
  });
  await db
    .insert(pipelineStage)
    .values({ id: id(), organizationId: clinic.id, name: "New", position: 0 });
  await db.insert(resource).values([
    { id: clinic.ana, organizationId: clinic.id, name: "Ana", kind: "person" },
    { id: clinic.mei, organizationId: clinic.id, name: "Mei", kind: "person" },
    { id: clinic.luis, organizationId: clinic.id, name: "Luis", kind: "person" },
    { id: clinic.kim, organizationId: clinic.id, name: "Kim", kind: "person" },
  ]);
  await db.insert(calendarConnection).values({
    id: id(),
    organizationId: clinic.id,
    resourceId: clinic.kim,
    provider: "google",
    accountEmail: `kim-${tag}@example.com`,
    credentials: "not read: the connection needs reconnecting first",
    grantedScopes: "",
    status: "needs_reconnect",
  });
  await db.insert(bookingLink).values([
    {
      id: clinic.facial,
      organizationId: clinic.id,
      name: "Facial",
      slug: "facial",
      durationMinutes: 60,
      layout: "month",
      personChoice: "customer_picks",
    },
    {
      id: clinic.switchedOff,
      organizationId: clinic.id,
      name: "Old facial",
      slug: "old-facial",
      durationMinutes: 60,
      layout: "month",
      personChoice: "customer_picks",
      active: false,
    },
    {
      id: clinic.estimate,
      organizationId: clinic.id,
      name: "Estimate",
      slug: "estimate",
      durationMinutes: 60,
      layout: "month",
      personChoice: "business_assigns",
    },
  ]);
  await db.insert(bookingLinkResource).values(
    [clinic.ana, clinic.mei, clinic.kim].map((resourceId) => ({
      organizationId: clinic.id,
      bookingLinkId: clinic.facial,
      resourceId,
    }))
  );
  await db.insert(bookingLinkResource).values({
    organizationId: clinic.id,
    bookingLinkId: clinic.estimate,
    resourceId: clinic.ana,
  });

  for (const business of [shop, bare]) {
    await db
      .insert(organization)
      .values({ id: business.id, name: `Test ${business.slug}`, slug: business.slug });
    await db.insert(availabilityRule).values({
      id: id(),
      organizationId: business.id,
      resourceId: null,
      weeklyHours: {
        mon: everyDay,
        tue: everyDay,
        wed: everyDay,
        thu: everyDay,
        fri: everyDay,
        sat: everyDay,
        sun: everyDay,
      },
      timezone: "America/Edmonton",
      minimumNoticeMinutes: 0,
      horizonDays: 30,
      closedDates: [],
    });
    await db
      .insert(resource)
      .values({ id: business.sam, organizationId: business.id, name: "Sam", kind: "person" });
    await db.insert(bookingLink).values({
      id: business.quote,
      organizationId: business.id,
      name: "Quote",
      slug: "quote",
      durationMinutes: 60,
      layout: "month",
      personChoice: "customer_picks",
    });
    await db.insert(bookingLinkResource).values({
      organizationId: business.id,
      bookingLinkId: business.quote,
      resourceId: business.sam,
    });
  }
  await db
    .insert(pipelineStage)
    .values({ id: id(), organizationId: shop.id, name: "New", position: 0 });

  const clinicDev = await (await app.request("/public/clinic-dev/booking-links")).json();
  if (!clinicDev.bookingLinks) throw new Error("clinic-dev is missing: run npm run db:seed first.");
  clinicDevFacialId = clinicDev.bookingLinks[0].id;
});

afterAll(async () => {
  await workDueJobs(); // no job outlives the database
  vi.unstubAllGlobals();
  await db.delete(organization).where(inArray(organization.id, [clinic.id, shop.id, bare.id])); // its rows go with it
  await db.$client.end();
});

describe("a booking is made", () => {
  test("201 with the booking's times, service and person, and none of the customer's details", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(bookingsPath, form(startsAt));
    const text = await response.text();
    const body = JSON.parse(text);

    expect(response.status).toBe(201);
    expect(body).toEqual({
      booking: {
        id: expect.any(String),
        startsAt,
        endsAt: new Date(new Date(startsAt).getTime() + 60 * 60_000).toISOString(),
        timezone: "America/Edmonton",
        service: { id: clinic.facial, name: "Facial" },
        person: { id: clinic.ana, name: "Ana" },
      },
    });
    for (const word of [
      "Jane",
      "jane-",
      "403 555 0100",
      "Elm Street",
      "front room",
      "organizationId",
    ]) {
      expect(text).not.toContain(word);
    }
    // An online booking: its lead says it came from the widget.
    const [saved] = await db
      .select({ source: lead.source, answers: lead.answers })
      .from(booking)
      .innerJoin(lead, eq(lead.id, booking.leadId))
      .where(and(eq(booking.organizationId, clinic.id), eq(booking.id, body.booking.id)));
    expect(saved?.source).toBe("widget");
    expect(saved?.answers).toBeNull(); // this business asks no questions of its own
    expect(await freeTimes(clinic.ana)).not.toContain(startsAt); // the time is held
  });

  test("a service the business assigns books with nobody picked, and the business's person does it", async () => {
    const response = await app.request(
      `/public/${clinic.slug}/booking-links/${clinic.estimate}/times?from=${day}&to=${day}`
    );
    const [startsAt] = (await response.json()).startTimes;
    const { personId: _picked, ...unpicked } = form(startsAt, { bookingLinkId: clinic.estimate });
    const answer = await post(bookingsPath, unpicked);

    expect(answer.status).toBe(201);
    expect((await answer.json()).booking.person.name).toBe("Ana");
  });

  test("a phone alone is enough (decision 16)", async () => {
    const [startsAt] = await freeTimes(clinic.mei);
    const response = await post(
      bookingsPath,
      form(startsAt, { personId: clinic.mei, customer: { name: "Sam Lee", phone: "403 555 0101" } })
    );

    expect(response.status).toBe(201);
  });

  test("the same form sent twice gets the one booking, both times", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const once = form(startsAt);
    const first = await post(bookingsPath, once);
    const second = await post(bookingsPath, once);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((await second.json()).booking.id).toBe((await first.json()).booking.id);
  });
});

describe("the business's own questions (feature 9)", () => {
  const allergies = id();
  const firstVisit = id();
  const answerFor = (questionId: string, answer: string) => ({ questionId, answer });
  const refusal = async (response: Response) => {
    expect(response.status).toBe(400);
    return (await response.json()).error;
  };

  beforeAll(async () => {
    await db.insert(bookingQuestion).values([
      {
        id: allergies,
        organizationId: clinic.id,
        position: 1,
        label: "Any allergies or skin conditions?",
        required: true,
      },
      {
        id: firstVisit,
        organizationId: clinic.id,
        position: 2,
        label: "Is this your first visit?",
        required: false,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(bookingQuestion).where(eq(bookingQuestion.organizationId, clinic.id));
  });

  test("the answers are saved on the lead, with each question's words as asked", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(
      bookingsPath,
      form(startsAt, {
        answers: [answerFor(firstVisit, " Yes "), answerFor(allergies, "Latex")],
      })
    );
    const { booking: made } = await response.json();
    const [saved] = await db
      .select({ answers: lead.answers })
      .from(booking)
      .innerJoin(lead, eq(lead.id, booking.leadId))
      .where(eq(booking.id, made.id));

    expect(response.status).toBe(201);
    expect(saved?.answers).toEqual([
      { questionId: allergies, question: "Any allergies or skin conditions?", answer: "Latex" },
      { questionId: firstVisit, question: "Is this your first visit?", answer: "Yes" },
    ]);
  });

  test.each([
    ["left out", () => []],
    ["blank", () => [answerFor(allergies, "   ")]],
  ])("a required question %s is a 400 naming it, and books nothing", async (_name, answers) => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(bookingsPath, form(startsAt, { answers: answers() }));

    expect(await refusal(response)).toEqual({
      code: "bad_request",
      message: "Answer: Any allergies or skin conditions?",
    });
    expect(await freeTimes(clinic.ana)).toContain(startsAt);
  });

  test("an answer to a question this business does not have is a 400", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(
      bookingsPath,
      form(startsAt, { answers: [answerFor(allergies, "None"), answerFor(id(), "Yes")] })
    );

    expect((await refusal(response)).message).toBe("That is not one of this business's questions.");
  });

  test("two answers to one question are a 400", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(
      bookingsPath,
      form(startsAt, { answers: [answerFor(allergies, "None"), answerFor(allergies, "Latex")] })
    );

    expect((await refusal(response)).message).toBe("Each question takes one answer.");
  });

  // The form's own booking is looked up before its answers are judged.
  test("a booked form sent again after a required question was added still gets its booking", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const once = form(startsAt, { answers: [answerFor(allergies, "None")] });
    const first = await post(bookingsPath, once);
    const added = id();
    await db.insert(bookingQuestion).values({
      id: added,
      organizationId: clinic.id,
      position: 3,
      label: "Any pets at home?",
      required: true,
    });
    try {
      const again = await post(bookingsPath, once);

      expect(first.status).toBe(201);
      expect(again.status).toBe(201);
      expect((await again.json()).booking.id).toBe((await first.json()).booking.id);
    } finally {
      await db.delete(bookingQuestion).where(eq(bookingQuestion.id, added));
    }
  });

  test("twenty full answers in three-byte letters are not too large", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const answers = Array.from({ length: 20 }, () => answerFor(id(), "語".repeat(500)));
    const response = await post(bookingsPath, form(startsAt, { answers }));

    // Read whole and judged (they are not this business's questions), never cut off as too large.
    expect((await refusal(response)).message).toBe("That is not one of this business's questions.");
  });
});

describe("a booked form sent again after its service changed", () => {
  // Decision 7: a form that booked gets that booking back, whatever changed since.
  test("still gets its booking, after the business assigns and after the service is switched off", async () => {
    const [startsAt] = await freeTimes(clinic.mei);
    const once = form(startsAt, { personId: clinic.mei });
    const first = await post(bookingsPath, once);
    try {
      await db
        .update(bookingLink)
        .set({ personChoice: "business_assigns" })
        .where(eq(bookingLink.id, clinic.facial));
      const afterSwitch = await post(bookingsPath, once);
      await db.update(bookingLink).set({ active: false }).where(eq(bookingLink.id, clinic.facial));
      const afterOff = await post(bookingsPath, once);

      expect(first.status).toBe(201);
      const firstId = (await first.json()).booking.id;
      expect(afterSwitch.status).toBe(201);
      expect((await afterSwitch.json()).booking.id).toBe(firstId);
      expect(afterOff.status).toBe(201);
      expect((await afterOff.json()).booking.id).toBe(firstId);
    } finally {
      await db
        .update(bookingLink)
        .set({ personChoice: "customer_picks", active: true })
        .where(eq(bookingLink.id, clinic.facial));
    }
  });
});

describe("a booking is refused", () => {
  test("a time taken while booking is a 409 with decision 12's message", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    expect((await post(bookingsPath, form(startsAt))).status).toBe(201);
    const response = await post(bookingsPath, form(startsAt)); // another form, the same time

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "time_taken",
        message: "Sorry, that time was taken while you were booking. Please pick another one.",
      },
    });
  });

  test("a used form sent with a different booking is a 409", async () => {
    const [first, second] = await freeTimes(clinic.mei);
    const requestKey = id();
    expect(
      (await post(bookingsPath, form(first, { personId: clinic.mei, requestKey }))).status
    ).toBe(201);
    const response = await post(bookingsPath, form(second, { personId: clinic.mei, requestKey }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "request_key_used",
        message: "This booking form was already used. Please reload the page and book again.",
      },
    });
  });

  test("a picked person whose calendar cannot be read is a 503", async () => {
    const [startsAt] = await freeTimes(clinic.ana); // any time in her hours; Kim's are the same
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const response = await post(bookingsPath, form(startsAt, { personId: clinic.kim }));
    warn.mockRestore();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: { code: "unavailable", message: "Times cannot be read right now. Try again shortly." },
    });
  });

  test.each([
    ["an unknown business", () => `/public/no-such-business-${tag}/bookings`, {}],
    ["a switched-off service", () => bookingsPath, { bookingLinkId: clinic.switchedOff }],
    ["another business's service", () => bookingsPath, { bookingLinkId: "" }],
    ["a person not offered for the service", () => bookingsPath, { personId: clinic.luis }],
  ])("%s is the identical 404", async (_name, path, change) => {
    const [startsAt] = await freeTimes(clinic.ana);
    const body = form(startsAt, change);
    if (body.bookingLinkId === "") body.bookingLinkId = clinicDevFacialId;
    const response = await post(path(), body);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Nothing is bookable here." },
    });
  });

  test.each([
    ["a body that is not JSON", () => "{ not json", {}],
    [
      "a body sent as a form",
      () => "name=Jane",
      { "Content-Type": "application/x-www-form-urlencoded" },
    ],
    ["a start that is not an instant", () => form("2026-10-05T09:00:00"), {}],
    ["an empty address", () => form("2026-10-05T15:00:00Z", { location: "  " }), {}],
    [
      "neither a phone nor an email",
      () => form("2026-10-05T15:00:00Z", { customer: { name: "Jane Doe" } }),
      {},
    ],
  ])("%s is a 400, in the same error shape", async (_name, body, headers) => {
    const response = await post(bookingsPath, body(), headers);
    const answer = await response.json();

    expect(response.status).toBe(400);
    expect(answer.error.code).toBe("bad_request");
    expect(typeof answer.error.message).toBe("string");
  });

  test("a person sent for a service the business assigns is a 400 and books nothing", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const body = form(startsAt, { bookingLinkId: clinic.estimate, personId: clinic.ana });
    const response = await post(bookingsPath, body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "bad_request", message: "This service does not take a pick of person." },
    });
    const made = await db
      .select({ id: booking.id })
      .from(booking)
      .where(eq(booking.requestKey, body.requestKey));
    expect(made).toEqual([]);
  });

  test("a request over 64 KB is a 413 and books nothing", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(bookingsPath, form(startsAt, { details: "a".repeat(66_000) }));

    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("bad_request");
    expect(await freeTimes(clinic.ana)).toContain(startsAt);
  });
});

describe("the login cookie is never allowed", () => {
  test("a preflight allows POST, without credentials", async () => {
    const response = await app.request(bookingsPath, {
      method: "OPTIONS",
      headers: {
        Origin: dashboardOrigin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST");
    // Every booking is sent as JSON, so a browser must be allowed that header, or it books nothing.
    expect(response.headers.get("Access-Control-Allow-Headers")?.toLowerCase()).toContain(
      "content-type"
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(dashboardOrigin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});

describe("a contact's limit: 4 bookings in 10 minutes (feature 9, decision 8)", () => {
  // A day of its own for each test, so the bookings here never take another test's times.
  async function firstFreeTime(personId: string, onDay: string): Promise<string> {
    const response = await app.request(
      `/public/${clinic.slug}/booking-links/${clinic.facial}/times?from=${onDay}&to=${onDay}&person=${personId}`
    );
    const [startsAt] = (await response.json()).startTimes;
    if (!startsAt) throw new Error(`No free time left on ${onDay}.`);
    return startsAt;
  }
  const bookFor = async (customer: Record<string, string>, onDay: string) =>
    post(
      bookingsPath,
      form(await firstFreeTime(clinic.mei, onDay), { personId: clinic.mei, customer })
    );

  test("the 5th for one email is refused, while a second email from the same visitor still books", async () => {
    const onDay = addDays(day, 1);
    const jane = { name: "Jane Doe", email: `limit-${tag}@example.com` };
    for (let count = 0; count < 4; count++) expect((await bookFor(jane, onDay)).status).toBe(201);

    const refused = await bookFor({ ...jane, email: jane.email.toUpperCase() }, onDay);
    expect(refused.status).toBe(429);
    expect(Number(refused.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await refused.json()).error.code).toBe("too_many_tries");

    const other = { name: "Sam Doe", email: `other-${tag}@example.com` };
    expect((await bookFor(other, onDay)).status).toBe(201);
  });

  test("the 5th for one phone is refused, however it is written", async () => {
    const onDay = addDays(day, 2);
    const ways = [
      "+1 403 555 0177",
      "403-555-0177",
      "(403) 555 0177",
      "4035550177",
      "1 403 555 0177",
    ];
    for (const phone of ways.slice(0, 4))
      expect((await bookFor({ name: "Jane Doe", phone }, onDay)).status).toBe(201);

    expect((await bookFor({ name: "Jane Doe", phone: ways[4] }, onDay)).status).toBe(429);
  });

  test("a parent booking two children at the same time gets both", async () => {
    const onDay = addDays(day, 3);
    const startsAt = await firstFreeTime(clinic.ana, onDay);
    expect(await firstFreeTime(clinic.mei, onDay)).toBe(startsAt); // both free at the same time
    const parent = { name: "Pat Doe", email: `parent-${tag}@example.com`, phone: "403 555 0188" };

    const first = await post(
      bookingsPath,
      form(startsAt, { personId: clinic.ana, customer: parent })
    );
    const second = await post(
      bookingsPath,
      form(startsAt, { personId: clinic.mei, customer: parent })
    );
    expect([first.status, second.status]).toEqual([201, 201]);
  });

  test("a form sent again gets its booking even at the limit, and resends never count", async () => {
    const onDay = addDays(day, 5);
    const jane = { name: "Jane Doe", email: `resend-${tag}@example.com` };
    const first = form(await firstFreeTime(clinic.mei, onDay), {
      personId: clinic.mei,
      customer: jane,
    });
    const booked = await (await post(bookingsPath, first)).json();
    for (let count = 0; count < 3; count++) {
      const again = await post(bookingsPath, first);
      expect(again.status).toBe(201);
      expect((await again.json()).booking.id).toBe(booked.booking.id);
    }

    // One booking made so far: three more new ones fit, and the fourth's form, sent again at the
    // limit, still answers its booking.
    for (let count = 0; count < 2; count++) expect((await bookFor(jane, onDay)).status).toBe(201);
    const fourth = form(await firstFreeTime(clinic.mei, onDay), {
      personId: clinic.mei,
      customer: jane,
    });
    const fourthBooked = await (await post(bookingsPath, fourth)).json();
    const fourthAgain = await post(bookingsPath, fourth);
    expect(fourthAgain.status).toBe(201);
    expect((await fourthAgain.json()).booking.id).toBe(fourthBooked.booking.id);
    expect((await bookFor(jane, onDay)).status).toBe(429);
  });

  test("copies of one form arriving together count as the one booking they make", async () => {
    const onDay = addDays(day, 8);
    const jane = { name: "Jane Doe", email: `copies-${tag}@example.com` };
    const copies = form(await firstFreeTime(clinic.mei, onDay), {
      personId: clinic.mei,
      customer: jane,
    });
    const answers = await Promise.all([1, 2, 3, 4].map(() => post(bookingsPath, copies)));
    expect(answers.map((answer) => answer.status)).toEqual([201, 201, 201, 201]);

    for (let count = 0; count < 3; count++) expect((await bookFor(jane, onDay)).status).toBe(201);
    expect((await bookFor(jane, onDay)).status).toBe(429);
  });

  // The first free time at one of the two extra businesses, and a form for it.
  async function quoteForm(business: typeof shop, onDay: string, customer: Record<string, string>) {
    const response = await app.request(
      `/public/${business.slug}/booking-links/${business.quote}/times?from=${onDay}&to=${onDay}&person=${business.sam}`
    );
    const [startsAt] = (await response.json()).startTimes;
    return {
      ...form(startsAt, { personId: business.sam, customer }),
      bookingLinkId: business.quote,
    };
  }

  test("two businesses count the same email apart", async () => {
    const onDay = addDays(day, 6);
    const jane = { name: "Jane Doe", email: `two-places-${tag}@example.com` };
    for (let count = 0; count < 4; count++) expect((await bookFor(jane, onDay)).status).toBe(201);

    const atShop = await post(`/public/${shop.slug}/bookings`, await quoteForm(shop, onDay, jane));
    expect(atShop.status).toBe(201);
  });

  test("a booking that crashes does not count", async () => {
    const jane = { name: "Jane Doe", email: `crash-${tag}@example.com` };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    // Five fails, none refused as too many: each crash handed its count back.
    for (let count = 0; count < 5; count++) {
      const crashed = await post(`/public/${bare.slug}/bookings`, await quoteForm(bare, day, jane));
      expect(crashed.status).toBe(500);
    }
    quiet.mockRestore();
  });

  test("a booking refused for a taken time does not count", async () => {
    const onDay = addDays(day, 4);
    const startsAt = await firstFreeTime(clinic.mei, onDay);
    const jane = { name: "Jane Doe", email: `taken-${tag}@example.com` };
    expect((await post(bookingsPath, form(startsAt, { personId: clinic.mei }))).status).toBe(201);
    for (let count = 0; count < 3; count++) {
      const taken = await post(
        bookingsPath,
        form(startsAt, { personId: clinic.mei, customer: jane })
      );
      expect(taken.status).toBe(409);
    }

    for (let count = 0; count < 4; count++) expect((await bookFor(jane, onDay)).status).toBe(201);
  });
});
