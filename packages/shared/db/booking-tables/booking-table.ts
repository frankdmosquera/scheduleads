// Shared: the booking table. One appointment for a lead: the service, the person, the room when
// the service needs one, when, and the customer's address. startsAt to endsAt is the appointment
// itself; the buffers live only in its commitments, which point back here.

import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { lead } from "../crm-tables/lead-table.js";
import { bookingLink } from "./booking-link-table.js";
import { resource } from "./resource-table.js";

export const booking = pgTable(
  "booking",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    leadId: text("leadId").notNull(),
    bookingLinkId: text("bookingLinkId").notNull(),
    personId: text("personId").notNull(),
    placeId: text("placeId"), // null when the service needs no room
    startsAt: timestamp("startsAt", { withTimezone: true }).notNull(),
    endsAt: timestamp("endsAt", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("confirmed"),
    location: text("location"), // the customer's address, as typed; null when the service asks none
    calendarEventId: text("calendarEventId"), // the booked person's Google event, once written
    requestKey: text("requestKey"), // one per booking form; null when the owner books
    // The calendar invite's number: 0 when made, one more for each move, so the customer's
    // calendar always takes the latest version (feature 7b, decision 6).
    sequence: integer("sequence").notNull().default(0),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Exists so commitment can point at (business, booking) together.
    unique("booking_organization_id_unique").on(table.organizationId, table.id),
    // Each only of the same business. No action: a lead, service, person or room with a booking
    // cannot be deleted; deleting the whole business takes them all.
    foreignKey({
      name: "booking_lead_fk",
      columns: [table.organizationId, table.leadId],
      foreignColumns: [lead.organizationId, lead.id],
    }).onDelete("no action"),
    foreignKey({
      name: "booking_booking_link_fk",
      columns: [table.organizationId, table.bookingLinkId],
      foreignColumns: [bookingLink.organizationId, bookingLink.id],
    }).onDelete("no action"),
    foreignKey({
      name: "booking_person_fk",
      columns: [table.organizationId, table.personId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("no action"),
    // A null placeId is not checked: a foreign key with a null column matches nothing.
    foreignKey({
      name: "booking_place_fk",
      columns: [table.organizationId, table.placeId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("no action"),
    check("booking_status_check", sql`${table.status} in ('confirmed', 'cancelled')`),
    check("booking_time_order_check", sql`${table.endsAt} > ${table.startsAt}`),
    check("booking_location_check", sql`length(btrim(${table.location})) > 0`),
    index("booking_starts_at_index").on(table.organizationId, table.startsAt),
    index("booking_lead_index").on(table.organizationId, table.leadId),
    // One booking per form, even when two copies arrive at the same instant (a double tap).
    uniqueIndex("booking_request_key_unique")
      .on(table.organizationId, table.requestKey)
      .where(sql`${table.requestKey} is not null`),
  ]
);
