// Backend: adds a service from the owner's Services page (feature 12d). Its slug comes from its name
// once, made unique in the business with -2, -3; a rename never changes it.

import { randomUUID } from "node:crypto";

import { and, eq, like, or } from "drizzle-orm";

import { bookingLink } from "@scheduleads-app/shared/db";
import { toSlug } from "@scheduleads-app/shared/helpers";
import type { ServiceType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { serviceSettingsColumns, type ServiceSettingsType } from "./find-services-settings.js";

const ATTEMPTS = 5; // each lost race reads the slugs again; five in a row means something else is wrong

export async function addService(
  organizationId: string,
  service: ServiceType
): Promise<ServiceSettingsType> {
  const base = toSlug(service.name) || "service"; // a name of only symbols still gets a slug

  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const taken = await db
      .select({ slug: bookingLink.slug })
      .from(bookingLink)
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          or(eq(bookingLink.slug, base), like(bookingLink.slug, `${base}-%`))
        )
      );
    const used = new Set(taken.map((row) => row.slug));
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;

    // The unique index settles two adds of the same name at once: the loser tries the next slug.
    const [added] = await db
      .insert(bookingLink)
      .values({ id: randomUUID(), organizationId, slug, layout: "month", ...service })
      .onConflictDoNothing()
      .returning(serviceSettingsColumns);
    if (added) return added;
  }
  throw new Error(`Could not find a free slug for "${base}" in ${ATTEMPTS} tries.`);
}
