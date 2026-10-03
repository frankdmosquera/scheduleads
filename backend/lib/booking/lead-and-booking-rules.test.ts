// The lead and booking tables' rules, proved by inserting rows directly into the local database.
// Every business here is a throwaway carrying this run's tag, removed after (its rows go with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the lead and booking tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { booking, bookingLink, commitment, contact, lead, organization, pipelineStage, resource } =
  await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const at = (time: string) => new Date(`2026-10-05T${time}:00Z`);

// A business of its own: a contact, a stage, a facial, Ana and Room 3.
async function makeBusiness(name: string) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({ id: business, name, slug: `test-lead-${name}-${tag}` });
  const [jane, stage, facial, ana, room] = [id(), id(), id(), id(), id()];
  await db.insert(contact).values({ id: jane, organizationId: business, name: "Jane" });
  await db
    .insert(pipelineStage)
    .values({ id: stage, organizationId: business, name: "New", position: 0 });
  await db.insert(bookingLink).values({
    id: facial,
    organizationId: business,
    name: "Facial",
    slug: "facial",
    durationMinutes: 75,
  });
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: room, organizationId: business, name: "Room 3", kind: "place" },
  ]);
  return { business, jane, stage, facial, ana, room };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

const leadRow = (b: BusinessType, changes: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  organizationId: b.business,
  contactId: b.jane,
  stageId: b.stage,
  source: "widget",
  ...changes,
});

async function makeLead(b: BusinessType) {
  const row = leadRow(b);
  await db.insert(lead).values(row);
  return row.id;
}

const bookingRow = (b: BusinessType, leadId: string, changes: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  organizationId: b.business,
  leadId,
  bookingLinkId: b.facial,
  personId: b.ana,
  placeId: b.room,
  startsAt: at("15:00"),
  endsAt: at("16:15"),
  location: "12 Main Street",
  ...changes,
});

