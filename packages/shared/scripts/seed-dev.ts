// Shared script: puts two dev accounts into an empty local database. Signup is closed,
// so without this a fresh database has no way in. Safe to run repeatedly.
// Run: npm run db:seed --workspace=@scheduleads-app/shared

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";
import { member, organization, user } from "@scheduleads-app/shared/db";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

// Two conditions, not one: the Railway tunnel ALSO listens on 127.0.0.1, so a host check
// alone would seed the real database. The name must end in _dev too (Railway's is "railway").
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

// Fake addresses on purpose: login codes print in the API console, so no mailbox is needed.
// owner@example.com is the non-admin that proves an owner cannot create a business.
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
        // plan is left to its default, "agency", as for a business created in the app.
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

      const made = [
        !existingUser && "account",
        !existingOrg && "business",
        !existingMember && "membership",
      ].filter(Boolean);
      console.log(
        `${account.email.padEnd(20)} ${account.role === "admin" ? "platform admin" : "ordinary owner"}, ` +
          `owns "${account.business.name}"  ${made.length ? "(created " + made.join(", ") + ")" : "(already there)"}`
      );
    }
  });

  console.log(
    `\nSeeded ${database}. Sign in at http://localhost:3000/sign-in; codes print in the API console.`
  );
} finally {
  await client.end();
}
