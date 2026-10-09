// Frontend: pressing Disconnect on the Calendar card.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

export type DisconnectCalendarResultType =
  | {
      state: "ok";
      atProvider: InferResponseType<
        typeof dashboardApiClient.calendar.disconnect.$post,
        200
      >["atProvider"];
    }
  | { state: "refused"; message: string };

// Pressing Disconnect: the API hands the permission back and deletes the connection.
export async function disconnectCalendar(): Promise<DisconnectCalendarResultType> {
  const response = await dashboardApiClient.calendar.disconnect.$post().catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };

  if (response.status === 200) {
    return { state: "ok", atProvider: (await response.json()).atProvider };
  }

  const body = (await response.json().catch(() => ({}))) as RefusalType;
  return {
    state: "refused",
    message:
      body.error?.message ?? `The API answered with an unexpected status (${response.status}).`,
  };
}
