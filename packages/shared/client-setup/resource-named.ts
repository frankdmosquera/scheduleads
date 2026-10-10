// Shared: which of a business's people and places a setup file's entry is: the one with the same
// name, ignoring case and spaces at the ends, as Settings compares names (12d, decision 6).

import { and, eq, sql, type SQL } from "drizzle-orm";

import { resource } from "../db/index.js";
import { nameKeyOf } from "./name-key-of.js";

export function resourceNamed(organizationId: string, name: string): SQL | undefined {
  return and(
    eq(resource.organizationId, organizationId),
    sql`lower(btrim(${resource.name})) = ${nameKeyOf(name)}`
  );
}
