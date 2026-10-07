// Backend: a booking's time as a text says it, short and in the business's own zone: "Tue Oct 13,
// 7:30am" (feature 8b, decision 4). Built from parts, so whatever spaces the server's time library
// puts around "AM", the text stays plain characters and one piece.

export function formatTextTime(moment: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(moment);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((each) => each.type === type)?.value ?? "";
  return `${part("weekday")} ${part("month")} ${part("day")}, ${part("hour")}:${part("minute")}${part("dayPeriod").toLowerCase()}`;
}
