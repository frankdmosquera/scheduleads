// Shared: every kind of entry on a contact's timeline. The database's check on activity.type
// repeats this list; a test saves one of each, so the two cannot drift apart.

export const ACTIVITY_TYPES = [
  "booking_created",
  "stage_changed",
  "email_sent",
  "email_received",
  "note",
  "sms_sent",
  "call",
  "task",
] as const;

export type ActivityTypeType = (typeof ACTIVITY_TYPES)[number];
