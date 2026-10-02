// The public booking routes, called through the real app against the local seeded
// database (npm run db:seed). Needs local Postgres running; refuses any other database.

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
assertLocalDevDatabase(process.env.DATABASE_URL, "run the public route tests");

// Imported after the env is loaded: both read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  calendarConnection,
  organization,
  resource,
} = await import("@scheduleads-app/shared/db");
const { localDate } = await import("../lib/local-time/local-date.js");
const { addDays } = await import("../lib/local-time/add-days.js");

const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

// Rows this file adds, and removes after. A random tag keeps them apart from the seed.
const tag = randomUUID().slice(0, 8);
const noHours = { id: randomUUID(), slug: `test-no-hours-${tag}-dev`, linkId: randomUUID() };
const noBooking = { id: randomUUID(), slug: `test-no-booking-${tag}-dev`, linkId: randomUUID() };
const switchedOffLinkId = randomUUID();
// A clinic of its own whose one practitioner's calendar needs reconnecting, so it cannot be read.
const unreadable = {
  id: randomUUID(),
  slug: `test-unreadable-${tag}-dev`,
  linkId: randomUUID(),
  personId: randomUUID(),
};
let paintingLinkId = "";
let clinicLinkId = "";

const get = (path: string, origin?: string) =>
  app.request(path, origin ? { headers: { Origin: origin } } : undefined);

beforeAll(async () => {
  const [painting] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(inArray(organization.slug, ["painting-dev"]));
  if (!painting) throw new Error("painting-dev is missing: run npm run db:seed first.");

  const paintingList = await (await get("/public/painting-dev/booking-links")).json();
  const clinicList = await (await get("/public/clinic-dev/booking-links")).json();
  paintingLinkId = paintingList.bookingLinks[0].id;
  clinicLinkId = clinicList.bookingLinks[0].id;

  await db.insert(organization).values([
    { id: noHours.id, name: "Test, no hours", slug: noHours.slug }, // agency plan, no hours row
    // No real tier lacks booking until feature 23, so an unrecognised plan stands in for one.
    { id: noBooking.id, name: "Test, no booking", slug: noBooking.slug, plan: "no-booking-test" },
    { id: unreadable.id, name: "Test, unreadable calendar", slug: unreadable.slug },
  ]);
  const mondays = {
    weeklyHours: { mon: [{ startMinute: 540, endMinute: 1020 }] },
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 0,
    horizonDays: 30,
    closedDates: [],
  };
  await db.insert(availabilityRule).values([
    { id: randomUUID(), organizationId: noBooking.id, ...mondays },
    { id: randomUUID(), organizationId: unreadable.id, ...mondays },
  ]);
  await db.insert(resource).values({
    id: unreadable.personId,
    organizationId: unreadable.id,
    name: "Mei",
    kind: "person",
  });
  await db.insert(calendarConnection).values({
    id: randomUUID(),
    organizationId: unreadable.id,
    resourceId: unreadable.personId,
    provider: "google",
    accountEmail: "mei@example.com",
    credentials: "not read: the connection needs reconnecting first",
    grantedScopes: "",
    status: "needs_reconnect",
  });
  await db.insert(bookingLink).values([
    {
      id: noHours.linkId,
      organizationId: noHours.id,
      name: "Test",
      slug: "test",
      durationMinutes: 30,
    },
    {
      id: noBooking.linkId,
      organizationId: noBooking.id,
      name: "Test",
      slug: "test",
      durationMinutes: 30,
    },
    {
      id: unreadable.linkId,
      organizationId: unreadable.id,
      name: "Facial",
      slug: "facial",
      durationMinutes: 60,
    },
    {
      id: switchedOffLinkId,
      organizationId: painting.id,
      name: `Switched off ${tag}`,
      slug: `switched-off-${tag}`,
      durationMinutes: 30,
      active: false,
    },
  ]);
  await db.insert(bookingLinkResource).values({
    organizationId: unreadable.id,
    bookingLinkId: unreadable.linkId,
    resourceId: unreadable.personId,
  });
});

afterAll(async () => {
  // Their links and hours go with them (cascade).
  await db
    .delete(organization)
    .where(inArray(organization.id, [noHours.id, noBooking.id, unreadable.id]));
  await db.delete(bookingLink).where(inArray(bookingLink.id, [switchedOffLinkId]));
  await db.$client.end();
});

