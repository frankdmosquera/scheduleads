// Shared: applies a setup file to its business. Without `apply` it runs everything and rolls it
// back, so a dry run reports exactly what an apply would add. Every difference between the file
// and a row already there is listed, never overwritten: a hand edit is seen, not lost.

import { and, eq, isNull } from "drizzle-orm";

import {
  availabilityRule,
  bookingLink,
  bookingQuestion,
  organization,
  resource,
} from "../db/index.js";
import { toSlug } from "../helpers/to-slug.js";
import type { ClientSetupType } from "../zod-validation/admin-validation-schemas/client-setup-validation-schema.js";
import {
  applyBusinessShape,
  type SetupDatabaseType,
  type SetupTransactionType,
} from "./apply-business-shape.js";

export type ClientSetupResultType =
  | { ok: true; business: string; made: string[]; differences: string[]; applied: boolean }
  | { ok: false; reason: string };

class DryRunRollback extends Error {}

export async function runClientSetup(
  db: SetupDatabaseType,
  setup: ClientSetupType,
  { apply }: { apply: boolean }
): Promise<ClientSetupResultType> {
  const [business] = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.slug, setup.slug))
    .limit(1);
  // Never made here: a business comes from the client setup screen, with its owner's login.
  if (!business)
    return {
      ok: false,
      reason: `No business "${setup.slug}". Make it first on /admin/client-setup.`,
    };

  // Its first person, made with it and named after it.
  const [firstPerson] = await db
    .select({ id: resource.id, name: resource.name })
    .from(resource)
    .where(and(eq(resource.organizationId, business.id), eq(resource.name, business.name)))
    .limit(1);
  if (!firstPerson)
    return { ok: false, reason: `"${business.name}" has no first person named after it.` };

  let made: string[] = [];
  let differences: string[] = [];
  try {
    await db.transaction(async (tx) => {
      differences = await findDifferences(tx, business.id, setup);
      made = await applyBusinessShape(tx, business.id, firstPerson, setup);
      if (!apply) throw new DryRunRollback();
    });
  } catch (error) {
    if (!(error instanceof DryRunRollback)) throw error;
  }
  return { ok: true, business: business.name, made, differences, applied: apply };
}

// Rows already there that the file describes differently. Read before anything is added, so
// what the apply itself makes is never reported as a difference.
async function findDifferences(
  tx: SetupTransactionType,
  organizationId: string,
  setup: ClientSetupType
): Promise<string[]> {
  const differences: string[] = [];
  const differs = (what: string, saved: unknown, file: unknown) => {
    if (canonical(saved) !== canonical(file))
      differences.push(`${what}: saved ${canonical(saved)}, file ${canonical(file)}`);
  };

  const [hours] = await tx
    .select()
    .from(availabilityRule)
    .where(
      and(eq(availabilityRule.organizationId, organizationId), isNull(availabilityRule.resourceId))
    )
    .limit(1);
  if (hours) {
    for (const field of [
      "weeklyHours",
      "dateHours",
      "timezone",
      "minimumNoticeMinutes",
      "horizonDays",
      "closedDates",
      "holidayCountry",
      "holidayRegion",
      "closedHolidays",
    ] as const)
      differs(`hours, ${field}`, hours[field], setup.hours[field]);
  }

  const questions = await tx
    .select({ label: bookingQuestion.label, required: bookingQuestion.required })
    .from(bookingQuestion)
    .where(eq(bookingQuestion.organizationId, organizationId))
    .orderBy(bookingQuestion.position);
  if (questions.length) differs("questions", questions, setup.questions);

  for (const { ticked: _ticked, ...service } of setup.services) {
    const [saved] = await tx
      .select()
      .from(bookingLink)
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          eq(bookingLink.slug, toSlug(service.name))
        )
      )
      .limit(1);
    if (!saved) continue;
    differs(`"${service.name}", name`, saved.name, service.name);
    differs(`"${service.name}", description`, saved.description, service.description ?? null);
    differs(`"${service.name}", durationMinutes`, saved.durationMinutes, service.durationMinutes);
    differs(
      `"${service.name}", bufferBeforeMinutes`,
      saved.bufferBeforeMinutes,
      service.bufferBeforeMinutes ?? 0
    );
    differs(
      `"${service.name}", bufferAfterMinutes`,
      saved.bufferAfterMinutes,
      service.bufferAfterMinutes ?? 0
    );
    differs(
      `"${service.name}", slotIntervalMinutes`,
      saved.slotIntervalMinutes,
      service.slotIntervalMinutes ?? null
    );
    differs(`"${service.name}", personChoice`, saved.personChoice, setup.personChoice);
  }

  for (const person of setup.people) {
    const [saved] = await tx
      .select({ kind: resource.kind })
      .from(resource)
      .where(and(eq(resource.organizationId, organizationId), eq(resource.name, person.name)))
      .limit(1);
    if (saved) differs(`"${person.name}", kind`, saved.kind, person.kind);
  }

  return differences;
}

// JSON with every object's keys sorted: Postgres stores jsonb keys in its own order, so the same
// week read back would otherwise compare as different.
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner !== null && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner).sort(([a], [b]) => a.localeCompare(b)))
      : inner
  );
}
