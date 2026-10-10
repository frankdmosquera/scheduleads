// Frontend: what saving a card of hours comes back as, and a refused save read into it.

import type { RefusalType } from "@/lib/api-client/refusal-type";

// A refusal about one field carries where it is ("weeklyHours.mon.1"), to show it in place.
export type SaveHoursResultType<Answer> =
  | { state: "ok"; answer: Answer }
  | { state: "field"; field: string; message: string }
  | { state: "refused"; message: string };

export async function readSaveRefusal(response: Response): Promise<SaveHoursResultType<never>> {
  const body = (await response.json().catch(() => ({}))) as RefusalType & { field?: string };
  const message =
    body.error?.message ?? `The API answered with an unexpected status (${response.status}).`;
  if (response.status === 400 && body.field) return { state: "field", field: body.field, message };
  return { state: "refused", message };
}
