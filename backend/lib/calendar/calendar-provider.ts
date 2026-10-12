// Backend: the seam. The one shape every calendar plug follows, so the rest of the app asks
// "when is this person busy?" and writes a booking into their calendar without knowing it is
// Google. Microsoft or Apple would be
// another plug of this shape, built when a client needs one.

export type BusyBlockType = { start: Date; end: Date };

export type TimeRangeType = { from: Date; to: Date };

// One booking, as it goes into the booked person's calendar. Never any attendees: the customer
// hears only from the business, never from a worker's own account.
export type CalendarEventType = {
  id: string; // ours, made from the booking: a second write can never make a second event
  title: string;
  location: string | null; // null when the service asks no address
  description: string;
  start: Date;
  end: Date;
  timezone: string; // the business's IANA zone
};

// One calendar in the person's own list (feature 12h). The main one's id is always "primary".
export type CalendarListEntryType = { id: string; name: string; isMain: boolean };

// One ticked calendar's busy blocks, kept apart because a moved booking is crossed off the main
// calendar's only: that is the one that holds its event.
export type CalendarBusyBlocksType = { calendarId: string; busy: BusyBlockType[] };

export type FreshAccessTokenType = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string | null; // null keeps the saved one
};

export type CalendarProviderType = {
  // Throws CalendarReconnectNeededError when the provider no longer accepts the permission.
  refreshAccessToken(refreshToken: string): Promise<FreshAccessTokenType>;
  // The busy blocks on each of the given calendars of the person, in the order asked. Throws on
  // any failure, one unreadable calendar included, never answers "free". Never called with none.
  findBusyBlocks(
    accessToken: string,
    range: TimeRangeType,
    calendarIds: string[]
  ): Promise<CalendarBusyBlocksType[]>;
  // The person's own calendars, the main one first. Throws on any failure.
  listCalendars(accessToken: string): Promise<CalendarListEntryType[]>;
  // Writes the event into the person's main calendar and answers its id; an event already there
  // with that id is the answer too. Throws on any other failure.
  createEvent(accessToken: string, event: CalendarEventType): Promise<string>;
  // Takes the event out of the person's main calendar; one already gone is done too. Throws on
  // any other failure.
  deleteEvent(accessToken: string, eventId: string): Promise<void>;
  // Moves a written event to a new start and end; false when it is not there (never written, or
  // deleted). Throws on any other failure.
  updateEventTime(
    accessToken: string,
    eventId: string,
    time: { start: Date; end: Date; timezone: string }
  ): Promise<boolean>;
  // Best effort: whether the provider confirmed. Never throws.
  revoke(token: string): Promise<boolean>;
};
