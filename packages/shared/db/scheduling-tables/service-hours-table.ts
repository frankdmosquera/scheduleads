// Shared: the service_hours table. When a service runs (feature 12k), shaped like a person's own
// row of hours: its own week, or null to run whenever the business is open, and its one-off dates.
// No row: it runs whenever the business is open. It only narrows a person's hours, never widens
// them. Its own table, not availability_rule, whose business row is found as the one with no person.

import { foreignKey, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { bookingLink } from "../booking-tables/booking-link-table.js";
import type { DateHoursType } from "../../zod-validation/availability-validation-schemas/date-hours-validation-schema.js";
import type { WeeklyHoursType } from "../../zod-validation/availability-validation-schemas/weekly-hours-validation-schema.js";

export const serviceHours = pgTable(
  "service_hours",
  {
    bookingLinkId: text("bookingLinkId").primaryKey(), // one row per service
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    weeklyHours: jsonb("weeklyHours").$type<WeeklyHoursType>(), // null = whenever the business is open
    dateHours: jsonb("dateHours").$type<DateHoursType>().notNull().default([]),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Only a service of the same business; a deleted service takes its hours with it.
    foreignKey({
      name: "service_hours_booking_link_fk",
      columns: [table.organizationId, table.bookingLinkId],
      foreignColumns: [bookingLink.organizationId, bookingLink.id],
    }).onDelete("cascade"),
  ]
);
