// Backend: one timeline row as the lead page shows it, with only the facts its line needs. The raw
// payload never leaves the API: it can hold Twilio and Resend ids, phone numbers and a customer's
// own words.

export type TimelineEntryType = { id: string; occurredAt: string; actorName: string | null } & (
  | { type: "booking_created"; serviceName: string | null; startsAt: string | null }
  | {
      type: "booking_moved";
      serviceName: string | null;
      fromStartsAt: string | null;
      toStartsAt: string | null;
    }
  | { type: "booking_cancelled"; serviceName: string | null }
  | { type: "email_sent"; kind: string | null }
  | { type: "sms_sent"; kind: string | null; minutesBefore: number | null }
  | { type: "other"; activityType: string } // a type with no line of its own yet: its label and time
);

export type TimelineRowType = {
  id: string;
  type: string;
  payload: unknown;
  occurredAt: Date;
  actorName: string | null;
};

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

// serviceNames: booking id to its service's name, read inside the same business.
export function timelineEntryOf(
  row: TimelineRowType,
  serviceNames: Map<string, string>
): TimelineEntryType {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const base = { id: row.id, occurredAt: row.occurredAt.toISOString(), actorName: row.actorName };
  const bookingId = text(payload.bookingId);
  const serviceName = bookingId ? (serviceNames.get(bookingId) ?? null) : null;

  switch (row.type) {
    case "booking_created":
      return { ...base, type: row.type, serviceName, startsAt: text(payload.startsAt) };
    case "booking_moved":
      return {
        ...base,
        type: row.type,
        serviceName,
        fromStartsAt: text(payload.fromStartsAt),
        toStartsAt: text(payload.toStartsAt),
      };
    case "booking_cancelled":
      return { ...base, type: row.type, serviceName };
    case "email_sent":
      return { ...base, type: row.type, kind: text(payload.kind) };
    case "sms_sent":
      return {
        ...base,
        type: row.type,
        kind: text(payload.kind),
        minutesBefore: typeof payload.minutesBefore === "number" ? payload.minutesBefore : null,
      };
    default:
      return { ...base, type: "other", activityType: row.type };
  }
}
