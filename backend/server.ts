// Backend entry point: starts the API. The routes live in app.ts, so importing their type
// never starts a server.

import { serve } from "@hono/node-server";

import { readTokenKey } from "@scheduleads-app/shared/crypto";

import { app } from "./app.js";
import { appOrigin } from "./lib/auth/auth-server.js";
import { readBookingLinkKey } from "./lib/booking/read-booking-link-key.js";
import { googleOauthClient } from "./lib/calendar/google-oauth-client.js";
import { readEmailSettings } from "./lib/email/read-email-settings.js";
import { startJobRunner } from "./lib/jobs/start-job-runner.js";

const port = Number(process.env.PORT ?? 3401); // 3400 is the frontend's

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid port number, received: ${process.env.PORT}`);
}

// A missing or wrong calendar setting stops the API here, not at someone's first Connect; a
// missing email setting, not at someone's first sign-in; a missing link key, not at the first
// confirmation.
readTokenKey();
readBookingLinkKey();
googleOauthClient.assertConfigured();
readEmailSettings();

// The runner first, so every job a request adds has someone to work it (decision 7).
const runner = await startJobRunner();
console.log("[jobs] runner working");

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] dashboard origin allowed with credentials: ${appOrigin}`);
});

// A deploy stops the old API with SIGTERM: no new requests, the jobs in hand finish, then exit.
// What is still waiting stays in the database for the next API's runner.
let stopping = false;
async function stop(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`[api] ${signal}: stopping`);
  server.close();
  await runner.stop(signal);
  process.exit(0);
}
process.on("SIGTERM", () => void stop("SIGTERM"));
process.on("SIGINT", () => void stop("SIGINT"));
