// Who may read the public booking routes from a browser: the sites in WIDGET_ORIGINS and the
// dashboard. Never credentials, and never merged with dashboardCorsMiddleware: the login
// cookie would let a client site act as the owner.

import { cors } from "hono/cors";

import { appOrigin } from "../../lib/auth/auth-server.js";

// Comma separated in .env, e.g. "https://primopainters.com,https://www.primopainters.com".
// Empty until a client site is wired (feature 10 on).
const widgetOrigins = (process.env.WIDGET_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, "")) // a browser's Origin never ends in /
  .filter(Boolean);

export const publicCorsMiddleware = cors({
  origin: [...widgetOrigins, appOrigin], // any other site gets no Allow-Origin, so its browser blocks the read
  allowMethods: ["GET"],
  credentials: false,
});
