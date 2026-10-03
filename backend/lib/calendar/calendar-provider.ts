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
  location: string;
  description: string;
  start: Date;
  end: Date;
  timezone: string; // the business's IANA zone
};

export type FreshAccessTokenType = {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string | null; // null keeps the saved one
};

export type CalendarProviderType = {
  // Throws CalendarReconnectNeededError when the provider no longer accepts the permission.
  refreshAccessToken(refreshToken: string): Promise<FreshAccessTokenType>;
  // The busy blocks on the person's calendar. Throws on any failure, never answers "free".
  findBusyBlocks(accessToken: string, range: TimeRangeType): Promise<BusyBlockType[]>;
  // Writes the event into the person's main calendar and answers its id; an event already there
  // with that id is the answer too. Throws on any other failure.
  createEvent(accessToken: string, event: CalendarEventType): Promise<string>;
  // Takes the event out of the person's main calendar; one already gone is done too. Throws on
  // any other failure.
  deleteEvent(accessToken: string, eventId: string): Promise<void>;
  // Best effort: whether the provider confirmed. Never throws.
  revoke(token: string): Promise<boolean>;
};