describe("the documented shape", () => {
  test("the list gives a business's active services, by name, and nothing else", async () => {
    const response = await get("/public/painting-dev/booking-links");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body)).toEqual(["bookingLinks"]);
    expect(body.bookingLinks.map((link: { name: string }) => link.name)).toEqual([
      "Colour consultation",
      "Exterior estimate",
      "Interior estimate",
    ]); // the switched-off one is not listed
    for (const link of body.bookingLinks) {
      expect(Object.keys(link).sort()).toEqual(
        [
          "bufferAfterMinutes",
          "bufferBeforeMinutes",
          "description",
          "durationMinutes",
          "id",
          "name",
          "slug",
        ].sort()
      );
    }
  });

  test("one service comes with the business's bookable hours", async () => {
    const response = await get(`/public/painting-dev/booking-links/${paintingLinkId}`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["availability", "bookingLink"]);
    expect(body.bookingLink.id).toBe(paintingLinkId);
    expect(Object.keys(body.availability).sort()).toEqual(
      [
        "closedDates",
        "dateHours",
        "horizonDays",
        "minimumNoticeMinutes",
        "timezone",
        "weeklyHours",
      ].sort()
    );
    expect(body.availability.timezone).toBe("America/Edmonton");
  });

  test("no answer carries organizationId, or whose week answered", async () => {
    const list = await (await get("/public/painting-dev/booking-links")).text();
    const one = await (await get(`/public/painting-dev/booking-links/${paintingLinkId}`)).text();

    for (const text of [list, one]) {
      expect(text).not.toContain("organizationId");
      expect(text).not.toContain("source");
    }
  });
});

describe("every 'not here' is the identical 404", () => {
  const unknownId = randomUUID();
  const cases: [string, () => string][] = [
    [
      "an unknown business",
      () => `/public/no-such-business-${tag}/booking-links/${paintingLinkId}`,
    ],
    ["an unknown service", () => `/public/painting-dev/booking-links/${unknownId}`],
    ["a switched-off service", () => `/public/painting-dev/booking-links/${switchedOffLinkId}`],
    ["another business's service", () => `/public/painting-dev/booking-links/${clinicLinkId}`],
    [
      "a business with no hours yet",
      () => `/public/${noHours.slug}/booking-links/${noHours.linkId}`,
    ],
    ["a plan without booking", () => `/public/${noBooking.slug}/booking-links/${noBooking.linkId}`],
    ["an unknown business's list", () => `/public/no-such-business-${tag}/booking-links`],
    ["the list of a business with no hours", () => `/public/${noHours.slug}/booking-links`],
    ["the list of a plan without booking", () => `/public/${noBooking.slug}/booking-links`],
  ];

  test.each(cases)("%s", async (_name, path) => {
    const response = await get(path());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Nothing is bookable here." },
    });
  });
});

describe("a malformed address is a 400, in the same error shape", () => {
  test.each([
    ["a slug with a space", "/public/painting%20dev/booking-links"],
    ["a slug in capitals", "/public/Painting-Dev/booking-links"],
    ["an id with a quote", `/public/painting-dev/booking-links/abc'def`],
  ])("%s", async (_name, path) => {
    const response = await get(path);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(typeof body.error.message).toBe("string");
  });
});

