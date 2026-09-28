// Backend: the one Postgres connection pool, shared by every query in the API.

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@scheduleads-app/shared/db";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repo root. " +
      "In development it points at the local scheduleads_dev database on " +
      "127.0.0.1:5432; see Commands in AGENTS.md. Never postgres.railway.internal, " +
      "which only resolves inside Railway."
  );
}

// Created once at boot and reused: this is a long-lived server, not serverless.
const client = postgres(process.env.DATABASE_URL, {
  max: 10, // Better Auth runs a few short queries per request; 10 is plenty
});

export const db = drizzle(client, { schema });
