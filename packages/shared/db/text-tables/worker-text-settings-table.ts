// Shared: the worker_text_settings table. One person's own choices for the texts that keep them in
// the loop about their day (feature 8c, decision 1): the phone they are texted on, and whether
// they hear when a booking is added to their day, moved, or taken off it. Nothing has a default:
// a person with no row gets no texts. Set at client setup until Settings (feature 12).

import { sql } from "drizzle-orm";
import { boolean, check, foreignKey, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { resource } from "../booking-tables/resource-table.js";
import { NORTH_AMERICAN_NUMBER } from "./north-american-number.js";

export const workerTextSettings = pgTable(
  "worker_text_settings",
  {
    personId: text("personId").primaryKey(),
    organizationId: text("organizationId").notNull(),
    // Not unique: two people may share one phone.
    phone: text("phone").notNull(),
    addedOn: boolean("addedOn").notNull(), // a new booking, or a move onto them
    movedOn: boolean("movedOn").notNull(), // their booking at a new time
    removedOn: boolean("removedOn").notNull(), // cancelled, or moved to another person
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Only a person of the same business; the row goes with them.
    foreignKey({
      name: "worker_text_settings_person_fk",
      columns: [table.organizationId, table.personId],
      foreignColumns: [resource.organizationId, resource.id],
    }).onDelete("cascade"),
    check(
      "worker_text_settings_phone_check",
      sql`${table.phone} ~ ${sql.raw(`'${NORTH_AMERICAN_NUMBER}'`)}`
    ),
  ]
);
