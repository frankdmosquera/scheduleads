// Frontend: the Booking form page of Settings, read.

import type { InferResponseType } from "hono/client";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import {
  readSettingsResponse,
  type SettingsReadResultType,
} from "@/lib/api-client/settings/read-settings-response";

export const bookingFormRoute = dashboardApiClient.settings["booking-form"];

// The business's own questions in order, the ready-made sets, what the form requires, and whether
// this login may change them.
export type BookingFormSettingsType = InferResponseType<typeof bookingFormRoute.$get, 200>;

export async function fetchBookingForm(): Promise<SettingsReadResultType<BookingFormSettingsType>> {
  const response = await bookingFormRoute.$get().catch(() => null);
  return readSettingsResponse(response, "This business cannot change its booking form here.");
}
