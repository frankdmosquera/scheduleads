// Shared: the availability_rule table. Bookable hours: when customers can book online,
// not opening hours and not time at work. A null resourceId is the business's own row; a
// set one is that person's.

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import type { DateHoursType } from "../../zod-validation/availability-validation-schemas/date-hours-validation-schema.js";
import type { WeeklyHoursType } from "../../zod-validation/availability-validation-schemas/weekly-hours-validation-schema.js";
import { resource } from "./resource-table.js";

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
    // Names the owner picked to close ("Family Day"), never dates, so each year gets its own.
    // Nothing is closed by default: the owner decides (project plan decision 30).
    closedHolidays: jsonb("closedHolidays").$type<string[]>().notNull().default([]),

    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Two indexes, not one: a single unique(organizationId, resourceId) would allow two
    // business rows, because Postgres treats nulls as all different.
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

    // Business-wide settings live only on the business's row, so nothing is copied or drifts.
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
        and ${table.closedHolidays} = '[]'::jsonb
      )`
    ),
    check("availability_rule_notice_check", sql`${table.minimumNoticeMinutes} >= 0`),
    check("availability_rule_horizon_check", sql`${table.horizonDays} > 0`),
    check(
      "availability_rule_region_needs_country_check",
      sql`${table.holidayRegion} is null or ${table.holidayCountry} is not null`
    ),
    check(
      "availability_rule_holidays_need_country_check",
      sql`${table.closedHolidays} = '[]'::jsonb or ${table.holidayCountry} is not null`
    ),
  ]
);
