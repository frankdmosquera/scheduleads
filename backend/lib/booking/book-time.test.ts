// Booking a time, against the local database. Every business here is a throwaway carrying this
// run's tag, removed after (its rows go with it). Google is never called: fetch throws unless a test
// fakes it, a person with no connection has no Google busy time, and the unreadable case is a
// connection marked as needing reconnection.

import { randomUUID } from "node:crypto";

import { and, eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  booking,
  bookingLink,
  bookingQuestion,
  bookingLinkResource,
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
const { bookTime } = await import("./book-time.js");
const { workDueJobs } = await import("../jobs/work-due-jobs.js");
const { holdFirstFreeChoice } = await import("./hold-first-free-choice.js");
const { holdTime } = await import("../scheduling/hold-time.js");
const { saveCalendarConnection } = await import("../calendar/save-calendar-connection.js");

const tag = randomUUID().slice(0, 8);
const fridayMorning = new Date("2026-10-02T14:00:00Z"); // 8:00 in Edmonton (UTC-6)
const at = (time: string) => new Date(`2026-10-05T${time}:00Z`); // Monday, in UTC
const NINE = at("15:00"); // 9:00 in Edmonton

// A clinic of its own: bookable Mondays 9:00 to 12:00, two hours' notice, stages New then Contacted.
// Ana and Mei do facials (75 minutes, 15 after) with no room; massages (60 minutes) need Room 3 or
// Room 4.
async function makeClinic(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({ id: business, name, slug: `test-book-${name}-${tag}` });
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: business,
    resourceId: null,
    weeklyHours: { mon: [{ startMinute: 540, endMinute: 720 }] },
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 120,
    horizonDays: 60,
    closedDates: [],
  });
  const [newStage, contacted] = [id(), id()];
  await db.insert(pipelineStage).values([
    { id: contacted, organizationId: business, name: "Contacted", position: 1 },
    { id: newStage, organizationId: business, name: "New", position: 0 },
  ]);
  const [ana, mei, room3, room4] = [id(), id(), id(), id()];
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: mei, organizationId: business, name: "Mei", kind: "person" },
    { id: room3, organizationId: business, name: "Room 3", kind: "place" },
    { id: room4, organizationId: business, name: "Room 4", kind: "place" },
  ]);
  const [facial, massage] = [id(), id()];
  await db.insert(bookingLink).values([
    {
      id: facial,
      organizationId: business,
      name: "Facial",
      slug: "facial",
      durationMinutes: 75,
      layout: "month",

      asksAddress: true,
      personChoice: "customer_picks",
      bufferAfterMinutes: 15,
    },
    {
      id: massage,
      organizationId: business,
      name: "Massage",
      slug: "massage",
      durationMinutes: 60,
      layout: "month",

      asksAddress: true,
      personChoice: "customer_picks",
    },
  ]);
  await db.insert(bookingLinkResource).values([
    { organizationId: business, bookingLinkId: facial, resourceId: ana },
    { organizationId: business, bookingLinkId: facial, resourceId: mei },
    { organizationId: business, bookingLinkId: massage, resourceId: ana },
    { organizationId: business, bookingLinkId: massage, resourceId: room3 },
    { organizationId: business, bookingLinkId: massage, resourceId: room4 },
  ]);
  return { business, newStage, ana, mei, room3, room4, facial, massage };
}

type ClinicType = Awaited<ReturnType<typeof makeClinic>>;

const customerBooking = (
  clinic: ClinicType,
  changes: Partial<Parameters<typeof bookTime>[0]> = {}
) =>
  bookTime({
    organizationId: clinic.business,
    bookingLinkId: clinic.facial,
    personId: clinic.ana,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: { name: "Jane", email: `jane-${tag}@example.com` },
    location: "12 Main Street",
    details: "Sensitive skin",
    source: "widget",
    actorUserId: null,
    now: fridayMorning,
    ...changes,
  });

async function makeOwner(clinic: ClinicType, name: string) {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name, email: `owner-${name}-${tag}@example.com` });
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: clinic.business, userId, role: "owner" });
  return userId;
}

const ownerBooking = (
  clinic: ClinicType,
  actorUserId: string,
  changes: Partial<Parameters<typeof bookTime>[0]> = {}
) => customerBooking(clinic, { source: "manual", actorUserId, requestKey: null, ...changes });

