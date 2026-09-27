// The public booking routes, called through the real app against the local seeded
// database (npm run db:seed). Needs local Postgres running; refuses any other database.

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

// Like the seed: only a database on this machine whose name ends in _dev. These tests add
// rows and remove them, which must never happen anywhere else.
const databaseUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing/none");
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
if (!localHosts.has(databaseUrl.hostname) || !databaseUrl.pathname.endsWith("_dev")) {
  throw new Error(
    `Refusing to run the public route tests against ${databaseUrl.hostname}${databaseUrl.pathname}. ` +
      "They only run against a local database whose name ends in _dev."
  );
}

// Imported after the env is loaded: both read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { availabilityRule, bookingLink, organization } = await import("@scheduleads-app/shared/db");

const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";

// Rows this file adds, and removes after. A random tag keeps them apart from the seed.
const tag = randomUUID().slice(0, 8);
const noHours = { id: randomUUID(), slug: `test-no-hours-${tag}-dev`, linkId: randomUUID() };
const noBooking = { id: randomUUID(), slug: `test-no-booking-${tag}-dev`, linkId: randomUUID() };
const switchedOffLinkId = randomUUID();
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
  ]);
  await db.insert(availabilityRule).values({
    id: randomUUID(),
    organizationId: noBooking.id,
    weeklyHours: { mon: [{ startMinute: 540, endMinute: 1020 }] },
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 0,
    horizonDays: 30,
    closedDates: [],
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
      id: switchedOffLinkId,
      organizationId: painting.id,
      name: `Switched off ${tag}`,
      slug: `switched-off-${tag}`,
      durationMinutes: 30,
      active: false,
    },
  ]);
});

afterAll(async () => {
  // Their links and hours go with them (cascade).
  await db.delete(organization).where(inArray(organization.id, [noHours.id, noBooking.id]));
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

describe("the login cookie is never allowed", () => {
  test("an allowed site is named back, without credentials", async () => {
    const response = await get("/public/painting-dev/booking-links", dashboardOrigin);

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(dashboardOrigin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("a preflight allows GET only, without credentials", async () => {
    const response = await app.request("/public/painting-dev/booking-links", {
      method: "OPTIONS",
      headers: { Origin: dashboardOrigin, "Access-Control-Request-Method": "GET" },
    });

    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET");
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
