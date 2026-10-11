// Frontend: what saving a Settings form comes back as, and a refused save read into it.

import type { RefusalType } from "@/lib/api-client/refusal-type";

// A refusal about one field carries where it is ("weeklyHours.mon.1", "name"), to show it in place:
// a bad value (400) or a name already taken (409).
export type SaveResultType<Answer> =
  | { state: "ok"; answer: Answer }
  | { state: "field"; field: string; message: string }
  | { state: "refused"; message: string };

export async function readSaveRefusal(response: Response): Promise<SaveResultType<never>> {
  const body = (await response.json().catch(() => ({}))) as RefusalType & { field?: string };
  const message =
    body.error?.message ?? `The API answered with an unexpected status (${response.status}).`;
  if (body.field) return { state: "field", field: body.field, message };
  return { state: "refused", message };
}
