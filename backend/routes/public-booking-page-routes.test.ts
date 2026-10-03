// The customer's booking page route, called through the real app against the local database.
// Bookings go into businesses of this file's own, removed after (their rows go with them). Google
// and Resend are never called: fetch throws, nobody here has a calendar or a Resend key.

import { randomUUID } from "node:crypto";

import { like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the link key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking page route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { bookTime } = await import("../lib/booking/book-time.js");
const { bookingEventWrites } = await import("../lib/booking/booking-event-writes.js");
const { bookingConfirmationEmails } = await import("../lib/booking/booking-confirmation-emails.js");
const { makeBookingPageToken } = await import("../lib/booking/booking-page-token.js");

const tag = randomUUID().slice(0, 8);
const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3000";
const jane = {
  name: "Jane Doe",
  email: `jane-${tag}@example.com`,
  phone: "403 555 0148",
  location: "12 Main Street, Calgary",
  details: "Two bedrooms, ceilings too",
};

// A business of its own: Marco does interior estimates (60 minutes, 15 after), Mondays 9 to 12.
async function makeBusiness(name: string, businessName: string, timezone = "America/Edmonton") {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({
    id: business,
    name: businessName,
    slug: `test-page-${name}-${tag}-dev`,
    logo: "https://ik.imagekit.io/primo/logo.png",
    brandColor: "#1d4ed8",
    phone: "(403) 555-0100",
    website: "https://primopainters.com",
  });
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: business,
    resourceId: null,
    weeklyHours: { mon: [{ startMinute: 540, endMinute: 720 }] },
    timezone,
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
    bufferAfterMinutes: 15,
  });
  await db
    .insert(bookingLinkResource)
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: marco });

  const result = await bookTime({
    organizationId: business,
    bookingLinkId: estimate,
    personId: marco,
    startsAt: new Date("2026-10-05T15:00:00Z"), // Monday 9:00 in Edmonton
    requestKey: randomUUID(),
    customer: { name: jane.name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: new Date("2026-10-02T14:00:00Z"),
  });
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  // Marco gets hours of his own after the booking: a person's row carries no zone.
  await db
    .insert(availabilityRule)
    .values({ id: id(), organizationId: business, resourceId: marco });
  return { business, bookingId: result.booking.id };
}

let primo: Awaited<ReturnType<typeof makeBusiness>>;
let other: Awaited<ReturnType<typeof makeBusiness>>;
const pageOf = (token: string) => app.request(`/public/bookings/${encodeURIComponent(token)}`);

beforeAll(async () => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests never call Google or Resend.");
  });
  vi.spyOn(console, "log").mockImplementation(() => {}); // the businesses send no email: one line each
  primo = await makeBusiness("primo", "Primo Painters");
  other = await makeBusiness("other", "Other Painting", "America/Toronto");
});

afterAll(async () => {
  await bookingEventWrites.settled();
  await bookingConfirmationEmails.settled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.delete(organization).where(like(organization.slug, `test-page-%-${tag}-dev`));
  await db.$client.end();
});

describe("the customer's booking page", () => {
  test("the route answers the page's view for a real link and 404 for every bad one, with the same body", async () => {
    const token = makeBookingPageToken(primo.bookingId);
    const response = await pageOf(token);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      booking: {
        status: "confirmed",
        service: "Interior estimate",
        startsAt: "2026-10-05T15:00:00.000Z",
        endsAt: "2026-10-05T16:00:00.000Z", // the appointment itself, not its 15 after
        timezone: "America/Edmonton",
        person: "Marco",
        business: {
          name: "Primo Painters",
          logo: "https://ik.imagekit.io/primo/logo.png",
          brandColor: "#1d4ed8",
          phone: "(403) 555-0100",
          website: "https://primopainters.com",
        },
      },
    });

    const [id, signature] = token.split(".");
    const otherSignature = makeBookingPageToken(other.bookingId).split(".")[1];
    const bodies = new Set<string>();
    for (const bad of [
      `${id}.${signature.slice(0, -2)}${signature.at(-2) === "A" ? "B" : "A"}${signature.at(-1)}`, // one changed character
      token.slice(0, -1), // cut off
      `${id}.${otherSignature}`, // another booking's signature
      makeBookingPageToken(randomUUID()), // signed right, for a booking that does not exist
      "hello",
    ]) {
      const refused = await pageOf(bad);
      expect(refused.status).toBe(404);
      bodies.add(await refused.text());
    }
    expect([...bodies]).toEqual([
      JSON.stringify({
        error: { code: "not_found", message: "This link does not open a booking." },
      }),
    ]);
  });

  test("the page says its own business's zone, never another's or a person's hours row", async () => {
    const mine = await (await pageOf(makeBookingPageToken(primo.bookingId))).json();
    const theirs = await (await pageOf(makeBookingPageToken(other.bookingId))).json();

    expect(mine.booking.timezone).toBe("America/Edmonton");
    expect(theirs.booking.timezone).toBe("America/Toronto");
  });

  test("each link opens its own business's booking only", async () => {
    const mine = await (await pageOf(makeBookingPageToken(primo.bookingId))).json();
    const theirs = await (await pageOf(makeBookingPageToken(other.bookingId))).json();

    expect(mine.booking.business.name).toBe("Primo Painters");
    expect(theirs.booking.business.name).toBe("Other Painting");
  });

  test("the view carries none of the customer's details, and is never cached", async () => {
    const response = await pageOf(makeBookingPageToken(primo.bookingId));
    const text = await response.text();

    for (const detail of [
      "Jane",
      jane.email,
      jane.phone,
      jane.location,
      jane.details,
      primo.business,
    ]) {
      expect(text).not.toContain(detail);
    }
    expect(text).not.toContain("organizationId");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect((await pageOf("hello")).headers.get("Cache-Control")).toBe("no-store");
  });

  test("a browser on the dashboard may read it, never with the login cookie", async () => {
    const response = await app.request(
      `/public/bookings/${makeBookingPageToken(primo.bookingId)}`,
      {
        headers: { Origin: dashboardOrigin },
      }
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(dashboardOrigin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
