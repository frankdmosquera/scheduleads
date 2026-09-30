// Backend: the seam. The one shape every calendar plug follows, so the rest of the app asks
// "when is this person busy?" without knowing it is Google. Microsoft or Apple would be
// another plug of this shape, built when a client needs one.

export type BusyBlockType = { start: Date; end: Date };

export type TimeRangeType = { from: Date; to: Date };

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
  // Best effort: whether the provider confirmed. Never throws.
  revoke(token: string): Promise<boolean>;
};
