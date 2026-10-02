// Shared: the booking_link_resource table. Who does what: one row per tick, a person who can do
// a service or a place it can be done in; the resource's own kind says which. Nobody ticked
// means anyone can do it, no place ticked means no room check (decided where it is read, 5b.3).

import { foreignKey, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { bookingLink } from "../booking-tables/booking-link-table.js";
import { resource } from "../booking-tables/resource-table.js";

export const bookingLinkResource = pgTable(
  "booking_link_resource",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    bookingLinkId: text("bookingLinkId").notNull(),
    resourceId: text("resourceId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.bookingLinkId, table.resourceId] }), // a tick exists or not
    // Only a service and a person or place of the same business. Ticks are settings, not
    // history, so they go with either.
    foreignKey({
      name: "booking_link_resource_booking_link_fk",
      columns: [table.organizationId, table.bookingLinkId],
      foreignColumns: [bookingLink.organizationId, bookingLink.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "booking_link_resource_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
  ]
);
