// Shared: makes the one platform admin login on a database that has none (10b). Signup is closed
// and the seed refuses a live database, so without this an empty live database has no way in.
// Signs nobody in: the code comes at sign-in, like any login.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "../db/index.js";
import { user } from "../db/index.js";
import { emailAddressValidationSchema } from "../zod-validation/auth-validation-schemas/email-address-validation-schema.js";

type AdminDatabaseType = PostgresJsDatabase<typeof schema>;
type AdminTransactionType = Parameters<Parameters<AdminDatabaseType["transaction"]>[0]>[0];

export type CreatePlatformAdminResultType =
  { ok: true; email: string } | { ok: false; reason: string };

export async function createPlatformAdmin(
  db: AdminDatabaseType | AdminTransactionType,
  emailInput: string
): Promise<CreatePlatformAdminResultType> {
  const parsed = emailAddressValidationSchema.safeParse(emailInput);
  if (!parsed.success) return { ok: false, reason: `"${emailInput}" is not an email address.` };
  const email = parsed.data;

  return db.transaction(async (tx) => {
    const [admin] = await tx
      .select({ email: user.email })
      .from(user)
      .where(eq(user.role, "admin"))
      .limit(1);
    if (admin) return { ok: false, reason: `There is already a platform admin: ${admin.email}.` };

    const [taken] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (taken) return { ok: false, reason: `${email} is already a login, not an admin one.` };

    // As the seed makes its admin: no name yet, the email trusted because Frank typed it here.
    await tx
      .insert(user)
      .values({ id: randomUUID(), name: "", email, emailVerified: true, role: "admin" });
    return { ok: true, email };
  });
}
