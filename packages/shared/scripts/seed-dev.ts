// Shared script: fills an empty local database with two dev accounts and two made-up
// businesses shaped like the real clients, a painting company like Primo and a clinic like
// Face and Body. Signup is closed, so without this a fresh database has no way in. Safe to
// run repeatedly: everything is looked up first and only made when missing.
// Run: npm run db:seed --workspace=@scheduleads-app/shared

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";
import {
  availabilityRule,
  bookingLink,
  member,
  organization,
  resource,
  user,
} from "@scheduleads-app/shared/db";
import {
  businessAvailabilityRuleValidationSchema,
  personAvailabilityRuleValidationSchema,
  type DateHoursType,
  type WeeklyHoursType,
} from "@scheduleads-app/shared/zod-validation";
import { toSlug } from "@scheduleads-app/shared/helpers";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Two conditions, not one: the Railway tunnel ALSO listens on 127.0.0.1, so a host check
// alone would seed the real database. The name must end in _dev too (Railway's is "railway").
function assertLocalDevelopmentDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL is not set. It is read from the root .env.");
  }

  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, "");

  if (!LOOPBACK.has(parsed.hostname) || !database.endsWith("_dev")) {
    throw new Error(
      `Refusing to seed ${parsed.hostname}:${parsed.port || "5432"}/${database}. ` +
        "The seed only runs against a database on this machine whose name ends in _dev. " +
        "Check which DATABASE_URL line is active in .env."
    );
  }

  return database;
}

// Minutes from midnight, so 9:30 reads as at(9, 30) instead of 570.
const at = (hour: number, minute = 0) => hour * 60 + minute;
const between = (from: number, to: number) => ({ startMinute: from, endMinute: to });

// Dates relative to the day the seed runs, so they never go stale: rebuilding the practice
// database makes them fresh again. Counted in UTC; a day either way does not matter here.
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
function sundayAfterDays(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7)); // forward to a Sunday
  return date.toISOString().slice(0, 10);
}

export type ResourceSeedType = {
  name: string;
  kind: "person" | "place";
  weeklyHours?: WeeklyHoursType | null; // missing = no row, follows the business's week
  dateHours?: DateHoursType;
};

export type ServiceSeedType = {
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
};

// Primo's shape: estimates early morning and evenings on weekdays, daytime at weekends.
const paintingWeekday = [between(at(7, 30), at(8, 30)), between(at(17), at(19, 30))];

// Fake addresses on purpose: login codes print in the API console, so no mailbox is needed.
// owner@example.com is the non-admin that proves an owner cannot create a business.
// The made-up businesses this seed used to make, before 2026-09-25. A practice database on
// another computer may still hold them; they are removed so the old and new never mix.
const RETIRED_DEV_SLUGS = ["agency-dev", "test-salon-dev"];

