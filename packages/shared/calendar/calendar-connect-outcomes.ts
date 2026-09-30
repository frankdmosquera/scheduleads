// Shared: the five ways a calendar connect can end. The API sends one back in ?calendar=,
// and the dashboard card has words for each, so a rename on one side fails the other's build.

export const calendarConnectOutcomes = [
  "connected",
  "denied", // pressed Cancel at Google
  "expired", // no ticket, stale, used, someone else's, or signed out
  "missing_permission", // a permission box unticked
  "failed", // Google did not answer usefully
] as const;

export type CalendarConnectOutcomeType = (typeof calendarConnectOutcomes)[number];

// Only these five: a word from the address bar such as "constructor" is not one.
export function isCalendarConnectOutcome(value: unknown): value is CalendarConnectOutcomeType {
  return calendarConnectOutcomes.some((outcome) => outcome === value);
}
