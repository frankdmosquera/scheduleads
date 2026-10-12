// Backend: the Calendar page's list (feature 12h): the person's calendars, each marked when it
// counts as busy, and the ticked ones no longer in their account, so they can be unticked.

import type { CalendarListEntryType } from "./calendar-provider.js";

export type CalendarChoicesType = {
  calendars: (CalendarListEntryType & { counts: boolean })[];
  missing: string[];
};

export function toCalendarChoices(
  listed: CalendarListEntryType[],
  picked: string[]
): CalendarChoicesType {
  const listedIds = new Set(listed.map((calendar) => calendar.id));
  return {
    calendars: listed.map((calendar) => ({ ...calendar, counts: picked.includes(calendar.id) })),
    missing: picked.filter((id) => !listedIds.has(id)),
  };
}
