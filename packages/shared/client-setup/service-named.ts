// Shared: which of a business's services a setup file's service is: the one with the same name,
// ignoring case and spaces at the ends. Never by slug, which keeps a service's first name (12d).

import { and, eq, sql, type SQL } from "drizzle-orm";

import { bookingLink } from "../db/index.js";

export function serviceNamed(organizationId: string, name: string): SQL | undefined {
  return and(
    eq(bookingLink.organizationId, organizationId),
    sql`lower(btrim(${bookingLink.name})) = ${name.trim().toLowerCase()}`
  );
}
