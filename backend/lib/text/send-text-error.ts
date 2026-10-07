// Backend: why a text was not sent, in words safe to log: Twilio's error code and status, never
// its message, which can repeat the number it was given. `retry` says whether trying again could
// change the answer (feature 8b, decision 7).

export class SendTextError extends Error {
  constructor(
    // Twilio's error code, "http_<status>" when it gave none, "unreadable_answer", "timeout",
    // "no_connection" or "no_keys"
    readonly code: string,
    readonly status: number | null,
    readonly retry: boolean,
    message: string
  ) {
    super(message);
    this.name = "SendTextError";
  }
}
