import { defineConfig } from "drizzle-kit";

/**
 * Both workspaces talk to one database, so the connection string lives at the
 * repo root rather than inside either app. Absent is fine: CI and the two
 * hosts supply real environment variables.
 */
try {
  process.loadEnvFile("../../.env");
} catch {
  // No local .env. Real environments set DATABASE_URL directly.
}

/**
 * `db:generate` diffs the schema against the migration history and needs no
 * database, so it works with DATABASE_URL unset. `db:migrate` and `db:studio`
 * do connect, and locally that means the Railway SSH tunnel on 127.0.0.1:5433
 * rather than postgres.railway.internal. When 5433 listens but every query
 * resets, kill the stale ssh.exe and reopen the tunnel.
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  /**
   * This repo keeps its own ledger. The database still carries the first
   * repo's three migrations in drizzle.__drizzle_migrations, and those stay
   * exactly where they are: its history is worth keeping readable, and
   * mixing two repos into one ledger makes both of them lie.
   */
  migrations: {
    table: "__scheduleads_app_migrations",
    schema: "drizzle",
  },
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
