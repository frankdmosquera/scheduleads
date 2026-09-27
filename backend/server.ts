// Backend entry point: starts the API. The routes live in app.ts, so importing their type
// (the frontend, step 2.5) never starts a server.

import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { appOrigin } from "./lib/auth/auth-server.js";

const port = Number(process.env.PORT ?? 3001); // 3000 is the frontend's

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error(`PORT must be a valid port number, received: ${process.env.PORT}`);
}

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`);
  console.log(`[api] dashboard origin allowed with credentials: ${appOrigin}`);
});
