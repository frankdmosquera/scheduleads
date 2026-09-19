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
      "Locally it must point at the Railway SSH tunnel on 127.0.0.1:5433, " +
      "not postgres.railway.internal. When 5433 listens but every query " +
      "resets, kill the stale ssh.exe and reopen the tunnel."
  );
}

const client = postgres(process.env.DATABASE_URL, {
  // Better Auth issues several short queries per request. A small pool is
  // plenty and keeps the tunnel from being held open by idle sockets.
  max: 10,
});

export const db = drizzle(client, { schema });
