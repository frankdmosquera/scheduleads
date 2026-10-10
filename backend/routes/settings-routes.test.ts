// The owner's Hours settings, called through the real app against the local database. Every
// business, person and login here is a throwaway made below and removed after.

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { addDays } from "@scheduleads-app/shared/add-days";
import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";
import { localDate } from "@scheduleads-app/shared/local-date";

import { localTimeToMoment } from "../lib/local-time/local-time-to-moment.js";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

// The sign-in helper reads codes from the console, so no real email is ever sent.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the settings route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { findServiceResources } = await import("../lib/scheduling/find-service-resources.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const {
  availabilityRule,
  booking,
  bookingLink,
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
  email: `hours-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-hours-${letter}-${tag}-dev`,
  personId: randomUUID(),
});
const summit = makeTenant("s"); // has hours, a person and a place
const other = makeTenant("o"); // another business, with no hours yet
const fresh = makeTenant("f"); // a business just made on the client setup screen: no hours
const booked = makeTenant("b"); // has hours, bookings, Juan following its week and Ana on her own
const helper = { userId: randomUUID(), email: `hours-m-${tag}@example.com` }; // a member of Summit
const summitPlaceId = randomUUID();
const bookedAnaId = randomUUID();
const bookedStageId = randomUUID();
const estimateId = randomUUID();

// A Tuesday at least two days ahead in Edmonton, so its bookings are still to come.
let tuesday = addDays(localDate(new Date(), "America/Edmonton"), 2);
while (new Date(`${tuesday}T12:00:00Z`).getUTCDay() !== 2) tuesday = addDays(tuesday, 1);
const onTuesday = (minute: number) => localTimeToMoment(tuesday, minute, "America/Edmonton")!;

// One customer, their lead and a booking on that Tuesday with Booked's Estimate.
async function makeBooking(
  customerName: string,
  personId: string,
  fromMinute: number,
  status = "confirmed",
  placeId: string | null = null
) {
  const [contactId, leadId, bookingId] = [randomUUID(), randomUUID(), randomUUID()];
  const organizationId = booked.organizationId;
  await db.insert(contact).values({ id: contactId, organizationId, name: customerName });
  await db
    .insert(lead)
    .values({ id: leadId, organizationId, contactId, stageId: bookedStageId, source: "widget" });
  const [startsAt, endsAt] = [onTuesday(fromMinute), onTuesday(fromMinute + 60)];
  await db.insert(booking).values({
    id: bookingId,
    organizationId,
    leadId,
    bookingLinkId: estimateId,
    personId,
    startsAt,
    endsAt,
    status,
    placeId,
  });
  return { bookingId, leadId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

const nineToFive = { startMinute: 540, endMinute: 1020 };
const summitHours = {
  weeklyHours: { mon: [nineToFive], tue: [nineToFive] },
  dateHours: [],
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 60,
};

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

const get = (path: string, email: string) =>
  app.request(path, { headers: { Origin: appOrigin, Cookie: cookies.get(email)! } });
const put = (path: string, email: string, body: unknown) =>
  app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: appOrigin, Cookie: cookies.get(email)! },
    body: JSON.stringify(body),
  });

const businessRowOf = async (organizationId: string) =>
  (
    await db
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
  )[0];

beforeAll(async () => {
  await db.insert(user).values(
    [summit, other, fresh, booked, helper].map((t) => ({
      id: t.userId,
      name: "",
      email: t.email,
      emailVerified: true,
    }))
  );
  await db.insert(organization).values(
    [summit, other, fresh, booked].map((t) => ({
      id: t.organizationId,
      name: t.slug,
      slug: t.slug,
    }))
  );
  await db.insert(member).values([
    ...[summit, other, fresh, booked].map((t) => ({
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
    ...[summit, other, fresh, booked].map((t) => ({
      id: t.personId,
      organizationId: t.organizationId,
      name: "Juan",
      kind: "person",
    })),
    { id: summitPlaceId, organizationId: summit.organizationId, name: "Room 1", kind: "place" },
    { id: bookedAnaId, organizationId: booked.organizationId, name: "Ana", kind: "person" },
  ]);
  await db.insert(availabilityRule).values([
    ...[summit, booked].map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      resourceId: null,
      ...summitHours,
      closedDates: [],
    })),
    {
      // Ana keeps her own Tuesday, 8:00 to 6:00.
      id: randomUUID(),
      organizationId: booked.organizationId,
      resourceId: bookedAnaId,
      weeklyHours: { tue: [{ startMinute: 480, endMinute: 1080 }] },
      dateHours: [],
    },
  ]);
  await db
    .insert(pipelineStage)
    .values({ id: bookedStageId, organizationId: booked.organizationId, name: "New", position: 0 });
  await db.insert(bookingLink).values({
    id: estimateId,
    organizationId: booked.organizationId,
    name: "Estimate",
    slug: "estimate",
    durationMinutes: 60,
    layout: "month",
    asksAddress: false,
    personChoice: "customer_picks",
  });
  for (const email of [summit.email, other.email, fresh.email, booked.email, helper.email])
    cookies.set(email, await signIn(email));
});

