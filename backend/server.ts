// Backend entry point: starts the API. The routes live in app.ts, so importing their type
// never starts a server.

import { serve } from "@hono/node-server";

import { readTokenKey } from "@scheduleads-app/shared/crypto";

import { app } from "./app.js";
import { appOrigin } from "./lib/auth/auth-server.js";
import { readBookingLinkKey } from "./lib/booking/read-booking-link-key.js";
import { googleOauthClient } from "./lib/calendar/google-oauth-client.js";
import { readEmailSettings } from "./lib/email/read-email-settings.js";

const port = Number(process.env.PORT ?? 3001); // 3000 is the frontend's

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

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] dashboard origin allowed with credentials: ${appOrigin}`);
});