const refusedBy = (code: string, constraint: string) => ({
  cause: { code, constraint_name: constraint },
});
const FOREIGN_KEY = "23503";
const CHECK = "23514";

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-lead-%-${tag}`));
  await db.$client.end();
});

describe("lead and booking rules in the database", () => {
  test("a lead and its booking are saved, the booking confirmed by default", async () => {
    const b = await makeBusiness("saved");
    const leadId = await makeLead(b);
    const row = bookingRow(b, leadId);
    await db.insert(booking).values(row);

    const [saved] = await db.select().from(booking).where(eq(booking.id, row.id));
    expect(saved.status).toBe("confirmed");
    expect(saved.calendarEventId).toBeNull();
  });

  test("a lead in another business's stage, or for another business's contact, is refused", async () => {
    const mine = await makeBusiness("mine-stage");
    const theirs = await makeBusiness("theirs-stage");

    await expect(
      db.insert(lead).values(leadRow(mine, { stageId: theirs.stage }))
    ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, "lead_stage_fk"));
    await expect(
      db.insert(lead).values(leadRow(mine, { contactId: theirs.jane }))
    ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, "lead_contact_fk"));
  });

  test("an unknown lead source is refused", async () => {
    const b = await makeBusiness("source");
    await expect(db.insert(lead).values(leadRow(b, { source: "facebook" }))).rejects.toMatchObject(
      refusedBy(CHECK, "lead_source_check")
    );
  });

  test("a booking with an empty address, an end before its start or an unknown status is refused", async () => {
    const b = await makeBusiness("booking-checks");
    const leadId = await makeLead(b);

    await expect(
      db.insert(booking).values(bookingRow(b, leadId, { location: "   " }))
    ).rejects.toMatchObject(refusedBy(CHECK, "booking_location_check"));
    await expect(
      db.insert(booking).values(bookingRow(b, leadId, { endsAt: at("15:00") }))
    ).rejects.toMatchObject(refusedBy(CHECK, "booking_time_order_check"));
    await expect(
      db.insert(booking).values(bookingRow(b, leadId, { status: "pending" }))
    ).rejects.toMatchObject(refusedBy(CHECK, "booking_status_check"));
  });

  test("a booking with another business's lead, service, person or place is refused", async () => {
    const mine = await makeBusiness("mine-booking");
    const theirs = await makeBusiness("theirs-booking");
    const myLead = await makeLead(mine);
    const theirLead = await makeLead(theirs);

    const cases: [Record<string, unknown>, string][] = [
      [{ leadId: theirLead }, "booking_lead_fk"],
      [{ bookingLinkId: theirs.facial }, "booking_booking_link_fk"],
      [{ personId: theirs.ana }, "booking_person_fk"],
      [{ placeId: theirs.room }, "booking_place_fk"],
    ];
    for (const [changes, constraint] of cases) {
      await expect(
        db.insert(booking).values(bookingRow(mine, myLead, changes))
      ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, constraint));
    }
    // No room is allowed: a service that needs none.
    await db.insert(booking).values(bookingRow(mine, myLead, { placeId: null }));
  });

  test("a commitment pointing at another business's booking is refused", async () => {
    const mine = await makeBusiness("mine-commitment");
    const theirs = await makeBusiness("theirs-commitment");
    const theirBooking = bookingRow(theirs, await makeLead(theirs));
    await db.insert(booking).values(theirBooking);
    const myBooking = bookingRow(mine, await makeLead(mine));
    await db.insert(booking).values(myBooking);

    const held = {
      organizationId: mine.business,
      resourceId: mine.ana,
      kind: "booking",
      startsAt: at("15:00"),
      endsAt: at("16:30"),
    };
    await expect(
      db.insert(commitment).values({ ...held, id: randomUUID(), bookingId: theirBooking.id })
    ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, "commitment_booking_fk"));
    await db.insert(commitment).values({ ...held, id: randomUUID(), bookingId: myBooking.id });
  });

  test("one booking per form: a second booking with the same key is refused", async () => {
    const mine = await makeBusiness("key-mine");
    const theirs = await makeBusiness("key-theirs");
    const leadId = await makeLead(mine);
    const key = `form-${tag}`;
    await db.insert(booking).values(bookingRow(mine, leadId, { requestKey: key }));

    await expect(
      db.insert(booking).values(bookingRow(mine, leadId, { requestKey: key }))
    ).rejects.toMatchObject(refusedBy("23505", "booking_request_key_unique"));
    // The same key in another business, and two bookings with no key (the owner's), are fine.
    await db
      .insert(booking)
      .values(bookingRow(theirs, await makeLead(theirs), { requestKey: key }));
    await db.insert(booking).values(bookingRow(mine, leadId));
    await db.insert(booking).values(bookingRow(mine, leadId));
  });

  test("a stage still holding leads cannot be deleted", async () => {
    const b = await makeBusiness("stage-delete");
    await makeLead(b);
    await expect(
      db.delete(pipelineStage).where(eq(pipelineStage.id, b.stage))
    ).rejects.toMatchObject(refusedBy(FOREIGN_KEY, "lead_stage_fk"));
  });

  test("a contact's leads go with it, unless one of them has a booking", async () => {
    const withBooking = await makeBusiness("contact-booked");
    await db.insert(booking).values(bookingRow(withBooking, await makeLead(withBooking)));
    await expect(db.delete(contact).where(eq(contact.id, withBooking.jane))).rejects.toMatchObject(
      refusedBy(FOREIGN_KEY, "booking_lead_fk")
    );

    const noBooking = await makeBusiness("contact-free");
    const leadId = await makeLead(noBooking);
    await db.delete(contact).where(eq(contact.id, noBooking.jane));
    expect(await db.select().from(lead).where(eq(lead.id, leadId))).toHaveLength(0);
  });

  test("deleting the whole business takes its leads, bookings and commitments", async () => {
    const b = await makeBusiness("business-delete");
    const row = bookingRow(b, await makeLead(b));
    await db.insert(booking).values(row);
    await db.insert(commitment).values({
      id: randomUUID(),
      organizationId: b.business,
      resourceId: b.ana,
      kind: "booking",
      bookingId: row.id,
      startsAt: at("15:00"),
      endsAt: at("16:30"),
    });

    await db.delete(organization).where(eq(organization.id, b.business));
    expect(await db.select().from(booking).where(eq(booking.id, row.id))).toHaveLength(0);
  });
});