afterAll(async () => {
  await db.delete(organization).where(
    inArray(
      organization.id,
      [summit, other, fresh, booked].map((t) => t.organizationId)
    )
  );
  await db
    .delete(user)
    .where(
      inArray(user.id, [summit.userId, other.userId, fresh.userId, booked.userId, helper.userId])
    );
  await db.$client.end();
});

describe("the Hours settings", () => {
  test("a member who may not change the business cannot save hours", async () => {
    // The member reads the hours, told they cannot change them; the owner can.
    const read = await get("/settings/hours", helper.email);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ canEdit: false, business: summitHours });
    const ownerRead = await get("/settings/hours", summit.email);
    expect(await ownerRead.json()).toMatchObject({ canEdit: true });

    // Both saves are refused, and nothing changed.
    const week = { ...summitHours, weeklyHours: { mon: [{ startMinute: 600, endMinute: 660 }] } };
    expect((await put("/settings/hours/business", helper.email, week)).status).toBe(403);
    const personSave = await put(`/settings/hours/people/${summit.personId}`, helper.email, {
      weeklyHours: null,
      dateHours: [],
    });
    expect(personSave.status).toBe(403);
    expect((await businessRowOf(summit.organizationId)).weeklyHours).toEqual(
      summitHours.weeklyHours
    );
  });

  test("another business's person and a place get the same 404", async () => {
    const hours = { weeklyHours: { wed: [nineToFive] }, dateHours: [] };
    const foreign = await put(`/settings/hours/people/${other.personId}`, summit.email, hours);
    const place = await put(`/settings/hours/people/${summitPlaceId}`, summit.email, hours);
    const unknown = await put(`/settings/hours/people/${randomUUID()}`, summit.email, hours);
    expect([foreign.status, place.status, unknown.status]).toEqual([404, 404, 404]);
    const [a, b, c] = await Promise.all([foreign.json(), place.json(), unknown.json()]);
    expect(a).toEqual(c);
    expect(b).toEqual(c);

    // The other business's person got no row of Summit's or their own.
    const rows = await db
      .select()
      .from(availabilityRule)
      .where(inArray(availabilityRule.resourceId, [other.personId, summitPlaceId]));
    expect(rows).toEqual([]);
  });

  test("a person's save before the business has hours is refused", async () => {
    const response = await put(`/settings/hours/people/${other.personId}`, other.email, {
      weeklyHours: { mon: [nineToFive] },
      dateHours: [],
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "no_business_hours" } });
  });

  test("the first save makes the business's row and later saves keep its closed days and holidays", async () => {
    expect(await (await get("/settings/hours", fresh.email)).json()).toMatchObject({
      business: null,
      people: [{ id: fresh.personId, name: "Juan", weeklyHours: null, dateHours: [] }],
    });

    // The first save makes the row, with no closed days and no holidays; windows are stored in order.
    const first = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      weeklyHours: {
        mon: [
          { startMinute: 780, endMinute: 1020 },
          { startMinute: 540, endMinute: 720 },
        ],
      },
    });
    expect(first.status).toBe(200);
    const made = await businessRowOf(fresh.organizationId);
    expect(made.weeklyHours).toEqual({
      mon: [
        { startMinute: 540, endMinute: 720 },
        { startMinute: 780, endMinute: 1020 },
      ],
    });
    expect([made.closedDates, made.holidayCountry, made.closedHolidays]).toEqual([[], null, []]);

    // The closed days screen (12e) sets these; a later hours save must leave them alone.
    await db
      .update(availabilityRule)
      .set({
        closedDates: ["2026-12-24"],
        holidayCountry: "CA",
        holidayRegion: "AB",
        closedHolidays: ["Family Day"],
      })
      .where(eq(availabilityRule.id, made.id));
    const later = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      timezone: "America/Toronto",
      horizonDays: 30,
    });
    expect(later.status).toBe(200);
    const kept = await businessRowOf(fresh.organizationId);
    expect(kept.id).toBe(made.id);
    expect([kept.timezone, kept.horizonDays]).toEqual(["America/Toronto", 30]);
    expect([
      kept.closedDates,
      kept.holidayCountry,
      kept.holidayRegion,
      kept.closedHolidays,
    ]).toEqual([["2026-12-24"], "CA", "AB", ["Family Day"]]);

    // And the save cannot be used to send them: they are not part of what it takes.
    const sneaky = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      closedDates: [],
    });
    expect(sneaky.status).toBe(400);

    // A refused save says where the problem is, so the card can show it in place.
    const overlap = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      weeklyHours: { mon: [nineToFive, { startMinute: 960, endMinute: 1080 }] },
    });
    expect(overlap.status).toBe(400);
    expect(await overlap.json()).toMatchObject({
      error: { code: "bad_request", message: "Two windows on the same day overlap." },
      field: "weeklyHours.mon",
    });
  });

  test("back to the business's week keeps the person's one-off dates", async () => {
    const oneOff = [{ date: "2026-11-02", windows: [{ startMinute: 480, endMinute: 600 }] }];
    const own = await put(`/settings/hours/people/${summit.personId}`, summit.email, {
      weeklyHours: { sat: [nineToFive] },
      dateHours: oneOff,
    });
    expect(own.status).toBe(200);

    const back = await put(`/settings/hours/people/${summit.personId}`, summit.email, {
      weeklyHours: null,
      dateHours: oneOff,
    });
    expect(back.status).toBe(200);
    const read = (await (await get("/settings/hours", summit.email)).json()) as {
      people: { id: string; weeklyHours: unknown; dateHours: unknown }[];
    };
    expect(read.people.find((person) => person.id === summit.personId)).toMatchObject({
      weeklyHours: null,
      dateHours: oneOff,
    });
  });

  test("a save lists the upcoming bookings it leaves outside and changes none", async () => {
    // Tuesday is 9:00 to 5:00. Juan follows the business; Ana keeps her own 8:00 to 6:00.
    const maria = await makeBooking("Maria", booked.personId, 960); // 4:00
    await makeBooking("Kim", booked.personId, 600); // 10:00, still inside
    await makeBooking("Sam", booked.personId, 960, "cancelled");
    await makeBooking("Lee", bookedAnaId, 960); // her own week does not move
    const [before] = await db.select().from(booking).where(eq(booking.id, maria.bookingId));

    const shortened = {
      ...summitHours,
      weeklyHours: { ...summitHours.weeklyHours, tue: [{ startMinute: 540, endMinute: 900 }] },
    };
    const saved = await put("/settings/hours/business", booked.email, shortened);
    expect(saved.status).toBe(200);
    expect(((await saved.json()) as { outsideHours: unknown }).outsideHours).toEqual([
      { ...maria, customerName: "Maria", serviceName: "Estimate", personName: "Juan" },
    ]);
    const [after] = await db.select().from(booking).where(eq(booking.id, maria.bookingId));
    expect(after).toEqual(before);

    // The same hours again: it was already outside, so nothing is listed.
    const again = await put("/settings/hours/business", booked.email, shortened);
    expect(((await again.json()) as { outsideHours: unknown }).outsideHours).toEqual([]);
  });

  test("a person's first own week lists their bookings it leaves outside", async () => {
    // After the save above, Tuesday is 9:00 to 3:00 and Juan, with no row yet, follows it. His own
    // Tuesday from noon leaves Kim's 10:00 out; Maria's 4:00 was already outside, so is not listed.
    const saved = await put(`/settings/hours/people/${booked.personId}`, booked.email, {
      weeklyHours: { tue: [{ startMinute: 720, endMinute: 1020 }] },
      dateHours: [],
    });
    expect(saved.status).toBe(200);
    const listed = ((await saved.json()) as { outsideHours: { customerName: string }[] })
      .outsideHours;
    expect(listed.map((row) => row.customerName)).toEqual(["Kim"]);
  });
});

