// Booking component: the business's zone as the calendar names it, "Mountain Time": the same name
// summer and winter, unlike "MDT" and "MST".

export function formatZoneName(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    timeZoneName: "longGeneric",
  }).formatToParts(new Date());
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
}
