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

  const clinicDev = await (await app.request("/public/clinic-dev/booking-links")).json();
  if (!clinicDev.bookingLinks) throw new Error("clinic-dev is missing: run npm run db:seed first.");
  clinicDevFacialId = clinicDev.bookingLinks[0].id;
});

afterAll(async () => {
  await workDueJobs(); // no job outlives the database
  vi.unstubAllGlobals();
  await db.delete(organization).where(inArray(organization.id, [clinic.id])); // its rows go with it
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
      .select({ source: lead.source })
      .from(booking)
      .innerJoin(lead, eq(lead.id, booking.leadId))
      .where(and(eq(booking.organizationId, clinic.id), eq(booking.id, body.booking.id)));
    expect(saved?.source).toBe("widget");
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

describe("a booked form sent again after its service changed", () => {
  // Decision 7: a form that booked gets that booking back, whatever changed since (F-258).
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

  test("a request over 16 KB is a 413 and books nothing", async () => {
    const [startsAt] = await freeTimes(clinic.ana);
    const response = await post(bookingsPath, form(startsAt, { details: "a".repeat(17_000) }));

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
