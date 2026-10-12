// Frontend: saving which of the signed-in person's calendars count as busy (feature 12h).

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { CalendarChoicesType } from "@/lib/api-client/calendar/fetch-calendar-choices";
import { readSaveRefusal, type SaveResultType } from "@/lib/api-client/settings/read-save-refusal";

export async function saveBusyCalendars(
  calendarIds: string[]
): Promise<SaveResultType<CalendarChoicesType>> {
  const response = await dashboardApiClient.calendar["busy-calendars"]
    .$put({ json: { calendarIds } })
    .catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage };
  if (response.status === 200) return { state: "ok", answer: await response.json() };
  return readSaveRefusal(response);
}
