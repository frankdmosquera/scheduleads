// Shared script: fills the local database with two dev accounts and two made-up businesses,
// a painting company like Primo and a clinic like Face and Body. Signup is closed, so a fresh
// database has no other way in. Safe to rerun: everything is made only when missing.
// Run: npm run db:seed --workspace=@scheduleads-app/shared

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { DEFAULT_PIPELINE_STAGES } from "@scheduleads-app/shared/crm";
import * as schema from "@scheduleads-app/shared/db";
import {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  member,
  organization,
  pipelineStage,
  resource,
  standbyDate,
  textSettings,
  user,
  workerTextSettings,
} from "@scheduleads-app/shared/db";
import {
  businessAvailabilityRuleValidationSchema,
  personAvailabilityRuleValidationSchema,
  textSettingsValidationSchema,
  workerTextSettingsValidationSchema,
  type DateHoursType,
  type WeeklyHoursType,
  type WorkerTextSettingsInputType,
} from "@scheduleads-app/shared/zod-validation";
import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";
import { toSlug } from "@scheduleads-app/shared/helpers";

// Minutes from midnight, so 9:30 reads as at(9, 30) instead of 570.
const at = (hour: number, minute = 0) => hour * 60 + minute;
const between = (from: number, to: number) => ({ startMinute: from, endMinute: to });

// Dates relative to the day the seed runs, so they never go stale. UTC; a day off is fine.
const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromToday = (days: number) =>
  new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
function sundayAfterDays(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7)); // forward to a Sunday
  return date.toISOString().slice(0, 10);
}
function mondayAfterDays(days: number): string {
  const date = new Date(Date.now() + days * DAY_MS);
  date.setUTCDate(date.getUTCDate() + ((8 - date.getUTCDay()) % 7)); // forward to a Monday
  return date.toISOString().slice(0, 10);
}

export type ResourceSeedType = {
  name: string;
  kind: "person" | "place";
  weeklyHours?: WeeklyHoursType | null; // missing = no row, follows the business's week
  dateHours?: DateHoursType;
  standbyDates?: string[]; // at work, hidden from customers on these dates
  workerTexts?: WorkerTextSettingsInputType; // a person only; missing = no row, no texts (8c)
};

export type ServiceSeedType = {
  name: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  slotIntervalMinutes?: number; // minutes between start times; missing = every service length
  ticked?: string[]; // who does what: the people who can do it and the rooms it is done in, by name
};

// Alberta's nine main holidays, the picker's one-click set (feature 12).
const albertaMainHolidays = [
  "New Year's Day",
  "Family Day",
  "Good Friday",
  "Victoria Day",
  "Canada Day",
  "Labour Day",
  "Thanksgiving",
  "Remembrance Day",
  "Christmas Day",
];

// Primo's shape: estimates early morning and evenings on weekdays, daytime at weekends.
const paintingWeekday = [between(at(7, 30), at(8, 30)), between(at(17), at(19, 30))];

// The clinic's who does what: the practitioners who do each kind of treatment, and its rooms.
const FACIALS = ["Sofia", "Ana", "Mei", "Room 3 (massage, facials)"];
const MASSAGES = [
  "Luis",
  "Ana",
  "Priya",
  "Daniel",
  "Room 1 (massage)",
  "Room 2 (massage)",
  "Room 3 (massage, facials)",
  "Room 4 (massage, body)",
];

// Made by this seed before 2026-09-25; removed so another machine's database never mixes old and new.
const RETIRED_DEV_SLUGS = ["agency-dev", "test-salon-dev"];

