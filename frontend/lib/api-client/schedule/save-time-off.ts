// Frontend: time off marked on the Calendar page (feature 12b), with a choice for each booking in its
// way. A refusal that lists the bookings in the way brings them back for the owner to choose.

import type { TimeOffInputType } from "@scheduleads-app/shared/zod-validation";

import { apiNotRespondingMessage } from "@/lib/api-client/api-not-responding-message";
import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";
import type { RefusalType } from "@/lib/api-client/refusal-type";

const timeOffRoute = dashboardApiClient.schedule["time-off"];

// The bookings a refused save lists (backend/lib/schedule/find-bookings-in-the-way.ts), as JSON:
// the typed client does not carry a refusal body that differs by case, so its shape is written here.
export type BookingInTheWayType = {
  id: string;
  customerName: string;
  serviceName: string;
  startsAt: string;
  endsAt: string;
  personId: string;
  started: boolean;
  people: { id: string; name: string }[];
};

export type SaveTimeOffResultType =
  | { state: "ok" }
  | { state: "in_the_way"; message: string; bookings: BookingInTheWayType[] }
  | { state: "field"; field: string; message: string }
  | { state: "refused"; message: string; bookingId: string | null };

export async function saveTimeOff(timeOff: TimeOffInputType): Promise<SaveTimeOffResultType> {
  const response = await timeOffRoute.$post({ json: timeOff }).catch(() => null);
  if (!response) return { state: "refused", message: apiNotRespondingMessage, bookingId: null };
  if (response.status === 201) return { state: "ok" };

  const body = (await response.json().catch(() => ({}))) as RefusalType & {
    field?: string;
    bookingId?: string;
    bookings?: BookingInTheWayType[];
  };
  const message =
    body.error?.message ?? `The API answered with an unexpected status (${response.status}).`;
  if (body.bookings) return { state: "in_the_way", message, bookings: body.bookings };
  if (body.field) return { state: "field", field: body.field, message };
  return { state: "refused", message, bookingId: body.bookingId ?? null };
}