const ACCOUNTS = [
  {
    email: "admin@example.com",
    name: "Dev Admin",
    role: "admin",
    business: {
      name: "Summit Painting (dev)",
      slug: "painting-dev",
      hours: {
        weeklyHours: {
          mon: paintingWeekday,
          tue: paintingWeekday,
          wed: paintingWeekday,
          thu: paintingWeekday,
          fri: paintingWeekday,
          sat: [between(at(9), at(17))],
          sun: [between(at(9, 30), at(17))],
        },
        timezone: "America/Edmonton",
        minimumNoticeMinutes: 240,
        horizonDays: 60,
        closedDates: [daysFromToday(21)], // inside the 60-day window
      },
      // The business's first person (the owner, the estimator) is made separately, below.
      people: [
        {
          name: "Marco (estimator)",
          kind: "person",
          weeklyHours: { mon: [between(at(9), at(17))], wed: [between(at(9), at(17))] },
        },
        { name: "Carlos (painter)", kind: "person" },
        { name: "Diego (painter)", kind: "person" },
        { name: "Jorge (painter)", kind: "person" },
        { name: "Mateo (painter)", kind: "person" },
        { name: "Pedro (painter)", kind: "person" },
        { name: "Tomas (painter)", kind: "person" },
      ] satisfies ResourceSeedType[],
      services: [
        { name: "Interior estimate", durationMinutes: 60, bufferAfterMinutes: 15 },
        {
          name: "Exterior estimate",
          durationMinutes: 45,
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
        },
        { name: "Colour consultation", durationMinutes: 30, bufferAfterMinutes: 10 },
      ] satisfies ServiceSeedType[],
    },
  },
  {
    email: "owner@example.com",
    name: "Dev Owner",
    role: null,
    business: {
      name: "Riverbend Clinic (dev)",
      slug: "clinic-dev",
      hours: {
        weeklyHours: {
          mon: [between(at(9), at(19))],
          tue: [between(at(9), at(19))],
          wed: [between(at(9), at(19))],
          thu: [between(at(9), at(19))],
          fri: [between(at(9), at(19))],
          sat: [between(at(10), at(16))],
        },
        timezone: "America/Edmonton",
        minimumNoticeMinutes: 1440,
        horizonDays: 120,
        closedDates: [daysFromToday(21)],
      },
      // Six practitioners with every kind of hours, then the five rooms. The room layout is
      // the contract feature 5 wires skills and rooms-per-treatment from (current-feature.md).
      people: [
        {
          name: "Sofia",
          kind: "person",
          weeklyHours: {
            mon: [between(at(9), at(17))],
            wed: [between(at(9), at(17))],
            fri: [between(at(9), at(17))],
          },
        },
        {
          name: "Luis",
          kind: "person",
          weeklyHours: { tue: [between(at(12), at(19))], thu: [between(at(12), at(19))] },
        },
        { name: "Ana", kind: "person" },
        { name: "Mei", kind: "person" },
        {
          name: "Priya",
          kind: "person",
          weeklyHours: { sat: [between(at(10), at(16))], sun: [between(at(10), at(16))] },
        },
        {
          name: "Daniel",
          kind: "person",
          weeklyHours: null, // has a row only for one extra Sunday; otherwise the clinic's week
          dateHours: [{ date: sundayAfterDays(14), windows: [between(at(10), at(14))] }],
        },
        { name: "Room 1 (massage)", kind: "place" },
        { name: "Room 2 (massage)", kind: "place" },
        { name: "Room 3 (massage, facials)", kind: "place" },
        { name: "Room 4 (massage, body)", kind: "place" },
        { name: "Room 5 (laser)", kind: "place" },
      ] satisfies ResourceSeedType[],
      // Face and Body's own treatments and lengths (face-and-body/data/servicesData.ts).
      // Massages and the wrap leave 15 minutes after, to turn the room over.
      services: [
        { name: "Deep Cleansing Facial", durationMinutes: 75 },
        { name: "Dermaplaning Facial", durationMinutes: 60 },
        { name: "Hydra Spa Facial", durationMinutes: 70 },
        { name: "Chemical Peel", durationMinutes: 30 },
        { name: "Relaxation Massage", durationMinutes: 60, bufferAfterMinutes: 15 },
        { name: "Relaxation Massage, 90 min", durationMinutes: 90, bufferAfterMinutes: 15 },
        { name: "Deep Tissue Massage", durationMinutes: 75, bufferAfterMinutes: 15 },
        { name: "Lymphatic Drainage Massage", durationMinutes: 60, bufferAfterMinutes: 15 },
        { name: "Laser Hair Removal", durationMinutes: 10 },
        { name: "Body Wrap", durationMinutes: 60, bufferAfterMinutes: 15 },
      ] satisfies ServiceSeedType[],
    },
  },
] as const;

export type TransactionType = Parameters<
  Parameters<ReturnType<typeof drizzle>["transaction"]>[0]
>[0];

// Finds a resource by its name in this business, or makes it. Returns its id and whether it was made.
async function ensureResource(
  tx: TransactionType,
  organizationId: string,
  name: string,
  kind: "person" | "place"
): Promise<{ id: string; made: boolean }> {
  const [existing] = await tx
    .select({ id: resource.id })
    .from(resource)
    .where(and(eq(resource.organizationId, organizationId), eq(resource.name, name)))
    .limit(1);
  if (existing) return { id: existing.id, made: false };

  const id = randomUUID();
  await tx.insert(resource).values({ id, organizationId, name, kind });
  return { id, made: true };
}

const database = assertLocalDevelopmentDatabase(process.env.DATABASE_URL);
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

