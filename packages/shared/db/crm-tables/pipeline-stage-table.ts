// Shared: the pipeline_stage table. A business's own stages, in order. Every business starts
// with the four in crm/default-pipeline-stages.ts (migration 0006, the create hook, the seed).

import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "../auth-tables/organization-table.js";

export const pipelineStage = pgTable(
  "pipeline_stage",
  {
    id: text("id").primaryKey(),
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Lowest first. Not unique, so a later reorder needs no shuffling; ties go by createdAt, id.
    position: integer("position").notNull(),
    createdAt: timestamp("createdAt", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Exists so feature 5's lead can point at (business, stage) together.
    unique("pipeline_stage_organization_id_unique").on(table.organizationId, table.id),
    // "New" and "new" are the same name: a board never shows two stages that look alike.
    uniqueIndex("pipeline_stage_organization_name_unique").on(
      table.organizationId,
      sql`lower(${table.name})`
    ),
  ]
);
