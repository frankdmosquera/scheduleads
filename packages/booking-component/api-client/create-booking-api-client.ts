// Booking component: the typed client for the public routes, and only those (PublicAppType), with
// a 10-second time limit on every call.

import { hc } from "hono/client";

import type { PublicAppType } from "backend/app-type";

import type { BookingApiClientType } from "./booking-api-types.js";
import { fetchWithTimeLimit } from "./fetch-with-time-limit.js";

const requestTimeLimitMilliseconds = 10_000;

export function createBookingApiClient(apiUrl: string): BookingApiClientType {
  return hc<PublicAppType>(apiUrl.replace(/\/+$/, ""), {
    fetch: fetchWithTimeLimit(requestTimeLimitMilliseconds),
  });
}