const post = (path: string, email: string, body: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: appOrigin, Cookie: cookies.get(email)! },
    body: JSON.stringify(body),
  });

const cabinet = {
  name: "Cabinet consultation",
  description: "",
  durationMinutes: 45,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 15,
  slotIntervalMinutes: null,
  personChoice: "customer_picks",
  asksAddress: false,
  active: true,
};

type SavedServiceType = { service: { id: string; slug: string; name: string } };

describe("the Services settings", () => {
  test("a member who may not change the business cannot save a service", async () => {
    const read = await get("/settings/services", helper.email);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ canEdit: false });

    expect((await post("/settings/services", helper.email, cabinet)).status).toBe(403);
    const changed = await put(`/settings/services/${randomUUID()}`, helper.email, cabinet);
    expect(changed.status).toBe(403);
    const services = await db
      .select({ name: bookingLink.name })
      .from(bookingLink)
      .where(eq(bookingLink.organizationId, summit.organizationId));
    expect(services.map((service) => service.name)).not.toContain(cabinet.name);
  });

  test("another business's service gets the 404", async () => {
    const theirs = (await (
      await post("/settings/services", other.email, cabinet)
    ).json()) as SavedServiceType;
    const foreign = await put(`/settings/services/${theirs.service.id}`, summit.email, {
      ...cabinet,
      name: "Taken over",
    });
    const unknown = await put(`/settings/services/${randomUUID()}`, summit.email, cabinet);
    expect([foreign.status, unknown.status]).toEqual([404, 404]);
    expect(await foreign.json()).toEqual(await unknown.json());
    const [row] = await db.select().from(bookingLink).where(eq(bookingLink.id, theirs.service.id));
    expect(row.name).toBe(cabinet.name);
  });

  test("a new service gets a unique slug and the month layout, and a rename keeps the slug", async () => {
    const first = (await (
      await post("/settings/services", summit.email, cabinet)
    ).json()) as SavedServiceType;
    const second = await post("/settings/services", summit.email, cabinet);
    expect(second.status).toBe(201);
    const secondService = ((await second.json()) as SavedServiceType).service;
    expect([first.service.slug, secondService.slug]).toEqual([
      "cabinet-consultation",
      "cabinet-consultation-2",
    ]);

    const renamed = await put(`/settings/services/${first.service.id}`, summit.email, {
      ...cabinet,
      name: "Kitchen cabinets",
    });
    expect(renamed.status).toBe(200);
    const [row] = await db.select().from(bookingLink).where(eq(bookingLink.id, first.service.id));
    expect([row.name, row.slug, row.layout, row.description]).toEqual([
      "Kitchen cabinets",
      "cabinet-consultation",
      "month",
      null,
    ]);

    // A refused save says where the problem is, so the form can show it in place.
    const refused = await post("/settings/services", summit.email, {
      ...cabinet,
      durationMinutes: 0,
    });
    expect(refused.status).toBe(400);
    expect(await refused.json()).toMatchObject({ field: "durationMinutes" });
  });

  test("a hidden service is no longer offered and its bookings stay", async () => {
    const listed = async () =>
      (
        (await (await app.request(`/public/${booked.slug}/booking-links`)).json()) as {
          bookingLinks: { id: string }[];
        }
      ).bookingLinks.map((service) => service.id);
    expect(await listed()).toContain(estimateId);
    const lee = await makeBooking("Lee", bookedAnaId, 600, "confirmed");

    const [estimate] = await db.select().from(bookingLink).where(eq(bookingLink.id, estimateId));
    const hidden = await put(`/settings/services/${estimateId}`, booked.email, {
      name: estimate.name,
      description: estimate.description,
      durationMinutes: estimate.durationMinutes,
      bufferBeforeMinutes: estimate.bufferBeforeMinutes,
      bufferAfterMinutes: estimate.bufferAfterMinutes,
      slotIntervalMinutes: estimate.slotIntervalMinutes,
      personChoice: estimate.personChoice,
      asksAddress: estimate.asksAddress,
      active: false,
    });
    expect(hidden.status).toBe(200);
    expect(await listed()).not.toContain(estimateId);
    const [still] = await db.select().from(booking).where(eq(booking.id, lee.bookingId));
    expect([still.status, still.bookingLinkId]).toEqual(["confirmed", estimateId]);
  });
});

