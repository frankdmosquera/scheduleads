// Runs against the local scheduleads_dev on throwaway businesses, removed after; refuses any
// other database through the same guard as the seed.

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import * as schema from "../db/index.js";
import {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  bookingQuestion,
  organization,
  resource,
  user,
  workerTextSettings,
} from "../db/index.js";
import { assertLocalDevDatabase } from "../helpers/assert-local-dev-database.js";
import {
  clientSetupValidationSchema,
  type ClientSetupInputType,
} from "../zod-validation/admin-validation-schemas/client-setup-validation-schema.js";
import { runClientSetup } from "./run-client-setup.js";

if (!process.env.DATABASE_URL) process.loadEnvFile("../../.env");
assertLocalDevDatabase(process.env.DATABASE_URL, "client setup tests");
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

const madeBusinessIds: string[] = [];
const madeUserIds: string[] = [];
afterAll(async () => {
  for (const id of madeBusinessIds) await db.delete(organization).where(eq(organization.id, id));
  for (const id of madeUserIds) await db.delete(user).where(eq(user.id, id));
  await client.end();
});

// A business as the client setup screen leaves it: the business and its first person, tied to the
// owner's login.
async function makeBusiness(): Promise<{ id: string; slug: string }> {
  const id = randomUUID();
  const slug = `setup-test-${id.slice(0, 8)}-dev`;
  await db.insert(organization).values({ id, name: `Setup Test ${slug}`, slug });
  const userId = randomUUID();
  await db
    .insert(user)
    .values({ id: userId, name: "", email: `${slug}@example.com`, emailVerified: true });
  madeUserIds.push(userId);
  await db.insert(resource).values({
    id: randomUUID(),
    organizationId: id,
    name: `Setup Test ${slug}`,
    kind: "person",
    userId,
  });
  madeBusinessIds.push(id);
  return { id, slug };
}

const fileFor = (slug: string): ClientSetupInputType => ({
  slug,
  personChoice: "business_assigns",
  questions: [{ label: "What is your business?", required: true }],
  hours: {
    weeklyHours: { mon: [{ startMinute: 480, endMinute: 1080 }] },
    timezone: "America/Bogota",
    minimumNoticeMinutes: 0,
    horizonDays: 21,
    closedDates: [],
  },
  people: [
    { name: "Room A", kind: "place" },
    {
      name: "Ana",
      kind: "person",
      weeklyHours: { mon: [{ startMinute: 540, endMinute: 720 }] },
      workerTexts: { phone: "403 555 0161", addedOn: true, movedOn: true, removedOn: true },
    },
  ],
  services: [
    {
      name: "Video call",
      durationMinutes: 30,
      slotIntervalMinutes: 30,
      asksAddress: false,
      ticked: ["Room A"],
    },
    { name: "Phone call", durationMinutes: 30, asksAddress: false },
  ],
});
const setupFor = (slug: string) => clientSetupValidationSchema.parse(fileFor(slug));

async function countRows(organizationId: string) {
  return {
    questions: await db.$count(bookingQuestion, eq(bookingQuestion.organizationId, organizationId)),
    hours: await db.$count(availabilityRule, eq(availabilityRule.organizationId, organizationId)),
    resources: await db.$count(resource, eq(resource.organizationId, organizationId)),
    services: await db.$count(bookingLink, eq(bookingLink.organizationId, organizationId)),
    ticks: await db.$count(
      bookingLinkResource,
      eq(bookingLinkResource.organizationId, organizationId)
    ),
    workerTexts: await db.$count(
      workerTextSettings,
      eq(workerTextSettings.organizationId, organizationId)
    ),
  };
}

describe("a setup file", () => {
  it("is refused when it is not a valid setup", () => {
    const file = fileFor("any-dev");
    expect(clientSetupValidationSchema.safeParse({ ...file, services: [] }).success).toBe(false);
    expect(clientSetupValidationSchema.safeParse({ ...file, plan: "agency" }).success).toBe(false);
    expect(
      clientSetupValidationSchema.safeParse({
        ...file,
        people: [
          {
            name: "Room A",
            kind: "place",
            workerTexts: { phone: "403 555 0161", addedOn: true, movedOn: true, removedOn: true },
          },
        ],
      }).success
    ).toBe(false);
    expect(
      clientSetupValidationSchema.safeParse({
        ...file,
        hours: { ...file.hours, timezone: "Mars/Olympus" },
      }).success
    ).toBe(false);
  });
});

