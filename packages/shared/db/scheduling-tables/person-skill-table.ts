// Shared: the person_skill table. What a person can do: one row per service, ticked on their card
// (feature 12k). Being able is not offering: booking_link_resource says who is on for a service
// now, and a person is on only while they have the skill. Only a person has skills; the save
// checks it.

import { foreignKey, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";
import { bookingLink } from "../booking-tables/booking-link-table.js";
import { resource } from "../booking-tables/resource-table.js";

export const personSkill = pgTable(
  "person_skill",
  {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    resourceId: text("resourceId").notNull(),
    bookingLinkId: text("bookingLinkId").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.resourceId, table.bookingLinkId] }), // a skill exists or not
    // Only a person and a service of the same business; either one gone takes the skill with it.
    foreignKey({
      name: "person_skill_resource_fk",
      columns: [table.organizationId, table.resourceId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "person_skill_booking_link_fk",
      columns: [table.organizationId, table.bookingLinkId],
      foreignColumns: [bookingLink.organizationId, bookingLink.id],
    }).onDelete("cascade"),
  ]
);
