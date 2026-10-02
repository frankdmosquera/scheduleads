// Backend: a person's calendar could not be read just now, so their free times cannot be known.
// Never read as "free": the public route answers "try again shortly".

export class CalendarUnavailableError extends Error {
  constructor(message = "This person's calendar cannot be read right now.") {
    super(message);
    this.name = "CalendarUnavailableError";
  }
}
