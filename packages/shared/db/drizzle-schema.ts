// Shared: the database tables, imported by the backend as @scheduleads-app/shared/db.
// Lives here so only one place can generate migrations. Better Auth's tables match its
// emailOTP, organization and admin plugins exactly; check its schema before changing them.
// Every timestamp keeps its time zone: a booking product that loses it double-books.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { DateHoursType } from "../zod-validation/availability/date-hours-validation-schema.js";
import type { WeeklyHoursType } from "../zod-validation/availability/weekly-hours-validation-schema.js";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),

  // The platform admin role (Frank). Set by hand in the database only: never add a
  // route, form or action that writes it.
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("banReason"),
  banExpires: timestamp("banExpires", { withTimezone: true }),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // The business this session acts for: the source of every organizationId the API uses.
  // Filled at sign-in by the session hook in backend/lib/auth/auth-server.ts.
  activeOrganizationId: text("activeOrganizationId"),

  impersonatedBy: text("impersonatedBy"), // set while the platform admin impersonates someone
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"), // unused: sign-in is by email code only
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull().defaultNow(),
});

export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  metadata: text("metadata"),

  // The subscription tier. No request can set it (input: false in auth-server.ts); only
  // Frank, by hand, until Stripe. A value subscription-limits.ts doesn't know unlocks nothing.
  plan: text("plan").notNull().default("agency"),
});

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // The role IN this business (owner | admin | member). Not the platform admin role on
    // user.role: two different things, never the same check.
    role: text("role").notNull().default("member"),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One membership per person per business. A duplicate would make someone with one
    // business look like they have two, and the API would refuse to pick.
    uniqueIndex("member_organization_user_unique").on(table.organizationId, table.userId),
  ]
);

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organizationId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  inviterId: text("inviterId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

// One person or one place (a room, a chair) that does or hosts the work. Never a group:
// a crew is a saved list of people (feature 19), so a job makes each of them busy.
// Every business has at least one, its first person, made by migration 0001 for the
// businesses that existed then and by a hook in auth-server.ts for every new one.
export const resource = pgTable(
  "resource",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // the first person starts with the business's name; the owner renames it (feature 12)
    kind: text("kind").notNull().default("person"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check("resource_kind_check", sql`${table.kind} in ('person', 'place')`),
    // Exists only so availability_rule can point at (business, person) together.
    unique("resource_organization_id_unique").on(table.organizationId, table.id),
  ]
);

// A service a customer can book: its length and the buffers around it. The handle a
// host site stores as Service.bookingId.
export const bookingLink = pgTable(
  "booking_link",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    durationMinutes: integer("durationMinutes").notNull(),
    bufferBeforeMinutes: integer("bufferBeforeMinutes").notNull().default(0),
    bufferAfterMinutes: integer("bufferAfterMinutes").notNull().default(0),
    active: boolean("active").notNull().default(true), // inactive reads as absent publicly
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("booking_link_organization_slug_unique").on(table.organizationId, table.slug),
    check("booking_link_duration_check", sql`${table.durationMinutes} > 0`),
    check(
      "booking_link_buffers_check",
      sql`${table.bufferBeforeMinutes} >= 0 and ${table.bufferAfterMinutes} >= 0`
    ),
  ]
);

// Bookable hours: when customers can book online, not opening hours and not time at
// work. A null resourceId is the business's own row; a set one is that person's.
export const availabilityRule = pgTable(
  "availability_rule",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId"),
    weeklyHours: jsonb("weeklyHours").$type<WeeklyHoursType>(), // a person's null = follow the business's week
    dateHours: jsonb("dateHours").$type<DateHoursType>().notNull().default([]),

    // Business row only, set once per business: the check below refuses them on a person's row.
    timezone: text("timezone"), // IANA name; every minute and date is local to it
    minimumNoticeMinutes: integer("minimumNoticeMinutes"),
    horizonDays: integer("horizonDays"), // how far ahead customers can book; no default, a writer sets it
    closedDates: jsonb("closedDates").$type<string[]>(), // YYYY-MM-DD
    holidayCountry: text("holidayCountry"), // ISO 3166-1, e.g. CA; null = no holidays
    holidayRegion: text("holidayRegion"), // the province, e.g. AB

    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Two indexes, not one. A single unique(organizationId, resourceId) looks right and
    // is broken: Postgres treats nulls as all different, so it would allow two business
    // rows. The partial index guards the business row, the other one each person's row.
    uniqueIndex("availability_rule_business_unique")
      .on(table.organizationId)
      .where(sql`${table.resourceId} is null`),
    uniqueIndex("availability_rule_resource_unique").on(table.organizationId, table.resourceId),

    // A rule can only name a person of its own business. A null resourceId skips the check.
    foreignKey({
      name: "availability_rule_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),

    // The two kinds of row. The business's row carries every business-wide setting; a
    // person's row carries none of them, so there is nothing to copy and nothing to drift.
    check(
      "availability_rule_row_kind_check",
      sql`(
        ${table.resourceId} is null
        and ${table.weeklyHours} is not null
        and ${table.timezone} is not null
        and ${table.minimumNoticeMinutes} is not null
        and ${table.horizonDays} is not null
        and ${table.closedDates} is not null
      ) or (
        ${table.resourceId} is not null
        and ${table.timezone} is null
        and ${table.minimumNoticeMinutes} is null
        and ${table.horizonDays} is null
        and ${table.closedDates} is null
        and ${table.holidayCountry} is null
        and ${table.holidayRegion} is null
      )`
    ),
    check("availability_rule_notice_check", sql`${table.minimumNoticeMinutes} >= 0`),
    check("availability_rule_horizon_check", sql`${table.horizonDays} > 0`),
    check(
      "availability_rule_region_needs_country_check",
      sql`${table.holidayRegion} is null or ${table.holidayCountry} is not null`
    ),
  ]
);
