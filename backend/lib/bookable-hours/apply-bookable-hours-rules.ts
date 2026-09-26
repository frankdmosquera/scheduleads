// Backend: the rules that turn a business's row and one person's row into the hours a
// customer can book. Pure, no database, so every rule is tested on its own.
// resolve-bookable-hours.ts reads the rows and hands them here.

import type { DateHoursType, WeeklyHoursType } from "@scheduleads-app/shared/zod-validation";

// The business's row, with the settings the database guarantees are set on it.
export type BusinessHoursInputType = {
  weeklyHours: WeeklyHoursType;
  dateHours: DateHoursType;
  timezone: string;
  minimumNoticeMinutes: number;
  horizonDays: number;
  closedDates: string[];
};

// A person's row: only their own week (null = follows the business's) and one-off dates.
export type PersonHoursInputType = {
  weeklyHours: WeeklyHoursType | null;
  dateHours: DateHoursType;
};

export type ResolvedBookableHoursType = {
  source: "resource" | "organization"; // whose week answered
  timezone: string;
  weeklyHours: WeeklyHoursType;
  dateHours: DateHoursType; // the one-off dates that apply, inside the horizon
  minimumNoticeMinutes: number;
  horizonDays: number;
  closedDates: string[]; // closed dates inside the horizon, minus opened ones; sorted, unique
};

// Today's date where the business is, not where the server is: at 11pm in Edmonton
// the server in UTC is already on tomorrow.
function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((datePart) => datePart.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

// Calendar arithmetic on a plain YYYY-MM-DD, done in UTC so no daylight change can shift it.
function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function applyBookableHoursRules(
  business: BusinessHoursInputType,
  person: PersonHoursInputType | null, // null = the business itself, or a person with no row
  now: Date
): ResolvedBookableHoursType {
  const firstDate = localDate(now, business.timezone);
  const lastDate = addDays(firstDate, business.horizonDays); // 60 days on Sep 25 ends Nov 24
  const insideHorizon = (date: string) => date >= firstDate && date <= lastDate; // YYYY-MM-DD sorts as text

  const hasOwnWeek = person?.weeklyHours != null;
  const personDateHours = person?.dateHours ?? [];

  // A person with their own week keeps only their own one-off dates. Anyone following the
  // business's week also gets the business's; on the same date the person's own wins.
  const personDates = new Set(personDateHours.map((entry) => entry.date));
  const dateHours = hasOwnWeek
    ? personDateHours
    : [...business.dateHours.filter((entry) => !personDates.has(entry.date)), ...personDateHours];

  // A one-off date opens a closed day: the person's for them only, the business's for
  // everyone, each on their own hours. So both lists open, whichever week applies.
  const openedDates = new Set(
    [...business.dateHours, ...personDateHours].map((entry) => entry.date)
  );
  const closedDates = [...new Set(business.closedDates)]
    .filter((date) => insideHorizon(date) && !openedDates.has(date))
    .sort();

  return {
    source: hasOwnWeek ? "resource" : "organization",
    timezone: business.timezone,
    weeklyHours: person?.weeklyHours ?? business.weeklyHours,
    dateHours: dateHours
      .filter((entry) => insideHorizon(entry.date))
      .sort((a, b) => a.date.localeCompare(b.date)),
    minimumNoticeMinutes: business.minimumNoticeMinutes,
    horizonDays: business.horizonDays,
    closedDates,
  };
}
