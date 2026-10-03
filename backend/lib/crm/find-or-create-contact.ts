// Backend: finds a business's contact by email, or makes one. Called by feature 5 for every
// booking. The same email in the same business is the same contact.

import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { contact } from "@scheduleads-app/shared/db";
import {
  contactValidationSchema,
  type ContactInputType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type ContactType = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

const contactColumns = {
  id: contact.id,
  name: contact.name,
  email: contact.email,
  phone: contact.phone,
};

export async function findOrCreateContact(
  organizationId: string,
  input: ContactInputType,
  executor: DatabaseExecutorType = db
): Promise<{ contact: ContactType; created: boolean }> {
  const { name, email, phone } = contactValidationSchema.parse(input); // trimmed, email lowercased

  try {
    // Inserted first and read only if that changed nothing, so two bookings at the same
    // instant with one email still make one contact: the unique email index decides.
    const [made] = await executor
      .insert(contact)
      .values({
        id: randomUUID(),
        organizationId,
        name,
        email: email ?? null,
        phone: phone ?? null,
      })
      .onConflictDoNothing()
      .returning(contactColumns);
    if (made) return { contact: made, created: true };
    if (!email) throw new Error("A contact without an email was not saved.");

    // A known email: that contact. The name and phone first given are kept; a phone is only filled
    // in when it had none, so typing someone's email on a public form never changes their details.
    const known = phone
      ? ((
          await executor
            .update(contact)
            .set({ phone })
            .where(
              and(
                eq(contact.organizationId, organizationId),
                eq(contact.email, email),
                isNull(contact.phone)
              )
            )
            .returning(contactColumns)
        )[0] ?? null)
      : null;
    if (known) return { contact: known, created: false };
    const [found] = await executor
      .select(contactColumns)
      .from(contact)
      .where(and(eq(contact.organizationId, organizationId), eq(contact.email, email)))
      .limit(1);
    if (!found) throw new Error("A contact's email clashed, but no contact has it.");
    return { contact: found, created: false };
  } catch (error) {
    // Never the database's own error: its message carries the query, the customer's email in
    // it, and Hono logs whatever reaches it.
    throw new Error(`Saving a contact failed: ${safeErrorReason(error)}`);
  }
}
