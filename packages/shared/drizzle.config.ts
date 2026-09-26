// Shared: drizzle-kit settings for db:generate, db:migrate and db:studio. Run from
// packages/shared only, never from backend or frontend.

import { defineConfig } from "drizzle-kit";

// The connection string lives in the repo-root .env, shared by both apps. Missing is
// fine: real environments set DATABASE_URL directly.
try {
  process.loadEnvFile("../../.env");
} catch {
  // No local .env. Real environments set DATABASE_URL directly.
}

// db:generate needs no database. db:migrate and db:studio connect to whatever .env
// names: locally scheduleads_dev; Railway only through its tunnel on 127.0.0.1:5433.
export default defineConfig({
  schema: "./db/drizzle-schema.ts",
  out: "./migrations",
  // This repo's own migration ledger. The first repo's ledger stays in the database
  // untouched; mixing the two would make both wrong.
  migrations: {
    table: "__scheduleads_app_migrations",
    schema: "drizzle",
  },
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
