// Shared Zod schema: which of a person's calendars count as busy, as they save it on Settings >
// Calendar (feature 12h). Ids are the provider's own; the main calendar is "primary".

import { z } from "zod";

// Google's free/busy answers for at most 50 calendars in one call.
export const BUSY_CALENDARS_MAX = 50;

export const busyCalendarsValidationSchema = z
  .object({
    calendarIds: z
      .array(
        z.string("That is not a calendar.").min(1, "That is not a calendar.").max(1024),
        "That is not a list of calendars."
      )
      .max(BUSY_CALENDARS_MAX, `At most ${BUSY_CALENDARS_MAX} calendars.`)
      .refine((ids) => new Set(ids).size === ids.length, "That calendar is there twice."),
  })
  .strict();

export type BusyCalendarsType = z.infer<typeof busyCalendarsValidationSchema>;