const rowsOf = async (business: string) => ({
  contacts: await db.select().from(contact).where(eq(contact.organizationId, business)),
  leads: await db.select().from(lead).where(eq(lead.organizationId, business)),
  bookings: await db.select().from(booking).where(eq(booking.organizationId, business)),
  commitments: await db
    .select()
    .from(commitment)
    .where(and(eq(commitment.organizationId, business), eq(commitment.kind, "booking"))),
  activities: await db.select().from(activity).where(eq(activity.organizationId, business)),
});

const bookedOrThrow = (result: Awaited<ReturnType<typeof bookTime>>) => {
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking;
};

beforeEach(() => {
  vi.stubGlobal("fetch", async () => {
    throw new Error("These tests never call Google.");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  await workDueJobs(); // no job outlives the database
  await db.delete(organization).where(like(organization.slug, `test-book-%-${tag}`));
  await db.delete(user).where(like(user.email, `owner-%-${tag}@example.com`));
  await db.$client.end();
});

describe("booking a time", () => {
  test("a picked practitioner's booking writes everything", async () => {
    const clinic = await makeClinic("picked");
    const result = await customerBooking(clinic);
    const booked = bookedOrThrow(result);
    const rows = await rowsOf(clinic.business);

    expect(result).toMatchObject({ booked: true, alreadyBooked: false });
    expect(booked).toMatchObject({
      personId: clinic.ana,
      placeId: null,
      startsAt: NINE,
      endsAt: at("16:15"),
      timezone: "America/Edmonton",
    });
    expect(rows.contacts).toEqual([
      expect.objectContaining({
        id: booked.contactId,
        name: "Jane",
        email: `jane-${tag}@example.com`,
      }),
    ]);
    expect(rows.leads).toEqual([
      expect.objectContaining({
        id: booked.leadId,
        stageId: clinic.newStage,
        source: "widget",
        details: "Sensitive skin",
      }),
    ]);
    expect(rows.bookings).toEqual([
      expect.objectContaining({
        id: booked.id,
        location: "12 Main Street",
        status: "confirmed",
        personId: clinic.ana,
      }),
    ]);
    // Held with the 15 after inside: 9:00 to 10:30.
    expect(rows.commitments).toEqual([
      expect.objectContaining({
        resourceId: clinic.ana,
        bookingId: booked.id,
        startsAt: NINE,
        endsAt: at("16:30"),
      }),
    ]);
    expect(rows.activities).toEqual([
      expect.objectContaining({
        type: "booking_created",
        contactId: booked.contactId,
        actorUserId: null,
        payload: {
          leadId: booked.leadId,
          bookingId: booked.id,
          bookingLinkId: clinic.facial,
          startsAt: NINE.toISOString(),
        },
      }),
    ]);
  });

  test("a time that stopped being free answers time_taken and writes nothing", async () => {
    const clinic = await makeClinic("stale");
    // Booked by someone else after this customer's list loaded.
    await holdTime(clinic.business, {
      resourceIds: [clinic.ana],
      startsAt: NINE,
      endsAt: at("16:15"),
      kind: "time_off",
    });

    expect(await customerBooking(clinic)).toEqual({ booked: false, reason: "time_taken" });
    const rows = await rowsOf(clinic.business);
    expect([rows.contacts, rows.leads, rows.bookings, rows.commitments, rows.activities]).toEqual([
      [],
      [],
      [],
      [],
      [],
    ]);
  });

  test("two bookings of the same person at the same instant: one booked, one time_taken", async () => {
    const clinic = await makeClinic("race");
    const results = await Promise.all([
      customerBooking(clinic, { customer: { name: "Jane", email: `jane-${tag}@example.com` } }),
      customerBooking(clinic, { customer: { name: "Mike", email: `mike-${tag}@example.com` } }),
    ]);

    expect(results.filter((result) => result.booked)).toHaveLength(1);
    expect(results.filter((result) => !result.booked)).toEqual([
      { booked: false, reason: "time_taken" },
    ]);
    const rows = await rowsOf(clinic.business);
    // The loser left nothing: one of everything.
    expect([
      rows.contacts.length,
      rows.leads.length,
      rows.bookings.length,
      rows.commitments.length,
    ]).toEqual([1, 1, 1, 1]);
  });

  test("holding tries each choice in order until one is free", async () => {
    const clinic = await makeClinic("next");
    // Between the check and the hold, someone took Mei: the transaction tries Ana instead. The
    // held rows point at a real booking, made for the next Monday.
    const earlier = bookedOrThrow(
      await customerBooking(clinic, { startsAt: new Date("2026-10-12T15:00:00Z") })
    );
    await holdTime(clinic.business, {
      resourceIds: [clinic.mei],
      startsAt: NINE,
      endsAt: at("16:30"),
      kind: "time_off",
    });
    const held = await db.transaction((tx) =>
      holdFirstFreeChoice(
        clinic.business,
        [
          { personId: clinic.mei, placeId: null },
          { personId: clinic.ana, placeId: null },
        ],
        { startsAt: NINE, endsAt: at("16:30") },
        earlier.id,
        tx
      )
    );
    expect(held).toEqual({ personId: clinic.ana, placeId: null });
  });

  test("the same form sent twice gets one booking", async () => {
    const clinic = await makeClinic("twice");
    const requestKey = `form-${randomUUID()}`;
    const first = bookedOrThrow(await customerBooking(clinic, { requestKey }));
    const second = await customerBooking(clinic, { requestKey });

    expect(second).toEqual({ booked: true, alreadyBooked: true, booking: first });
    expect((await rowsOf(clinic.business)).bookings).toHaveLength(1);
  });

  test("two copies of one form at the same instant give one booking, and both answer it", async () => {
    const clinic = await makeClinic("copies");
    const requestKey = `form-${randomUUID()}`;
    const results = await Promise.all([
      customerBooking(clinic, { personId: null, requestKey }),
      customerBooking(clinic, { personId: null, requestKey }),
    ]);

    const [a, b] = results.map(bookedOrThrow);
    expect(a.id).toBe(b.id);
    expect(results.map((result) => result.booked && result.alreadyBooked).sort()).toEqual([
      false,
      true,
    ]);
    const rows = await rowsOf(clinic.business);
    expect([rows.bookings.length, rows.commitments.length, rows.leads.length]).toEqual([1, 1, 1]);
  });

  test("two forms with different keys for the same email and time book twice", async () => {
    const clinic = await makeClinic("two-children");
    const first = bookedOrThrow(await customerBooking(clinic, { personId: null }));
    const second = bookedOrThrow(await customerBooking(clinic, { personId: null }));

    expect(first.id).not.toBe(second.id);
    expect(new Set([first.personId, second.personId])).toEqual(new Set([clinic.ana, clinic.mei]));
    expect(first.contactId).toBe(second.contactId); // the same parent
  });

  test("an unreadable picked calendar answers unavailable", async () => {
    const clinic = await makeClinic("unreadable");
    await db.insert(calendarConnection).values({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId: clinic.ana,
      provider: "google",
      accountEmail: "ana@example.com",
      credentials: "not read: the connection needs reconnecting first",
      grantedScopes: "",
      status: "needs_reconnect",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await customerBooking(clinic)).toEqual({ booked: false, reason: "unavailable" });
    // With "any available" Ana is left out and Mei is booked.
    expect(bookedOrThrow(await customerBooking(clinic, { personId: null })).personId).toBe(
      clinic.mei
    );
    warn.mockRestore();
  });

  test("a known email reuses its contact", async () => {
    const clinic = await makeClinic("known");
    const first = bookedOrThrow(await customerBooking(clinic));
    const second = bookedOrThrow(await customerBooking(clinic, { personId: clinic.mei }));

    expect(second.contactId).toBe(first.contactId);
    expect(second.leadId).not.toBe(first.leadId); // a new job is a new lead
    expect((await rowsOf(clinic.business)).contacts).toHaveLength(1);
  });

  test("any available goes to the fewest bookings that day", async () => {
    const clinic = await makeClinic("fewest");
    // Mei has a booking at 11:45 that Monday and Ana none, so Ana gets 9:00.
    await holdTime(clinic.business, {
      resourceIds: [clinic.mei],
      startsAt: at("17:45"),
      endsAt: at("18:00"),
      kind: "booking",
    });
    expect(bookedOrThrow(await customerBooking(clinic, { personId: null })).personId).toBe(
      clinic.ana
    );
    // Ana is now busy at 9:00, so the next "any available" at 9:00 goes to Mei.
    expect(bookedOrThrow(await customerBooking(clinic, { personId: null })).personId).toBe(
      clinic.mei
    );
  });

  test("a room taken only during the buffer after is not chosen", async () => {
    const clinic = await makeClinic("rooms");
    // A massage 9:00 to 10:00 needs a room; Room 3 is taken 10:00 to 10:30 only, which a 15 after
    // would touch. Give the massage 15 after for this test.
    await db
      .update(bookingLink)
      .set({ bufferAfterMinutes: 15 })
      .where(eq(bookingLink.id, clinic.massage));
    await holdTime(clinic.business, {
      resourceIds: [clinic.room3],
      startsAt: at("16:00"),
      endsAt: at("16:30"),
      kind: "time_off",
    });

    const booked = bookedOrThrow(
      await customerBooking(clinic, { bookingLinkId: clinic.massage, personId: null })
    );
    expect(booked.placeId).toBe(clinic.room4);
    const held = (await rowsOf(clinic.business)).commitments.map((row) => row.resourceId).sort();
    expect(held).toEqual([clinic.ana, clinic.room4].sort()); // the person and the room, together
  });

  test("a room on standby that date is not chosen for a customer, but the owner may use it", async () => {
    // Room 3 is on standby that Monday. Nothing in the database stops a booking there, so only the
    // room rule keeps a customer out of it.
    const customers = await makeClinic("room-standby");
    await db.insert(standbyDate).values({
      organizationId: customers.business,
      resourceId: customers.room3,
      date: "2026-10-05",
    });
    const forCustomer = bookedOrThrow(
      await customerBooking(customers, { bookingLinkId: customers.massage, personId: null })
    );
    expect(forCustomer.placeId).toBe(customers.room4);

    const owners = await makeClinic("room-standby-owner");
    const owner = await makeOwner(owners, "standby");
    await db
      .insert(standbyDate)
      .values({ organizationId: owners.business, resourceId: owners.room3, date: "2026-10-05" });
    const forOwner = bookedOrThrow(
      await ownerBooking(owners, owner, { bookingLinkId: owners.massage, personId: null })
    );
    expect(forOwner.placeId).toBe(owners.room3); // first by name, standby only limits customers
  });

  test("a buffer before is held too", async () => {
    const clinic = await makeClinic("buffer-before");
    await db
      .update(bookingLink)
      .set({ bufferBeforeMinutes: 15 })
      .where(eq(bookingLink.id, clinic.facial));
    const booked = bookedOrThrow(await customerBooking(clinic));

    expect(booked.startsAt).toEqual(NINE); // the appointment itself
    expect((await rowsOf(clinic.business)).commitments).toEqual([
      expect.objectContaining({ startsAt: at("14:45"), endsAt: at("16:30") }), // 8:45 to 10:30
    ]);
  });

  test("any available with every calendar unreadable answers unavailable, not taken", async () => {
    const clinic = await makeClinic("all-unreadable");
    await db.insert(calendarConnection).values(
      [clinic.ana, clinic.mei].map((resourceId) => ({
        id: randomUUID(),
        organizationId: clinic.business,
        resourceId,
        provider: "google",
        accountEmail: `${resourceId}@example.com`,
        credentials: "not read: the connection needs reconnecting first",
        grantedScopes: "",
        status: "needs_reconnect",
      }))
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await customerBooking(clinic, { personId: null })).toEqual({
      booked: false,
      reason: "unavailable",
    });
    warn.mockRestore();
  });

  test("a form already used for another booking is refused", async () => {
    const clinic = await makeClinic("key-reused");
    const requestKey = `form-${randomUUID()}`;
    bookedOrThrow(await customerBooking(clinic, { requestKey }));

    const refused = { booked: false, reason: "request_key_used" };
    expect(await customerBooking(clinic, { requestKey, startsAt: at("16:15") })).toEqual(refused);
    expect(await customerBooking(clinic, { requestKey, personId: clinic.mei })).toEqual(refused);
    expect(await customerBooking(clinic, { requestKey, bookingLinkId: clinic.massage })).toEqual(
      refused
    );
    expect((await rowsOf(clinic.business)).bookings).toHaveLength(1);
  });

  test("another business's service or person answers not_found", async () => {
    const mine = await makeClinic("mine");
    const theirs = await makeClinic("theirs");
    expect(await customerBooking(mine, { bookingLinkId: theirs.facial })).toEqual({
      booked: false,
      reason: "not_found",
    });
    expect(await customerBooking(mine, { personId: theirs.ana })).toEqual({
      booked: false,
      reason: "not_found",
    });
    await db.update(bookingLink).set({ active: false }).where(eq(bookingLink.id, mine.facial));
    expect(await customerBooking(mine)).toEqual({ booked: false, reason: "not_found" });
  });

  test("an owner-made booking by someone outside the business is refused", async () => {
    const mine = await makeClinic("owner-mine");
    const theirs = await makeClinic("owner-theirs");
    const theirOwner = await makeOwner(theirs, "theirs");

    await expect(ownerBooking(mine, theirOwner)).rejects.toThrow(
      "that login does not belong to this business"
    );
    await expect(customerBooking(mine, { source: "manual", actorUserId: null })).rejects.toThrow(
      "that login does not belong to this business"
    );
    expect((await rowsOf(mine.business)).bookings).toHaveLength(0);
  });

  test("a customer's pick for a service the business assigns answers person_not_taken and writes nothing; the owner may pick", async () => {
    const clinic = await makeClinic("assigns");
    const owner = await makeOwner(clinic, "assigns");
    await db
      .update(bookingLink)
      .set({ personChoice: "business_assigns" })
      .where(eq(bookingLink.id, clinic.facial));

    expect(await customerBooking(clinic)).toEqual({ booked: false, reason: "person_not_taken" });
    expect((await rowsOf(clinic.business)).bookings).toEqual([]);
    // With nobody picked the customer books, and the owner may still pick (feature 9, decision 3).
    bookedOrThrow(await customerBooking(clinic, { personId: null }));
    const picked = bookedOrThrow(
      await ownerBooking(clinic, owner, { startsAt: new Date(NINE.getTime() + 2 * 3_600_000) })
    );
    expect(picked.personId).toBe(clinic.ana);
  });

  test("a booked form sent again after its service changed still gets its booking", async () => {
    const clinic = await makeClinic("changed");
    const requestKey = randomUUID();
    const first = bookedOrThrow(await customerBooking(clinic, { requestKey }));

    // The business now assigns: the retry is its own earlier booking, not a refused pick.
    await db
      .update(bookingLink)
      .set({ personChoice: "business_assigns" })
      .where(eq(bookingLink.id, clinic.facial));
    const afterSwitch = bookedOrThrow(await customerBooking(clinic, { requestKey }));
    // Switched off too: a new booking is not taken, but this form's own still answers.
    await db.update(bookingLink).set({ active: false }).where(eq(bookingLink.id, clinic.facial));
    const afterOff = bookedOrThrow(await customerBooking(clinic, { requestKey }));

    expect(afterSwitch.id).toBe(first.id);
    expect(afterOff.id).toBe(first.id);
    expect((await rowsOf(clinic.business)).bookings).toHaveLength(1);
  });

  // A customer answers the business's required questions; the owner, booking from a call, need not.
  test("a customer must answer a required question; the owner need not", async () => {
    const clinic = await makeClinic("questions");
    const owner = await makeOwner(clinic, "questions");
    await db.insert(bookingQuestion).values({
      id: randomUUID(),
      organizationId: clinic.business,
      position: 1,
      label: "Any allergies?",
      required: true,
    });

    expect(await customerBooking(clinic)).toEqual({
      booked: false,
      reason: "answer_needed",
      question: "Any allergies?",
    });
    const made = bookedOrThrow(await ownerBooking(clinic, owner));
    const [saved] = await db
      .select({ answers: lead.answers })
      .from(lead)
      .where(eq(lead.id, made.leadId));
    expect(saved?.answers).toEqual([]); // asked, nothing answered
  });

  test("an owner-made booking outside bookable hours, on a standby date or within the notice is booked", async () => {
    const clinic = await makeClinic("owner-anytime");
    const owner = await makeOwner(clinic, "anytime");
    await db
      .insert(standbyDate)
      .values({ organizationId: clinic.business, resourceId: clinic.ana, date: "2026-10-03" });

    // Saturday 8:00 (not bookable, and Ana is on standby that day), as the owner.
    const saturday = bookedOrThrow(
      await ownerBooking(clinic, owner, { startsAt: new Date("2026-10-03T14:00:00Z") })
    );
    // Friday 9:00, an hour from now (inside the two hours' notice), a walk-in with no email.
    const walkIn = bookedOrThrow(
      await ownerBooking(clinic, owner, {
        startsAt: new Date("2026-10-02T15:00:00Z"),
        customer: { name: "Walk-in" },
      })
    );

    expect(saturday.personId).toBe(clinic.ana);
    expect(walkIn.personId).toBe(clinic.ana);
    const rows = await rowsOf(clinic.business);
    expect(rows.leads.map((row) => row.source)).toEqual(["manual", "manual"]);
    expect(rows.activities.every((row) => row.actorUserId === owner)).toBe(true);
    // The same times are not offered to a customer.
    expect(await customerBooking(clinic, { startsAt: new Date("2026-10-03T16:00:00Z") })).toEqual({
      booked: false,
      reason: "time_taken",
    });
  });

  test("an owner-made booking may start earlier today, never on an earlier day", async () => {
    const clinic = await makeClinic("owner-today");
    const owner = await makeOwner(clinic, "today");
    const tenPastTen = new Date("2026-10-02T16:10:00Z"); // Friday 10:10 in Edmonton
    const asOwner = (startsAt: Date, name: string) =>
      ownerBooking(clinic, owner, { startsAt, now: tenPastTen, customer: { name } });

    // A walk-in that began at 10:00 is entered at 10:10.
    expect(
      bookedOrThrow(await asOwner(new Date("2026-10-02T16:00:00Z"), "Walk-in")).startsAt
    ).toEqual(new Date("2026-10-02T16:00:00Z"));
    // Thursday, and a mistyped year, are refused.
    const refused = { booked: false, reason: "in_the_past" };
    expect(await asOwner(new Date("2026-10-01T16:00:00Z"), "Yesterday")).toEqual(refused);
    expect(await asOwner(new Date("2020-10-02T16:00:00Z"), "Typo")).toEqual(refused);
    // Just after midnight Friday in Edmonton (Friday 06:30 in UTC) still counts as today.
    expect(bookedOrThrow(await asOwner(new Date("2026-10-02T06:30:00Z"), "Early")).personId).toBe(
      clinic.ana
    );
    expect((await rowsOf(clinic.business)).bookings).toHaveLength(2);
  });

  test("an owner-made booking over the person's Google busy time, a booking or time off answers time_taken", async () => {
    const clinic = await makeClinic("owner-busy");
    const owner = await makeOwner(clinic, "busy");
    await saveCalendarConnection({
      organizationId: clinic.business,
      resourceId: clinic.mei,
      accountEmail: `mei-${tag}@gmail.com`,
      grantedScopes: ["openid", "email"],
      credentials: {
        refreshToken: "1//saved-refresh",
        accessToken: "ya29.saved-access",
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });
    // Google, faked: Mei has dinner Saturday 18:00 to 19:00 (Sunday 00:00 to 01:00 in UTC).
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url !== "https://www.googleapis.com/calendar/v3/freeBusy")
        throw new Error(`A test tried to reach ${url}.`);
      const busy = [{ start: "2026-10-04T00:00:00Z", end: "2026-10-04T01:00:00Z" }];
      return new Response(JSON.stringify({ calendars: { primary: { busy } } }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    await holdTime(clinic.business, {
      resourceIds: [clinic.ana],
      startsAt: at("20:00"),
      endsAt: at("21:00"),
      kind: "time_off",
    });

    const saturdayDinner = new Date("2026-10-04T00:30:00Z");
    expect(
      await ownerBooking(clinic, owner, { personId: clinic.mei, startsAt: saturdayDinner })
    ).toEqual({
      booked: false,
      reason: "time_taken",
    });
    expect(await ownerBooking(clinic, owner, { startsAt: at("20:30") })).toEqual({
      booked: false,
      reason: "time_taken",
    });
    // Free in Google and in the app: booked, even outside bookable hours (Saturday 20:00).
    expect(
      bookedOrThrow(
        await ownerBooking(clinic, owner, {
          personId: clinic.mei,
          startsAt: new Date("2026-10-04T02:00:00Z"),
        })
      ).personId
    ).toBe(clinic.mei);
    expect((await rowsOf(clinic.business)).bookings).toHaveLength(1);
  });
});
