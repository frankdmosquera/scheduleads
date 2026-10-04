// The customer's booking page route, called through the real app against the local database.
// Bookings go into businesses of this file's own, removed after (their rows go with them). Google
// and Resend are never called: fetch throws, nobody here has a calendar or a Resend key.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
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
const { bookingEventRemovals } = await import("../lib/booking/booking-event-removals.js");
const { bookingCancellationEmails } = await import("../lib/booking/booking-cancellation-emails.js");
const { makeBookingPageToken } = await import("../lib/booking/booking-page-token.js");
const { addDays } = await import("../lib/local-time/add-days.js");
const { localDate } = await import("../lib/local-time/local-date.js");
const { localTimeToMoment } = await import("../lib/local-time/local-time-to-moment.js");
const { booking } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3400";
const jane = {
  name: "Jane Doe",
  email: `jane-${tag}@example.com`,
  phone: "403 555 0148",
  location: "12 Main Street, Calgary",
  details: "Two bedrooms, ceilings too",
};

// A business of its own: Marco does interior estimates (60 minutes, 15 after), every day 9 to 5.
// Its first booking is a week from today at 9:00, by the real clock: the routes read it.
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
    weeklyHours: Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => [
        day,
        [{ startMinute: 540, endMinute: 1020 }],
      ])
    ),
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

  const made = { business, marco, estimate, timezone, slug: `test-page-${name}-${tag}-dev` };
  const first = await bookFor(made, 540);
  // Marco gets hours of his own after the booking: a person's row carries no zone.
  await db
    .insert(availabilityRule)
    .values({ id: id(), organizationId: business, resourceId: marco });
  return { ...made, bookingId: first.bookingId, startsAt: first.startsAt };
}

type MadeType = { business: string; marco: string; estimate: string; timezone: string };

// The day a week from today in the business's zone.
const dayAhead = (timezone: string) => addDays(localDate(new Date(), timezone), 7);

// A booking for Jane on that day, at a minute of the day.
async function bookFor(made: MadeType, minuteOfDay: number) {
  const startsAt = localTimeToMoment(dayAhead(made.timezone), minuteOfDay, made.timezone)!;
  const result = await bookTime({
    organizationId: made.business,
    bookingLinkId: made.estimate,
    personId: made.marco,
    startsAt,
    requestKey: randomUUID(),
    customer: { name: jane.name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: new Date(),
  });
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return { bookingId: result.booking.id, startsAt };
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
  await bookingEventRemovals.settled();
  await bookingCancellationEmails.settled();
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
        canCancel: true,
        canMove: true,
        service: "Interior estimate",
        startsAt: primo.startsAt.toISOString(),
        // The appointment itself, not its 15 after.
        endsAt: new Date(primo.startsAt.getTime() + 60 * 60_000).toISOString(),
        timezone: "America/Edmonton",
        person: "Marco",
        personId: primo.marco,
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

const cancelOf = (token: string) =>
  app.request(`/public/bookings/${encodeURIComponent(token)}/cancel`, { method: "POST" });
const statusOf = async (bookingId: string) =>
  (await db.select({ status: booking.status }).from(booking).where(eq(booking.id, bookingId)))[0]
    ?.status;
const freeTimes = async () => {
  const day = dayAhead(primo.timezone);
  const response = await app.request(
    `/public/${primo.slug}/booking-links/${primo.estimate}/times?from=${day}&to=${day}&person=${primo.marco}`
  );
  return (await response.json()).startTimes as string[];
};
const changedSignature = (token: string) => {
  const [id, signature] = token.split(".");
  return `${id}.${signature.slice(0, -2)}${signature.at(-2) === "A" ? "B" : "A"}${signature.at(-1)}`;
};

describe("cancelling from the page", () => {
  test("a cancel frees the time: the free-times route offers it again", async () => {
    const { bookingId, startsAt } = await bookFor(primo, 900); // 15:00
    expect(await freeTimes()).not.toContain(startsAt.toISOString());

    const response = await cancelOf(makeBookingPageToken(bookingId));

    expect(response.status).toBe(200);
    expect((await response.json()).booking).toMatchObject({
      status: "cancelled",
      canCancel: false,
    });
    expect(await freeTimes()).toContain(startsAt.toISOString());
  });

  test("a cancelled booking's page still opens, and pressing again answers the same", async () => {
    const { bookingId } = await bookFor(primo, 780); // 13:00
    const token = makeBookingPageToken(bookingId);
    const first = await (await cancelOf(token)).text();
    const again = await cancelOf(token);

    expect(again.status).toBe(200);
    expect(await again.text()).toBe(first);
    const page = await pageOf(token);
    expect(page.status).toBe(200);
    expect((await page.json()).booking).toMatchObject({
      status: "cancelled",
      canCancel: false,
      canMove: false,
    });
  });

  test("a started booking is refused with 409 and nothing changes", async () => {
    const { bookingId } = await bookFor(other, 660); // 11:00
    const started = new Date(Date.now() - 10 * 60_000);
    await db
      .update(booking)
      .set({ startsAt: started, endsAt: new Date(started.getTime() + 60 * 60_000) })
      .where(eq(booking.id, bookingId));
    const token = makeBookingPageToken(bookingId);

    const response = await cancelOf(token);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "already_started",
        message: "This booking has already started. Call the business to change it.",
      },
    });
    expect(await statusOf(bookingId)).toBe("confirmed");
    const page = (await (await pageOf(token)).json()).booking;
    expect(page.canCancel).toBe(false);
    expect(page.canMove).toBe(false);
  });

  test("a bad link cancels nothing, with the same 404 as the page", async () => {
    const { bookingId } = await bookFor(primo, 720); // 12:00
    for (const bad of [
      changedSignature(makeBookingPageToken(bookingId)),
      "hello",
      makeBookingPageToken(randomUUID()),
    ]) {
      const response = await cancelOf(bad);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "This link does not open a booking." },
      });
    }
    expect(await statusOf(bookingId)).toBe("confirmed");
  });

  test("the cancel's answer carries none of the customer's details, and is never cached", async () => {
    const { bookingId } = await bookFor(other, 780); // 13:00
    const response = await cancelOf(makeBookingPageToken(bookingId));
    const text = await response.text();

    for (const detail of ["Jane", jane.email, jane.phone, jane.location, jane.details]) {
      expect(text).not.toContain(detail);
    }
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
