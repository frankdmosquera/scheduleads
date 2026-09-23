/**
 * Puts two usable accounts into an empty local database.
 *
 * Why it has to exist: signup is closed (`disableSignUp` in the API's
 * `auth.ts`) and only the platform admin may create a business. That is
 * right for the product, and it also means a freshly migrated database has
 * no way in at all. Nobody can sign up, and nobody exists to sign in. Until
 * build-plan item 3b gives the agency a real way to provision people, this
 * is how a development database gets its first accounts.
 *
 * What it creates, once, however many times it runs:
 *
 * - admin@example.com: the platform admin, owning "Agency (dev)".
 * - owner@example.com: an ordinary owner of "Test Salon (dev)", which is
 *   the account that proves a non-admin cannot create a business.
 *
 * The addresses are fake on purpose. Login codes print to the API's
 * console in development, so no mailbox is needed, and no real person's
 * data belongs in a development database.
 *
 * It refuses to run anywhere but a local development database, and the
 * check is two conditions rather than one. A loopback host is not enough:
 * the Railway tunnel also listens on 127.0.0.1 (port 5433), so a host
 * check alone would happily seed the real database through it. The
 * database name must also end in `_dev`. Railway's is `railway`.
 *
 * Run with `npm run db:seed --workspace=@scheduleads-app/shared`. It
 * builds the package first, because the schema is imported from `dist/`
 * like every other consumer imports it. Node runs this file's TypeScript
 * directly (type stripping, Node 23.6 and later), so it adds no tool.
 */

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";
import { member, organization, user } from "@scheduleads-app/shared/db";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function assertLocalDevelopmentDatabase(url: string | undefined): string {
  if (!url) {
    throw new Error("DATABASE_URL is not set. It is read from the root .env.");
  }

  const parsed = new URL(url);
  const database = parsed.pathname.replace(/^\//, "");

  if (!LOOPBACK.has(parsed.hostname) || !database.endsWith("_dev")) {
    throw new Error(
      `Refusing to seed ${parsed.hostname}:${parsed.port || "5432"}/${database}. ` +
        "The seed only runs against a database on this machine whose name ends in _dev. " +
        "Check which DATABASE_URL line is active in .env."
    );
  }

  return database;
}

const ACCOUNTS = [
  {
    email: "admin@example.com",
    name: "Dev Admin",
    role: "admin",
    business: { name: "Agency (dev)", slug: "agency-dev" },
  },
  {
    email: "owner@example.com",
    name: "Dev Owner",
    role: null,
    business: { name: "Test Salon (dev)", slug: "test-salon-dev" },
  },
] as const;

const database = assertLocalDevelopmentDatabase(process.env.DATABASE_URL);
const client = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
const db = drizzle(client, { schema });

try {
  await db.transaction(async (tx) => {
    for (const account of ACCOUNTS) {
      const [existingUser] = await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, account.email))
        .limit(1);

      const userId = existingUser?.id ?? randomUUID();
      if (!existingUser) {
        await tx.insert(user).values({
          id: userId,
          name: account.name,
          email: account.email,
          emailVerified: true,
          role: account.role,
        });
      }

      const [existingOrg] = await tx
        .select({ id: organization.id })
        .from(organization)
        .where(eq(organization.slug, account.business.slug))
        .limit(1);

      const organizationId = existingOrg?.id ?? randomUUID();
      if (!existingOrg) {
        // `plan` is left to its column default, `agency`, the same way a
        // business created through the app gets it.
        await tx.insert(organization).values({
          id: organizationId,
          name: account.business.name,
          slug: account.business.slug,
        });
      }

      const [existingMember] = await tx
        .select({ id: member.id })
        .from(member)
        .where(and(eq(member.userId, userId), eq(member.organizationId, organizationId)))
        .limit(1);

      if (!existingMember) {
        await tx.insert(member).values({
          id: randomUUID(),
          organizationId,
          userId,
          role: "owner",
        });
      }

      const made = [!existingUser && "account", !existingOrg && "business", !existingMember && "membership"].filter(Boolean);
      console.log(
        `${account.email.padEnd(20)} ${account.role === "admin" ? "platform admin" : "ordinary owner"}, ` +
          `owns "${account.business.name}"  ${made.length ? "(created " + made.join(", ") + ")" : "(already there)"}`
      );
    }
  });

  console.log(`\nSeeded ${database}. Sign in at http://localhost:3000/sign-in; codes print in the API console.`);
} finally {
  await client.end();
}