type SavedResourceType = {
  resource: { id: string; name: string; kind: string; active: boolean };
  upcomingBookings: { bookingId: string }[];
};

describe("the People settings", () => {
  test("the last active person cannot be turned off", async () => {
    // Fresh has one person, Juan; a place does not count as someone on.
    const room = await post("/settings/people", fresh.email, { name: "Chair 1", kind: "place" });
    expect(room.status).toBe(201);
    const off = await put(`/settings/people/${fresh.personId}`, fresh.email, {
      name: "Juan",
      active: false,
    });
    expect(off.status).toBe(409);
    expect(await off.json()).toMatchObject({ error: { code: "last_person" } });
    const [juan] = await db.select().from(resource).where(eq(resource.id, fresh.personId));
    expect(juan.active).toBe(true);

    // A place may go off: bookings never need one to exist.
    const { resource: chair } = (await room.json()) as SavedResourceType;
    const chairOff = await put(`/settings/people/${chair.id}`, fresh.email, {
      name: "Chair 1",
      active: false,
    });
    expect(chairOff.status).toBe(200);
  });

  test("a name another person or place already has is refused", async () => {
    const added = await post("/settings/people", summit.email, { name: " juan ", kind: "place" });
    expect(added.status).toBe(409);
    expect(await added.json()).toMatchObject({ error: { code: "name_taken" }, field: "name" });
    const renamed = await put(`/settings/people/${summitPlaceId}`, summit.email, {
      name: "JUAN",
      active: true,
    });
    expect(renamed.status).toBe(409);

    // Its own name, in another case, is not taken from itself.
    const same = await put(`/settings/people/${summitPlaceId}`, summit.email, {
      name: "ROOM 1",
      active: true,
    });
    expect(same.status).toBe(200);
    // Another business's person: the same 404 as an unknown id.
    const foreign = await put(`/settings/people/${other.personId}`, summit.email, {
      name: "Taken over",
      active: true,
    });
    expect(foreign.status).toBe(404);
  });

  test("a turned-off person is not offered, and their bookings stay and are listed", async () => {
    const pat = await makeBooking("Pat", bookedAnaId, 600);
    const off = await put(`/settings/people/${bookedAnaId}`, booked.email, {
      name: "Ana",
      active: false,
    });
    expect(off.status).toBe(200);
    const answer = (await off.json()) as SavedResourceType;
    expect(answer.resource.active).toBe(false);
    expect(answer.upcomingBookings.map((row) => row.bookingId)).toContain(pat.bookingId);

    const [still] = await db.select().from(booking).where(eq(booking.id, pat.bookingId));
    expect([still.status, still.personId]).toEqual(["confirmed", bookedAnaId]);
    const offered = await findServiceResources(booked.organizationId, estimateId, {
      serviceMayBeOff: true,
    });
    expect(offered?.peopleIds).not.toContain(bookedAnaId);
    const hours = (await (await get("/settings/hours", booked.email)).json()) as {
      people: { id: string }[];
    };
    expect(hours.people.map((person) => person.id)).not.toContain(bookedAnaId);

    // On again: offered again, and nothing is listed.
    const on = await put(`/settings/people/${bookedAnaId}`, booked.email, {
      name: "Ana",
      active: true,
    });
    expect(((await on.json()) as SavedResourceType).upcomingBookings).toEqual([]);
    const back = await findServiceResources(booked.organizationId, estimateId, {
      serviceMayBeOff: true,
    });
    expect(back?.peopleIds).toContain(bookedAnaId);
  });

  test("a place turned off lists the bookings that use it", async () => {
    const bay = (await (
      await post("/settings/people", booked.email, { name: "Bay 1", kind: "place" })
    ).json()) as SavedResourceType;
    const rio = await makeBooking("Rio", booked.personId, 690, "confirmed", bay.resource.id);
    await makeBooking("Sol", booked.personId, 750); // no place: not listed
    const off = await put(`/settings/people/${bay.resource.id}`, booked.email, {
      name: "Bay 1",
      active: false,
    });
    expect(off.status).toBe(200);
    const listed = ((await off.json()) as SavedResourceType).upcomingBookings;
    expect(listed.map((row) => row.bookingId)).toEqual([rio.bookingId]);
  });
});