try {
  await db.transaction(async (tx) => {
    // Only these exact slugs, and only here, where the database is already known to be a
    // local _dev one. Their members, people, hours and services go with them (cascade).
    const retired = await tx
      .delete(organization)
      .where(inArray(organization.slug, RETIRED_DEV_SLUGS))
      .returning({ name: organization.name });
    for (const { name } of retired) console.log(`Removed the old made-up business "${name}"`);

    for (const account of ACCOUNTS) {
      const { business } = account;

      const [existingUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, account.email))
        .limit(1);

      const userId = existingUser?.id ?? randomUUID();
      if (!existingUser) {
        await tx.insert(user).values({
          id: userId,
          name: account.name,
          email: account.email,
          emailVerified: true,
          role: account.role,
        });
      }

      const [existingOrg] = await tx
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, business.slug))
        .limit(1);

      const organizationId = existingOrg?.id ?? randomUUID();
      if (!existingOrg) {
        // plan is left to its default, "agency", as for a business created in the app.
        await tx.insert(organization).values({
          id: organizationId,
          name: business.name,
          slug: business.slug,
        });
      }

      const [existingMember] = await tx
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
        .limit(1);

      if (!existingMember) {
        await tx.insert(member).values({
          id: randomUUID(),
          organizationId,
          userId,
          role: "owner",
        });
      }

      // The first person, named after the business like the 2.1 migration and hook name it.
      // Made here when missing: on a fresh database the migration's backfill ran before this
      // business existed, and inserting it directly skips the Better Auth hook (F-17).
      const firstPerson = await ensureResource(tx, organizationId, business.name, "person");

      // Parsed before writing, so a bad week stops the whole seed instead of reaching the
      // database, whose jsonb columns would accept it (the 2.2 review's warning).
      const [existingBusinessHours] = await tx
        .select({ id: availabilityRule.id })
        .from(availabilityRule)
        .where(
          and(
            eq(availabilityRule.organizationId, organizationId),
            isNull(availabilityRule.resourceId)
          )
        )
        .limit(1);
      if (!existingBusinessHours) {
        const hours = businessAvailabilityRuleValidationSchema.parse({
          resourceId: null,
          ...business.hours,
        });
        await tx.insert(availabilityRule).values({ id: randomUUID(), organizationId, ...hours });
      }

      let peopleMade = 0;
      let hoursMade = 0;
      for (const person of business.people as readonly ResourceSeedType[]) {
        const { id: resourceId, made } = await ensureResource(
          tx,
          organizationId,
          person.name,
          person.kind
        );
        if (made) peopleMade++;
        // No row only when there is nothing to store: no week and no extra dates. Someone
        // with extra dates but no week still gets a row, following the business's week.
        if (person.weeklyHours === undefined && !person.dateHours?.length) continue;

        const [existingHours] = await tx
          .select({ id: availabilityRule.id })
          .from(availabilityRule)
          .where(
            and(
              eq(availabilityRule.organizationId, organizationId),
              eq(availabilityRule.resourceId, resourceId)
            )
          )
          .limit(1);
        if (existingHours) continue;

        const hours = personAvailabilityRuleValidationSchema.parse({
          resourceId,
          weeklyHours: person.weeklyHours ?? null,
          dateHours: person.dateHours ?? [],
        });
        await tx.insert(availabilityRule).values({ id: randomUUID(), organizationId, ...hours });
        hoursMade++;
      }

      let servicesMade = 0;
      for (const service of business.services as readonly ServiceSeedType[]) {
        const slug = toSlug(service.name);
        const [existingLink] = await tx
          .select({ id: bookingLink.id })
          .from(bookingLink)
          .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.slug, slug)))
          .limit(1);
        if (existingLink) continue;

        await tx.insert(bookingLink).values({ id: randomUUID(), organizationId, slug, ...service });
        servicesMade++;
      }

      const made = [
        !existingUser && "account",
        !existingOrg && "business",
        !existingMember && "membership",
        firstPerson.made && "first person",
        !existingBusinessHours && "business hours",
        peopleMade && `${peopleMade} people and places`,
        hoursMade && `${hoursMade} people's own hours`,
        servicesMade && `${servicesMade} services`,
      ].filter(Boolean);
      console.log(
        `${account.email.padEnd(20)} ${account.role === "admin" ? "platform admin" : "ordinary owner"}, ` +
          `owns "${business.name}"  ${made.length ? "(created " + made.join(", ") + ")" : "(already there)"}`
      );
    }
  });

  console.log(
    `\nSeeded ${database}. Sign in at http://localhost:3000/sign-in; codes print in the API console.`
  );
} finally {
  await client.end();
}
