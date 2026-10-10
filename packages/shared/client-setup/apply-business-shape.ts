// Shared: brings a business to the shape its setup file describes (its questions, hours, people
// and services), the one way both the dev seed and `npm run client:setup` do it. It only adds
// what is missing and never changes or removes a row, so anything changed by hand survives.

import { randomUUID } from "node:crypto";

import { and, eq, isNull, like, or } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import type * as schema from "../db/index.js";
import {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  bookingQuestion,
  resource,
  standbyDate,
  workerTextSettings,
} from "../db/index.js";
import { freeSlug, toSlug } from "../helpers/to-slug.js";
import { nameKeyOf } from "./name-key-of.js";
import { resourceNamed } from "./resource-named.js";
import { oldestServiceFirst, serviceNamed } from "./service-named.js";
import { personAvailabilityRuleValidationSchema } from "../zod-validation/availability-validation-schemas/availability-rule-validation-schema.js";
import type { ClientSetupType } from "../zod-validation/admin-validation-schemas/client-setup-validation-schema.js";

export type SetupDatabaseType = PostgresJsDatabase<typeof schema>;
export type SetupTransactionType = Parameters<Parameters<SetupDatabaseType["transaction"]>[0]>[0];

// Finds a resource by its name in this business (any case, no spaces at the ends), or makes it.
// Returns its id and whether it was made.
export async function ensureResource(
  tx: SetupTransactionType,
  organizationId: string,
  name: string,
  kind: "person" | "place"
): Promise<{ id: string; made: boolean }> {
  const [existing] = await tx
    .select({ id: resource.id })
    .from(resource)
    .where(resourceNamed(organizationId, name))
    .orderBy(resource.createdAt, resource.id)
    .limit(1);
  if (existing) return { id: existing.id, made: false };

  const id = randomUUID();
  await tx.insert(resource).values({ id, organizationId, name, kind });
  return { id, made: true };
}

// `firstPerson` is the person every business is made with: a service may tick them by the
// business's name or by their own, which Settings may have changed. Returns what was made.
export async function applyBusinessShape(
  tx: SetupTransactionType,
  organizationId: string,
  firstPerson: { id: string; names: string[] },
  shape: ClientSetupType
): Promise<string[]> {
  // Its booking questions, only when it has none, so questions changed by hand survive.
  const [anyQuestion] = await tx
    .select({ id: bookingQuestion.id })
    .from(bookingQuestion)
    .where(eq(bookingQuestion.organizationId, organizationId))
    .limit(1);
  const questionsMade = !anyQuestion && shape.questions.length > 0;
  if (questionsMade) {
    await tx.insert(bookingQuestion).values(
      shape.questions.map((question, index) => ({
        id: randomUUID(),
        organizationId,
        position: index + 1,
        ...question,
      }))
    );
  }

  const [existingBusinessHours] = await tx
    .select({ id: availabilityRule.id })
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  if (!existingBusinessHours) {
    await tx.insert(availabilityRule).values({ id: randomUUID(), organizationId, ...shape.hours });
  }

  let peopleMade = 0;
  let hoursMade = 0;
  let standbyMade = 0;
  let workerTextsMade = 0;
  // Keyed by nameKeyOf, so a tick finds its person whatever the case.
  const resourceIdsByName = new Map<string, string>(
    firstPerson.names.map((name) => [nameKeyOf(name), firstPerson.id])
  );
  for (const person of shape.people) {
    const { id: resourceId, made } = await ensureResource(
      tx,
      organizationId,
      person.name,
      person.kind
    );
    resourceIdsByName.set(nameKeyOf(person.name), resourceId);
    if (made) peopleMade++;

    // A date already there stays.
    if (person.standbyDates?.length) {
      const madeDates = await tx
        .insert(standbyDate)
        .values(person.standbyDates.map((date) => ({ organizationId, resourceId, date })))
        .onConflictDoNothing()
        .returning({ date: standbyDate.date });
      standbyMade += madeDates.length;
    }

    // Their worker-text settings, only while they have none.
    if (person.workerTexts) {
      const madeSettings = await tx
        .insert(workerTextSettings)
        .values({ personId: resourceId, organizationId, ...person.workerTexts })
        .onConflictDoNothing({ target: workerTextSettings.personId })
        .returning({ id: workerTextSettings.personId });
      workerTextsMade += madeSettings.length;
    }

    // No row only when there is nothing to store: no week and no extra dates.
    if (person.weeklyHours === undefined && !person.dateHours?.length) continue;

    const [existingHours] = await tx
      .select({ id: availabilityRule.id })
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          eq(availabilityRule.resourceId, resourceId)
        )
      )
      .limit(1);
    if (existingHours) continue;

    const hours = personAvailabilityRuleValidationSchema.parse({
      resourceId,
      weeklyHours: person.weeklyHours ?? null,
      dateHours: person.dateHours ?? [],
    });
    await tx.insert(availabilityRule).values({ id: randomUUID(), organizationId, ...hours });
    hoursMade++;
  }

  let servicesMade = 0;
  let ticksMade = 0;
  for (const { ticked = [], ...service } of shape.services) {
    const [existingLink] = await tx
      .select({ id: bookingLink.id })
      .from(bookingLink)
      .where(serviceNamed(organizationId, service.name))
      .orderBy(...oldestServiceFirst)
      .limit(1);

    const bookingLinkId = existingLink?.id ?? randomUUID();
    if (!existingLink) {
      // A slug another service already holds (one renamed on Settings keeps its first) gets -2.
      const base = toSlug(service.name) || "service";
      const taken = await tx
        .select({ slug: bookingLink.slug })
        .from(bookingLink)
        .where(
          and(
            eq(bookingLink.organizationId, organizationId),
            or(eq(bookingLink.slug, base), like(bookingLink.slug, `${base}-%`))
          )
        );
      const slug = freeSlug(
        base,
        taken.map((row) => row.slug)
      );
      await tx.insert(bookingLink).values({
        id: bookingLinkId,
        organizationId,
        slug,
        layout: "month", // the only layout built (feature 9)
        personChoice: shape.personChoice,
        ...service,
      });
      servicesMade++;
    }

    // Ticks only on a service made now: an existing one's ticks are the owner's, on Settings (12d).
    if (existingLink || !ticked.length) continue;
    const ticks = ticked.map((name) => {
      const resourceId = resourceIdsByName.get(nameKeyOf(name));
      if (!resourceId) throw new Error(`"${service.name}" ticks "${name}", who is not listed.`);
      return { organizationId, bookingLinkId, resourceId };
    });
    const madeTicks = await tx
      .insert(bookingLinkResource)
      .values(ticks)
      .onConflictDoNothing()
      .returning({ resourceId: bookingLinkResource.resourceId });
    ticksMade += madeTicks.length;
  }

  return [
    questionsMade && `${shape.questions.length} booking questions`,
    !existingBusinessHours && "business hours",
    peopleMade && `${peopleMade} people and places`,
    hoursMade && `${hoursMade} people's own hours`,
    standbyMade && `${standbyMade} standby dates`,
    workerTextsMade && `${workerTextsMade} worker text settings`,
    servicesMade && `${servicesMade} services`,
    ticksMade && `${ticksMade} who-does-what ticks`,
  ].filter((phrase): phrase is string => typeof phrase === "string");
}
