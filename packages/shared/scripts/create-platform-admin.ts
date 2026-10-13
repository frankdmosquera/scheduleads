// Shared script: makes the one platform admin login on a database that has none (10b), for the
// first sign-in on the live app. Refuses once an admin exists, so it is safe on any database.
// Run: npm run admin:create --workspace=@scheduleads-app/shared -- <email>

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";
import { databaseLabel } from "@scheduleads-app/shared/database-label";
import { createPlatformAdmin } from "@scheduleads-app/shared/platform-admin";

const email = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!email) {
  console.error("Name the admin's email: npm run admin:create -- <email>");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. It is read from the root .env.");
  process.exit(1);
}

// First, before anything is read: which database this is about to write to.
console.log(`Database: ${databaseLabel(process.env.DATABASE_URL)}`);

const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => {} });
try {
  const result = await createPlatformAdmin(drizzle(client, { schema }), email);
  if (!result.ok) {
    console.error(result.reason);
    process.exitCode = 1;
  } else {
    console.log(`Made the platform admin ${result.email}. Sign in with it to get a code.`);
  }
} finally {
  await client.end();
}