describe("runClientSetup", () => {
  it("refuses a business that does not exist, and makes none", async () => {
    const slug = `setup-test-missing-${randomUUID().slice(0, 8)}-dev`;
    const result = await runClientSetup(db, setupFor(slug), { apply: true });
    expect(result.ok).toBe(false);
    const [made] = await db.select().from(organization).where(eq(organization.slug, slug));
    expect(made).toBeUndefined();
  });

  it("writes nothing on a dry run, yet reports what it would add", async () => {
    const business = await makeBusiness();
    const result = await runClientSetup(db, setupFor(business.slug), { apply: false });
    expect(result).toMatchObject({ ok: true, applied: false });
    expect(result.ok && result.made).toContain("2 services");
    expect(await countRows(business.id)).toEqual({
      questions: 0,
      hours: 0,
      resources: 1,
      services: 0,
      ticks: 0,
      workerTexts: 0,
    });
  });

  it("makes every row on apply, then a second apply changes nothing", async () => {
    const business = await makeBusiness();
    const first = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(first).toMatchObject({ ok: true, applied: true, differences: [] });
    expect(await countRows(business.id)).toEqual({
      questions: 1,
      hours: 2,
      resources: 3,
      services: 2,
      ticks: 1,
      workerTexts: 1,
    });

    const second = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(second).toMatchObject({ ok: true, made: [], differences: [] });
    expect(await countRows(business.id)).toEqual({
      questions: 1,
      hours: 2,
      resources: 3,
      services: 2,
      ticks: 1,
      workerTexts: 1,
    });
  });

  it("keeps a row changed by hand and reports the difference", async () => {
    const business = await makeBusiness();
    await runClientSetup(db, setupFor(business.slug), { apply: true });
    const byHand = and(
      eq(bookingLink.organizationId, business.id),
      eq(bookingLink.slug, "video-call")
    );
    await db.update(bookingLink).set({ durationMinutes: 45, asksAddress: true }).where(byHand);
    await db
      .update(availabilityRule)
      .set({ horizonDays: 30 })
      .where(
        and(eq(availabilityRule.organizationId, business.id), isNull(availabilityRule.resourceId))
      );
    // A person's own hours, their texts and a tick, each changed by hand (F-304).
    const [ana] = await db
      .select({ id: resource.id })
      .from(resource)
      .where(and(eq(resource.organizationId, business.id), eq(resource.name, "Ana")));
    await db
      .update(availabilityRule)
      .set({ weeklyHours: { tue: [{ startMinute: 540, endMinute: 720 }] } })
      .where(eq(availabilityRule.resourceId, ana!.id));
    await db
      .update(workerTextSettings)
      .set({ movedOn: false })
      .where(eq(workerTextSettings.personId, ana!.id));
    const [phoneCall] = await db
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(and(eq(bookingLink.organizationId, business.id), eq(bookingLink.slug, "phone-call")));
    await db
      .insert(bookingLinkResource)
      .values({ organizationId: business.id, bookingLinkId: phoneCall!.id, resourceId: ana!.id });
    // Room A unticked from Video call on Settings: it stays off (F-354).
    const [videoCall] = await db.select({ id: bookingLink.id }).from(bookingLink).where(byHand);
    await db
      .delete(bookingLinkResource)
      .where(eq(bookingLinkResource.bookingLinkId, videoCall!.id));

    const result = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(result.ok && result.made).toEqual([]);
    expect(result.ok && result.differences).toEqual([
      "hours, horizonDays: saved 30, file 21",
      '"Video call", durationMinutes: saved 45, file 30',
      '"Video call", asksAddress: saved true, file false',
      expect.stringMatching(/^"Ana", weeklyHours: saved {"tue"/),
      expect.stringMatching(/^"Ana", worker texts: saved {"addedOn":true,"movedOn":false/),
      '"Video call", in the file, not ticked here: Room A',
      '"Phone call", ticked by hand: Ana',
    ]);
    const [kept] = await db.select().from(bookingLink).where(byHand);
    expect(kept?.durationMinutes).toBe(45);
    expect(
      await db.$count(bookingLinkResource, eq(bookingLinkResource.bookingLinkId, videoCall!.id))
    ).toBe(0);

    // A tick naming nobody listed still stops the run, though the service already exists (F-355).
    const misspelt = fileFor(business.slug);
    misspelt.services[0].ticked = ["Room B"];
    await expect(
      runClientSetup(db, clientSetupValidationSchema.parse(misspelt), { apply: true })
    ).rejects.toThrow('"Video call" ticks "Room B", who is not listed.');
  });

  it("finds a service renamed on Settings by its new name, never adding it twice", async () => {
    const business = await makeBusiness();
    await runClientSetup(db, setupFor(business.slug), { apply: true });
    // Settings renames a service and keeps its slug (12d.1).
    await db
      .update(bookingLink)
      .set({ name: "Video consult" })
      .where(and(eq(bookingLink.organizationId, business.id), eq(bookingLink.slug, "video-call")));

    const file = fileFor(business.slug);
    file.services[0].name = " video CONSULT "; // the same name, any case and spaces
    const renamed = await runClientSetup(db, clientSetupValidationSchema.parse(file), {
      apply: true,
    });
    expect(renamed.ok && renamed.made).toEqual([]);
    expect((await countRows(business.id)).services).toBe(2);

    // The old name is a service of its own now; its slug is taken, so it gets -2.
    const old = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(old.ok && old.made).toContain("1 services");
    const slugs = await db
      .select({ slug: bookingLink.slug })
      .from(bookingLink)
      .where(eq(bookingLink.organizationId, business.id));
    expect(slugs.map((row) => row.slug).sort()).toEqual([
      "phone-call",
      "video-call",
      "video-call-2",
    ]);
  });

  it("finds people renamed on Settings, the first one by its login, never adding them twice", async () => {
    const business = await makeBusiness();
    await runClientSetup(db, setupFor(business.slug), { apply: true });
    // Settings renames the first person and changes the case of another (12d.2).
    await db
      .update(resource)
      .set({ name: "Owner" })
      .where(
        and(
          eq(resource.organizationId, business.id),
          eq(resource.name, `Setup Test ${business.slug}`)
        )
      );
    await db
      .update(resource)
      .set({ name: "ANA" })
      .where(and(eq(resource.organizationId, business.id), eq(resource.name, "Ana")));

    const again = await runClientSetup(db, setupFor(business.slug), { apply: true });
    expect(again).toMatchObject({ ok: true, made: [] });
    expect((await countRows(business.id)).resources).toBe(3);
  });
});
