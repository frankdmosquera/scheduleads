// Shared: the booking_link table. A service a customer can book: its length, the buffers
// around it and how often its start times repeat. The handle a host site stores as
// Service.bookingId.

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
    slotIntervalMinutes: integer("slotIntervalMinutes"), // minutes between start times; null = every durationMinutes
    // The business's choices for this service (decision 30), so neither has a default (feature 9).
    // How the booking modal looks; only the month is built.
    layout: text("layout", { enum: ["month"] }).notNull(),
    // Whether the customer picks who does it, or the business sends whoever is free.
    personChoice: text("personChoice", { enum: ["customer_picks", "business_assigns"] }).notNull(),
    // Whether the window asks the customer's address, and must have it; the business's choice per
    // service, so no default (decision 30).
    addressMode: text("addressMode", { enum: ["required", "optional", "not_asked"] }).notNull(),
    // Its price (feature 25d) in hundredths of the business currency: 15000 is 150. None: no price.
    priceCents: integer("priceCents"),
    priceFrom: boolean("priceFrom").notNull().default(false), // "From $150": it can cost more
    // Its photo in ImageKit (feature 25e), optional: the address the window shows, and the id to
    // delete it by when it is replaced or removed.
    imageUrl: text("imageUrl"),
    imageFileId: text("imageFileId"),
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
    check(
      "booking_link_slot_interval_check",
      sql`${table.slotIntervalMinutes} is null or ${table.slotIntervalMinutes} > 0`
    ),
    check("booking_link_price_check", sql`${table.priceCents} is null or ${table.priceCents} >= 0`),
    check(
      "booking_link_price_from_check",
      sql`${table.priceFrom} = false or ${table.priceCents} is not null`
    ),
    // The week strip (prototypes/modal-primo.html) comes back as one more value here.
    check("booking_link_layout_check", sql`${table.layout} in ('month')`),
    check(
      "booking_link_person_choice_check",
      sql`${table.personChoice} in ('customer_picks', 'business_assigns')`
    ),
    check(
      "booking_link_address_mode_check",
      sql`${table.addressMode} in ('required', 'optional', 'not_asked')`
    ),
  ]
);
