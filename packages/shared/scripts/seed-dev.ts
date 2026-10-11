// Shared script: fills the local database with two dev accounts and two made-up businesses,
// a painting company like Primo and a clinic like Face and Body. Signup is closed, so a fresh
// database has no other way in. Safe to rerun: everything is made only when missing.
// Run: npm run db:seed --workspace=@scheduleads-app/shared

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { applyBusinessShape, ensureResource } from "@scheduleads-app/shared/client-setup";
import { DEFAULT_PIPELINE_STAGES } from "@scheduleads-app/shared/crm";
import * as schema from "@scheduleads-app/shared/db";
import {
  availabilityRule,
  bookingLink,
  member,
  organization,
  pipelineStage,
  resource,
  textSettings,
  user,
} from "@scheduleads-app/shared/db";
import {
  clientSetupValidationSchema,
  textSettingsValidationSchema,
  type ClientSetupInputType,
} from "@scheduleads-app/shared/zod-validation";
import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

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

// The seed's businesses are described like any client's setup file (feature 10).
type ResourceSeedType = ClientSetupInputType["people"][number];
type ServiceSeedType = ClientSetupInputType["services"][number];

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
      // Its own booking questions (feature 9), as Primo would ask them.
      questions: [
        { label: "Interior or exterior?", required: true },
        { label: "How many rooms?", required: false },
      ],
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
      // shows a business that sends no texts, and no box asking for a yes to later texts.
      textSettings: {
        fromNumber: "403 555 0199",
        confirmationOn: true,
        reminderMinutesBefore: [1200, 60],
        replyPhone: "403 555 0100",
        replyEmail: null,
        askLaterTextsYes: true,
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
        {
          name: "Interior estimate",
          durationMinutes: 60,
          asksAddress: true,
          bufferAfterMinutes: 15,
        },
        {
          name: "Exterior estimate",
          durationMinutes: 45,
          asksAddress: true,
          bufferBeforeMinutes: 15,
          bufferAfterMinutes: 15,
        },
        {
          name: "Colour consultation",
          durationMinutes: 30,
          asksAddress: true,
          bufferAfterMinutes: 10,
        },
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
      questions: [
        { label: "Any allergies or skin conditions?", required: true },
        { label: "Is this your first visit?", required: false },
      ],
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
      // Riverbend keeps asking the address, as before the setting existed (the address fix).
      // Face and Body's own treatments and lengths (face-and-body/data/servicesData.ts).
      // Massages and the wrap leave 15 minutes after, to turn the room over. Ticked like Face and
      // Body; the peel ticks no one, so anyone can do it.
      services: [
        { name: "Deep Cleansing Facial", durationMinutes: 75, asksAddress: true, ticked: FACIALS },
        { name: "Dermaplaning Facial", durationMinutes: 60, asksAddress: true, ticked: FACIALS },
        { name: "Hydra Spa Facial", durationMinutes: 70, asksAddress: true, ticked: FACIALS },
        {
          name: "Chemical Peel",
          durationMinutes: 30,
          asksAddress: true,
          slotIntervalMinutes: 15, // the one dev service whose start times repeat more often than its length
          ticked: ["Room 3 (massage, facials)"],
        },
        {
          name: "Relaxation Massage",
          durationMinutes: 60,
          asksAddress: true,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Relaxation Massage, 90 min",
          durationMinutes: 90,
          asksAddress: true,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Deep Tissue Massage",
          durationMinutes: 75,
          asksAddress: true,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Lymphatic Drainage Massage",
          durationMinutes: 60,
          asksAddress: true,
          bufferAfterMinutes: 15,
          ticked: MASSAGES,
        },
        {
          name: "Laser Hair Removal",
          durationMinutes: 10,
          asksAddress: true,
          ticked: ["Mei", "Room 5 (laser)"],
        },
        {
          name: "Body Wrap",
          durationMinutes: 60,
          asksAddress: true,
          bufferAfterMinutes: 15,
          ticked: ["Priya", "Room 4 (massage, body)"],
        },
      ] satisfies ServiceSeedType[],
    },
  },
] as const;

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
      const seededTexts =
        "textSettings" in business
          ? textSettingsValidationSchema.parse(business.textSettings)
          : null;
      const textSettingsMade =
        seededTexts !== null &&
        (
          await tx
            .insert(textSettings)
            .values({ organizationId, ...seededTexts })
            .onConflictDoNothing({ target: textSettings.organizationId })
            .returning({ id: textSettings.organizationId })
        ).length > 0;

      // Its yes to later texts, also on a database seeded before the setting existed (migration
      // 0024 gave every row false), so no machine needs a rebuild. Only while the rest of the row
      // is still the seed's, so settings changed by hand survive a reseed.
      let laterTextsYesSet = false;
      if (seededTexts?.askLaterTextsYes && !textSettingsMade) {
        const [saved] = await tx
          .select()
          .from(textSettings)
          .where(eq(textSettings.organizationId, organizationId))
          .limit(1);
        const untouched =
          saved !== undefined &&
          !saved.askLaterTextsYes &&
          saved.fromNumber === seededTexts.fromNumber &&
          saved.confirmationOn === seededTexts.confirmationOn &&
          saved.reminderMinutesBefore.join() === seededTexts.reminderMinutesBefore.join() &&
          saved.replyPhone === seededTexts.replyPhone &&
          saved.replyEmail === seededTexts.replyEmail;
        if (untouched) {
          await tx
            .update(textSettings)
            .set({ askLaterTextsYes: true })
            .where(eq(textSettings.organizationId, organizationId));
          laterTextsYesSet = true;
        }
      }

      // The first person. Made here because inserting the business directly skips the
      // Better Auth hook that normally makes it. Found by its login once linked, since
      // Settings may have renamed it (12d).
      const [linkedPerson] = await tx
        .select({ id: resource.id })
        .from(resource)
        .where(and(eq(resource.organizationId, organizationId), eq(resource.userId, userId)))
        .limit(1);
      const firstPerson = linkedPerson
        ? { id: linkedPerson.id, made: false }
        : await ensureResource(tx, organizationId, business.name, "person");

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

      // Rows an older seed made, read before the shape is applied so they can be brought up to
      // date below, and no machine needs a rebuild.
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
      // Who picks the person, decided for the whole business, like the stages: only while every
      // service it has still holds the business_assigns migration 0022 gave them, so a choice
      // made by hand on any one keeps them all as they are.
      const choices = await tx
        .select({ personChoice: bookingLink.personChoice })
        .from(bookingLink)
        .where(eq(bookingLink.organizationId, organizationId));
      const bringChoicesUp =
        business.personChoice !== "business_assigns" &&
        choices.length > 0 &&
        choices.every((row) => row.personChoice === "business_assigns");

      // Its questions, hours, people and services: the same code a client's setup file runs.
      // Parsed before writing: the jsonb columns would accept a bad week.
      const shape = clientSetupValidationSchema.parse({
        slug: business.slug,
        personChoice: business.personChoice,
        questions: business.questions,
        hours: business.hours,
        people: business.people,
        services: business.services,
      });
      const madeByShape = await applyBusinessShape(
        tx,
        organizationId,
        { id: firstPerson.id, names: [business.name] },
        shape
      );

      // A row seeded before holidays existed gets the picks.
      const holidaysAdded =
        existingBusinessHours?.holidayCountry === null &&
        existingBusinessHours.closedHolidays.length === 0;
      if (holidaysAdded) {
        await tx
          .update(availabilityRule)
          .set({
            holidayCountry: shape.hours.holidayCountry,
            holidayRegion: shape.hours.holidayRegion,
            closedHolidays: shape.hours.closedHolidays,
          })
          .where(eq(availabilityRule.id, existingBusinessHours.id));
      }

      let choicesSet = 0;
      if (bringChoicesUp) {
        await tx
          .update(bookingLink)
          .set({ personChoice: business.personChoice })
          .where(eq(bookingLink.organizationId, organizationId));
        choicesSet = choices.length;
      }

      const made = [
        !existingUser && "account",
        !existingOrg && "business",
        !existingMember && "membership",
        !anyStage && "pipeline stages",
        firstPerson.made && "first person",
        linked.length && "first person's login link",
        holidaysAdded && "holiday picks",
        textSettingsMade && "text settings",
        ...madeByShape,
      ].filter(Boolean);
      console.log(
        `${account.email.padEnd(20)} ${account.role === "admin" ? "platform admin" : "ordinary owner"}, ` +
          `owns "${business.name}"  ${made.length ? "(created " + made.join(", ") + ")" : "(already there)"}`
      );
      if (choicesSet) console.log(`  who picks the person set on ${choicesSet} existing services`);
      if (laterTextsYesSet)
        console.log("  the yes to later texts asked on its existing text settings");
    }
  });

  console.log(
    `\nSeeded ${database}. Sign in at http://localhost:3400/sign-in; codes print in the API console.`
  );
} finally {
  await client.end();
}