describe("free times for a service", () => {
  // A week starting a week from today on the clinic's clock: inside its horizon, past its notice.
  const today = localDate(new Date(), "America/Edmonton");
  const from = addDays(today, 7);
  const to = addDays(today, 13);
  let facialPath = "";
  let luisId = "";
  let paintingPersonId = "";

  type FreeTimesBodyType = {
    timezone: string;
    people: { id: string; name: string }[];
    startTimes: string[];
  };

  beforeAll(async () => {
    const clinicList = await (await get("/public/clinic-dev/booking-links")).json();
    const facial = clinicList.bookingLinks.find(
      (link: { name: string }) => link.name === "Deep Cleansing Facial"
    );
    facialPath = `/public/clinic-dev/booking-links/${facial.id}/times`;

    // Luis does massages only, so he is the clinic's person not offered for a facial.
    const [luis] = await db
      .select({ id: resource.id })
      .from(resource)
      .innerJoin(organization, eq(organization.id, resource.organizationId))
      .where(and(eq(organization.slug, "clinic-dev"), eq(resource.name, "Luis")));
    const [paintingPerson] = await db
      .select({ id: resource.id })
      .from(resource)
      .innerJoin(organization, eq(organization.id, resource.organizationId))
      .where(and(eq(organization.slug, "painting-dev"), eq(resource.kind, "person")))
      .limit(1);
    if (!luis || !paintingPerson) throw new Error("The seed is missing: run npm run db:seed.");
    luisId = luis.id;
    paintingPersonId = paintingPerson.id;

    // A dev login can connect a real calendar to a seeded practitioner; no test may reach Google.
    vi.stubGlobal("fetch", async () => {
      throw new Error("These tests never call Google.");
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("dates past the horizon answer no times, and nothing is read for them", async () => {
    // The last date the clock can hold: reading time around it would fail in the database.
    const response = await get(`${facialPath}?from=9999-12-30&to=9999-12-31`);

    expect(response.status).toBe(200);
    expect((await response.json()).startTimes).toEqual([]);
  });

  test("a picked practitioner: the time zone, who can be picked, and their start times", async () => {
    const anyAvailable = await (await get(`${facialPath}?from=${from}&to=${to}`)).json();
    const ana = anyAvailable.people.find((person: { name: string }) => person.name === "Ana");
    const response = await get(`${facialPath}?from=${from}&to=${to}&person=${ana.id}`);
    const body: FreeTimesBodyType = await response.json();

    expect(response.status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(["people", "startTimes", "timezone"]);
    expect(body.timezone).toBe("America/Edmonton");
    expect(body.people.map((person) => person.name)).toEqual(["Ana", "Mei", "Sofia"]);
    for (const person of body.people) expect(Object.keys(person).sort()).toEqual(["id", "name"]);
    expect(body.startTimes.length).toBeGreaterThan(0);
    for (const time of body.startTimes) {
      expect(new Date(time).toISOString()).toBe(time); // an instant in UTC
      const date = localDate(new Date(time), body.timezone);
      expect(date >= from && date <= to).toBe(true);
    }
    expect([...body.startTimes].sort()).toEqual(body.startTimes);
  });

  test('"any available" when no person is asked for: everyone\'s times together', async () => {
    const anyAvailable: FreeTimesBodyType = await (
      await get(`${facialPath}?from=${from}&to=${to}`)
    ).json();
    const union = new Set<string>();
    for (const person of anyAvailable.people) {
      const own: FreeTimesBodyType = await (
        await get(`${facialPath}?from=${from}&to=${to}&person=${person.id}`)
      ).json();
      for (const time of own.startTimes) union.add(time);
    }

    expect(anyAvailable.startTimes).toEqual([...union].sort());
  });

  test.each([
    ["a date that does not exist", () => "?from=2026-02-30&to=2026-03-01"],
    ["a missing date", () => `?from=${from}`],
    ["the last date before the first", () => `?from=${to}&to=${from}`],
    ["more than 31 dates", () => `?from=${from}&to=${addDays(from, 31)}`],
    ["a malformed person id", () => `?from=${from}&to=${to}&person=abc'def`],
  ])("%s is a 400", async (_name, query) => {
    const response = await get(`${facialPath}${query()}`);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("bad_request");
    expect(typeof body.error.message).toBe("string");
  });

  test.each([
    [
      "an unknown business",
      () => `/public/no-such-business-${tag}/booking-links/${clinicLinkId}/times`,
    ],
    [
      "a switched-off service",
      () => `/public/painting-dev/booking-links/${switchedOffLinkId}/times`,
    ],
    [
      "another business's service",
      () => `/public/painting-dev/booking-links/${clinicLinkId}/times`,
    ],
    ["a person not offered for the service", () => `${facialPath}?person=${luisId}`],
    ["another business's person", () => `${facialPath}?person=${paintingPersonId}`],
  ])("%s is the identical 404", async (_name, path) => {
    const separator = path().includes("?") ? "&" : "?";
    const response = await get(`${path()}${separator}from=${from}&to=${to}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Nothing is bookable here." },
    });
  });

  test("a calendar that cannot be read is a 503, never an empty week", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const path = `/public/${unreadable.slug}/booking-links/${unreadable.linkId}/times`;
    const picked = await get(`${path}?from=${from}&to=${to}&person=${unreadable.personId}`);
    const anyAvailable = await get(`${path}?from=${from}&to=${to}`);
    warn.mockRestore();

    expect(picked.status).toBe(503);
    expect(await picked.json()).toEqual({
      error: { code: "unavailable", message: "Times cannot be read right now. Try again shortly." },
    });
    // With "any available" she is the only one, so no calendar could be read at all (decision 9).
    expect(anyAvailable.status).toBe(503);
    expect((await anyAvailable.json()).error.code).toBe("unavailable");
  });

  test("no answer carries the business, standby or calendar details", async () => {
    const text = await (await get(`${facialPath}?from=${from}&to=${to}`)).text();

    for (const word of ["organizationId", "standby", "calendar", "google", "connection"]) {
      expect(text.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });
});

describe("the login cookie is never allowed", () => {
  test("an allowed site is named back, without credentials", async () => {
    const response = await get("/public/painting-dev/booking-links", dashboardOrigin);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(dashboardOrigin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("a preflight allows GET and POST only, without credentials", async () => {
    const response = await app.request("/public/painting-dev/booking-links", {
      method: "OPTIONS",
      headers: { Origin: dashboardOrigin, "Access-Control-Request-Method": "GET" },
    });

    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET,POST");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("a 404 carries no credentials either", async () => {
    const response = await get(
      `/public/painting-dev/booking-links/${randomUUID()}`,
      dashboardOrigin
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("a site not on the list is not named back", async () => {
    const response = await get("/public/painting-dev/booking-links", "https://not-listed.example");

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });
});
