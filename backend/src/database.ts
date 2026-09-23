import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";

/**
 * The database pool, owned by the API.
 *
 * It lives here rather than in `packages/shared` because pooling and
 * lifetime are a property of the process, not of the schema. This is a
 * long-lived Node server, so one pool is created at boot and reused; a
 * serverless frontend would need entirely different settings, which is
 * one reason the frontend no longer talks to Postgres at all.
 */

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repo root. " +
      "In development it points at the local scheduleads_dev database on " +
      "127.0.0.1:5432; see Commands in AGENTS.md. Never postgres.railway.internal, " +
      "which only resolves inside Railway."
  );
}

const client = postgres(process.env.DATABASE_URL, {
  // Better Auth issues several short queries per request. A small pool is
  // plenty for one long-lived process.
  max: 10,
});

export const db = drizzle(client, { schema });
