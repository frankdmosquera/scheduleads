// Backend: the provider no longer accepts the saved permission (Google's invalid_grant:
// access removed, or Testing mode's seven days). Only a reconnect fixes it, so it is kept
// apart from a provider that is down or slow, which must not disconnect anyone.

export class CalendarReconnectNeededError extends Error {
  constructor(message = "The calendar connection needs reconnecting.") {
    super(message);
    this.name = "CalendarReconnectNeededError";
  }
}
