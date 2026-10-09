// Shared: every kind of entry on a contact's timeline. The database's check on activity.type
// is generated from this list; a test saves one of each, so every type here is one the
// database accepts. A type removed here shows up as a change at the next db:generate.

export const ACTIVITY_TYPES = [
  "booking_created",
  "booking_cancelled",
  "booking_moved",
  "later_texts_yes",
  "stage_changed",
  "email_sent",
  "email_received",
  "note",
  "sms_sent",
  "call",
  "task",
] as const;

export type ActivityTypeType = (typeof ACTIVITY_TYPES)[number];
