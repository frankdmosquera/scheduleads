// Frontend: the typed client for the public routes a stranger may call (the booking routes and the
// customer's own booking page). Never the login cookie: the browser would discard the answer.

import { hc } from "hono/client";

import type { AppType } from "backend/app-type";

import { API_URL } from "@/lib/auth-client";

export const publicApiClient = hc<AppType>(API_URL);
