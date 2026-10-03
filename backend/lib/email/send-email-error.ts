// Backend: why an email was not sent, in words safe to log: Resend's error name and status,
// never its message, which can repeat the addresses it was given.

export class SendEmailError extends Error {
  constructor(
    readonly code: string, // Resend's error name, "timeout", or "no_key"
    readonly status: number | null,
    message: string
  ) {
    super(message);
    this.name = "SendEmailError";
  }
}
