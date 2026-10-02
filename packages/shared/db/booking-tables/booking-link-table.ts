// Shared: the booking_link table. A service a customer can book: its length and the
// buffers around it. The handle a host site stores as Service.bookingId.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

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
    // Exists only so a tick (booking_link_resource) can point at (business, service) together.
    unique("booking_link_organization_id_unique").on(table.organizationId, table.id),
    uniqueIndex("booking_link_organization_slug_unique").on(table.organizationId, table.slug),
    check("booking_link_duration_check", sql`${table.durationMinutes} > 0`),
    check(
      "booking_link_buffers_check",
      sql`${table.bufferBeforeMinutes} >= 0 and ${table.bufferAfterMinutes} >= 0`
    ),
  ]
);
