// Backend: why a text was not sent, in words safe to log: Twilio's error code and status, never
// its message, which can repeat the number it was given. `retry` says whether trying again could
// change the answer (feature 8b, decision 7).

export class SendTextError extends Error {
  constructor(
    readonly code: string, // Twilio's error code, "timeout", "no_connection" or "no_keys"
    readonly status: number | null,
    readonly retry: boolean,
    message: string
  ) {
    super(message);
    this.name = "SendTextError";
  }
}
