// Frontend: the signed-in person's calendar connection, for the dashboard's Calendar card.

import type { InferResponseType } from "hono/client";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";

export type CalendarConnectionAnswerType = InferResponseType<
  typeof dashboardApiClient.calendar.connection.$get,
  200
>;

export type CalendarConnectionResultType =
  { state: "ok"; answer: CalendarConnectionAnswerType } | { state: "unreachable"; message: string };

// The signed-in person and their calendar connection, for the dashboard card. Never tokens.
export async function fetchCalendarConnection(): Promise<CalendarConnectionResultType> {
  const response = await dashboardApiClient.calendar.connection.$get().catch(() => null);
  if (!response) return { state: "unreachable", message: apiNotRespondingMessage };

  if (response.status === 200) return { state: "ok", answer: await response.json() };

  return {
    state: "unreachable",
    message: `The API answered with an unexpected status (${response.status}).`,
  };
}