// Fake addresses on purpose: login codes print in the API console. owner@example.com is the
// non-admin that proves an owner cannot create a business.
const ACCOUNTS = [
  {
    email: "admin@example.com",
    name: "Dev Admin",
    role: "admin",
    business: {
      name: "Summit Painting (dev)",
      slug: "painting-dev",
      // Who does the job (feature 9): Primo sends whoever is free, so the customer never picks.
      personChoice: "business_assigns",
      // What its emails need (feature 6). No Resend key: dev sends nothing real.
      emailDetails: {
        senderEmail: "bookings@example.com",
        notifyEmail: "admin@example.com",
        phone: "403 555 0100",
        website: "https://example.com",
        brandColor: "#1d4ed8",
      },
      // Its texts (feature 8b), Primo's shape: a made-up 555 number, so nothing could reach a
      // real phone, and without Twilio keys dev sends nothing anyway. Riverbend has none, so it
      // shows a business that sends no texts.
      textSettings: {
        fromNumber: "403 555 0199",
        confirmationOn: true,
        reminderMinutesBefore: [1200, 60],
        replyPhone: "403 555 0100",
        replyEmail: null,
      },
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
        holidayCountry: "CA",
        holidayRegion: "AB",
        closedHolidays: albertaMainHolidays, // as if the owner pressed "all main holidays"
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
        {
          name: "Pedro (painter)",
          kind: "person",
          // The worker's texts (feature 8c): a made-up 555 phone, every switch on. Nobody else
          // here or at Riverbend has a row, so they show a person who gets no texts.
          workerTexts: { phone: "403 555 0161", addedOn: true, movedOn: true, removedOn: true },
        },
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
      // Who does the job (feature 9): a clinic's customer picks a practitioner, or any available.
      personChoice: "customer_picks",
      emailDetails: {
        senderEmail: "hello@example.com",
        notifyEmail: "owner@example.com",
        phone: "403 555 0200",
        website: "https://example.com",
        brandColor: "#0f766e",
      },
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
        holidayCountry: "CA",
        holidayRegion: "AB",
        // As if the owner picked one by one, a national-only day among them.
        closedHolidays: [
          "New Year's Day",
          "National Day for Truth and Reconciliation",
          "Canada Day",
          "Christmas Day",
        ],
      },
      // Six practitioners with every kind of hours, then the five rooms feature 5 wires up.
      people: [
        {
          name: "Sofia",
          kind: "person",
          weeklyHours: {
            mon: [between(at(9), at(17))],
            wed: [between(at(9), at(17))],
            fri: [between(at(9), at(17))],
          },
          standbyDates: [mondayAfterDays(7)], // a Monday she would otherwise be bookable
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
      // Massages and the wrap leave 15 minutes after, to turn the room over. Ticked like Face and
      // Body; the peel ticks no one, so anyone can do it.
      services: [
        { name: "Deep Cleansing Facial", durationMinutes: 75, ticked: FACIALS },
        { name: "Dermaplaning Facial", durationMinutes: 60, ticked: FACIALS },
        { name: "Hydra Spa Facial", durationMinutes: 70, ticked: FACIALS },
        {
          name: "Chemical Peel",
          durationMinutes: 30,
          slotIntervalMinutes: 15, // the one dev service whose start times repeat more often than its length
          ticked: ["Room 3 (massage, facials)"],
        },
        {
          name: "Relaxation Massage",
          durationMinutes: 60,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Relaxation Massage, 90 min",
          durationMinutes: 90,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Deep Tissue Massage",
          durationMinutes: 75,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Lymphatic Drainage Massage",
          durationMinutes: 60,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        { name: "Laser Hair Removal", durationMinutes: 10, ticked: ["Mei", "Room 5 (laser)"] },
        {
          name: "Body Wrap",
          durationMinutes: 60,
          bufferAfterMinutes: 15,
          ticked: ["Priya", "Room 4 (massage, body)"],
        },
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

const database = assertLocalDevDatabase(process.env.DATABASE_URL, "seed");
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

      // Its email details, only while it has none, so details changed by hand survive a reseed.
      await tx
        .update(organization)
        .set(business.emailDetails)
        .where(and(eq(organization.id, organizationId), isNull(organization.senderEmail)));

      // Its text settings, only while it has none, so settings changed by hand survive a reseed.
      // Parsed before writing: the schema refuses repeated reminders, which the table cannot.
      const textSettingsMade =
        "textSettings" in business &&
        (
          await tx
            .insert(textSettings)
            .values({
              organizationId,
              ...textSettingsValidationSchema.parse(business.textSettings),
            })
            .onConflictDoNothing({ target: textSettings.organizationId })
            .returning({ id: textSettings.organizationId })
        ).length > 0;

      // The first person. Made here because inserting the business directly skips the
      // Better Auth hook that normally makes it.
      const firstPerson = await ensureResource(tx, organizationId, business.name, "person");

      // Linked to its owner's login, as the create hook does. Also on a database seeded
      // before the link existed, so no machine needs a rebuild.
      const linked = await tx
        .update(resource)
        .set({ userId })
        .where(and(eq(resource.id, firstPerson.id), isNull(resource.userId)))
        .returning({ id: resource.id });

      // The four default stages, as the create hook gives a new business. Only when it has
      // none, so stages renamed by hand survive a reseed.
      const [anyStage] = await tx
        .select({ id: pipelineStage.id })
        .from(pipelineStage)
        .where(eq(pipelineStage.organizationId, organizationId))
        .limit(1);
      if (!anyStage) {
        await tx.insert(pipelineStage).values(
          DEFAULT_PIPELINE_STAGES.map((name, index) => ({
            id: randomUUID(),
            organizationId,
            name,
            position: index + 1,
          }))
        );
      }

      // Parsed before writing: the jsonb columns would accept a bad week.
      const [existingBusinessHours] = await tx
        .select({
          id: availabilityRule.id,
          holidayCountry: availabilityRule.holidayCountry,
          closedHolidays: availabilityRule.closedHolidays,
        })
        .from(availabilityRule)
        .where(
          and(
            eq(availabilityRule.organizationId, organizationId),
            isNull(availabilityRule.resourceId)
          )
        )
        .limit(1);
      const hours = businessAvailabilityRuleValidationSchema.parse({
        resourceId: null,
        ...business.hours,
      });
      if (!existingBusinessHours) {
        await tx.insert(availabilityRule).values({ id: randomUUID(), organizationId, ...hours });
      }
      // A row seeded before holidays existed gets the picks, so no machine needs a rebuild.
      const holidaysAdded =
        existingBusinessHours?.holidayCountry === null &&
        existingBusinessHours.closedHolidays.length === 0;
      if (holidaysAdded) {
        await tx
          .update(availabilityRule)
          .set({
            holidayCountry: hours.holidayCountry,
            holidayRegion: hours.holidayRegion,
            closedHolidays: hours.closedHolidays,
          })
          .where(eq(availabilityRule.id, existingBusinessHours.id));
      }

      let peopleMade = 0;
      let hoursMade = 0;
      let standbyMade = 0;
      let workerTextsMade = 0;
      const resourceIdsByName = new Map<string, string>([[business.name, firstPerson.id]]);
      for (const person of business.people as readonly ResourceSeedType[]) {
        const { id: resourceId, made } = await ensureResource(
          tx,
          organizationId,
          person.name,
          person.kind
        );
        resourceIdsByName.set(person.name, resourceId);
        if (made) peopleMade++;

        // A date already there stays; a rerun on a later day adds that day's Monday too.
        if (person.standbyDates?.length) {
          const madeDates = await tx
            .insert(standbyDate)
            .values(person.standbyDates.map((date) => ({ organizationId, resourceId, date })))
            .onConflictDoNothing()
            .returning({ date: standbyDate.date });
          standbyMade += madeDates.length;
        }

        // Their worker-text settings, only while they have none, so settings changed by hand
        // survive a reseed.
        if (person.workerTexts) {
          if (person.kind !== "person")
            throw new Error(`${person.name} is a place: only people get texts.`);
          const madeSettings = await tx
            .insert(workerTextSettings)
            .values({
              personId: resourceId,
              organizationId,
              ...workerTextSettingsValidationSchema.parse(person.workerTexts),
            })
            .onConflictDoNothing({ target: workerTextSettings.personId })
            .returning({ id: workerTextSettings.personId });
          workerTextsMade += madeSettings.length;
        }

        // No row only when there is nothing to store: no week and no extra dates.
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
      let ticksMade = 0;
      for (const { ticked = [], ...service } of business.services as readonly ServiceSeedType[]) {
        const slug = toSlug(service.name);
        const [existingLink] = await tx
          .select({ id: bookingLink.id })
          .from(bookingLink)
          .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.slug, slug)))
          .limit(1);

        const bookingLinkId = existingLink?.id ?? randomUUID();
        if (!existingLink) {
          await tx.insert(bookingLink).values({
            id: bookingLinkId,
            organizationId,
            slug,
            layout: "month", // the only layout built (feature 9)
            personChoice: business.personChoice,
            ...service,
          });
          servicesMade++;
        }

        if (!ticked.length) continue;
        const ticks = ticked.map((name) => {
          const resourceId = resourceIdsByName.get(name);
          if (!resourceId)
            throw new Error(`The seed ticks "${name}", who is not in ${business.name}.`);
          return { organizationId, bookingLinkId, resourceId };
        });
        // Only missing ticks: one removed by hand comes back, any added by hand stays.
        const madeTicks = await tx
          .insert(bookingLinkResource)
          .values(ticks)
          .onConflictDoNothing()
          .returning({ resourceId: bookingLinkResource.resourceId });
        ticksMade += madeTicks.length;
      }

      const made = [
        !existingUser && "account",
        !existingOrg && "business",
        !existingMember && "membership",
        !anyStage && "pipeline stages",
        firstPerson.made && "first person",
        linked.length && "first person's login link",
        !existingBusinessHours && "business hours",
        holidaysAdded && "holiday picks",
        peopleMade && `${peopleMade} people and places`,
        hoursMade && `${hoursMade} people's own hours`,
        standbyMade && `${standbyMade} standby dates`,
        servicesMade && `${servicesMade} services`,
        ticksMade && `${ticksMade} who-does-what ticks`,
        textSettingsMade && "text settings",
        workerTextsMade && `${workerTextsMade} worker text settings`,
      ].filter(Boolean);
      console.log(
        `${account.email.padEnd(20)} ${account.role === "admin" ? "platform admin" : "ordinary owner"}, ` +
          `owns "${business.name}"  ${made.length ? "(created " + made.join(", ") + ")" : "(already there)"}`
      );
    }
  });

  console.log(
    `\nSeeded ${database}. Sign in at http://localhost:3400/sign-in; codes print in the API console.`
  );
} finally {
  await client.end();
}
