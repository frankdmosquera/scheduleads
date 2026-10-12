// Only the dashboard may call with the login cookie (credentials: true). The booking
// widget on client sites gets its own CORS rule and must NEVER send the cookie, or any
// client site could act as the owner. Keep the two rules separate.

import { cors } from "hono/cors";

import { appOrigin } from "../../lib/auth/auth-server.js";

export const dashboardCorsMiddleware = cors({
  origin: appOrigin,
  allowHeaders: ["Content-Type"],
  // PUT: saving the Email sending card; DELETE: taking time off away on the Calendar (12b).
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});
