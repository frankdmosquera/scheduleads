// Shared: which of a business's services a setup file's service is: the one with the same name,
// ignoring case and spaces at the ends. Never by slug, which keeps a service's first name (12d).
// Two of the same name (Settings allows it): the oldest, the same one every time.

import { and, asc, eq, sql, type SQL } from "drizzle-orm";

import { bookingLink } from "../db/index.js";
import { nameKeyOf } from "./name-key-of.js";

export function serviceNamed(organizationId: string, name: string): SQL | undefined {
  return and(
    eq(bookingLink.organizationId, organizationId),
    sql`lower(btrim(${bookingLink.name})) = ${nameKeyOf(name)}`
  );
}

export const oldestServiceFirst = [asc(bookingLink.createdAt), asc(bookingLink.id)];
