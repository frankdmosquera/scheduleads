// Frontend component: one line of a contact's timeline, in plain words. Every value is shown as
// text, never as HTML.

import type { TimelineEntryType } from "@/lib/api-client/leads/fetch-lead";
import { formatLeadTime } from "@/lib/format-lead-time";

const EMAIL_LINES: Record<string, string> = {
  booking_confirmation: "Sent the booking confirmation by email",
  booking_notification: "Told the business about the booking by email",
  booking_cancellation: "Sent the cancellation by email",
  booking_cancellation_notification: "Told the business about the cancellation by email",
  booking_move: "Sent the new time by email",
  booking_move_notification: "Told the business about the new time by email",
};

const TEXT_LINES: Record<string, string> = {
  confirmation: "Texted the confirmation",
  added: "Texted the worker about the booking",
  moved: "Texted the worker about the new time",
  removed: "Texted the worker about the cancellation",
};

const OTHER_LINES: Record<string, string> = {
  later_texts_yes: "Said yes to texts",
  lead_added: "Added by hand",
  stage_changed: "Stage changed",
  email_received: "Email received",
  note: "Note",
  call: "Call",
  task: "Task",
};

// "30 minutes", "2 hours", "1 day".
function lengthOf(minutes: number): string {
  const [count, unit] =
    minutes % 1440 === 0
      ? [minutes / 1440, "day"]
      : minutes % 60 === 0
        ? [minutes / 60, "hour"]
        : [minutes, "minute"];
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function lineOf(entry: TimelineEntryType, timeZone: string | null): string {
  const time = (iso: string | null) =>
    iso ? formatLeadTime(iso, timeZone) : "a time not recorded";
  const service = (name: string | null) => name ?? "a booking";

  switch (entry.type) {
    case "booking_created":
      return `Booked ${service(entry.serviceName)} for ${time(entry.startsAt)}`;
    case "booking_moved":
      return `Moved ${service(entry.serviceName)} from ${time(entry.fromStartsAt)} to ${time(entry.toStartsAt)}`;
    case "booking_cancelled":
      return `Cancelled ${service(entry.serviceName)}`;
    case "email_sent":
      return (entry.kind && EMAIL_LINES[entry.kind]) || "Sent an email";
    case "sms_sent":
      if (entry.kind === "reminder" && entry.minutesBefore !== null)
        return `Texted a reminder ${lengthOf(entry.minutesBefore)} before`;
      return (entry.kind && TEXT_LINES[entry.kind]) || "Sent a text";
    case "other":
      return OTHER_LINES[entry.activityType] ?? entry.activityType.replace(/_/g, " ");
  }
}

export function TimelineEntryLine({
  entry,
  timeZone,
}: {
  entry: TimelineEntryType;
  timeZone: string | null;
}) {
  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border py-1 pl-4">
      <span className="text-sm text-foreground">
        {lineOf(entry, timeZone)}
        {entry.actorName ? (
          <span className="text-muted-foreground"> by {entry.actorName}</span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatLeadTime(entry.occurredAt, timeZone)}
      </span>
    </li>
  );
}
