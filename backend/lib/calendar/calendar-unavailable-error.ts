// Backend: a person's calendar could not be read just now, so their free times cannot be known.
// Never read as "free": the public route answers "try again shortly". The original error is its cause.

export class CalendarUnavailableError extends Error {
  constructor(
    message = "This person's calendar cannot be read right now.",
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "CalendarUnavailableError";
  }
}
