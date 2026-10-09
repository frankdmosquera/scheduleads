// Booking component: the typed client for the public routes, and only those (PublicAppType), with
// a 10-second ceiling on every call.

import { hc } from "hono/client";

import type { PublicAppType } from "backend/app-type";

import type { BookingApiClientType } from "./booking-api-types.js";
import { createFetchWithCeiling } from "./create-fetch-with-ceiling.js";

const requestCeilingMilliseconds = 10_000;

export function createBookingApiClient(apiUrl: string): BookingApiClientType {
  return hc<PublicAppType>(apiUrl.replace(/\/+$/, ""), {
    fetch: createFetchWithCeiling(requestCeilingMilliseconds),
  });
}
