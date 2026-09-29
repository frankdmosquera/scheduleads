// Backend: the one log line a failed calendar connect leaves, so whoever fixes it can tell
// a wrong secret from a bad token key or a database fault. Never a token or Google's code.

export function warnConnectFailed(step: string, error?: unknown): void {
  console.warn(`[calendar] connect failed at ${step}: ${safeReason(error)}`);
}

// A database error's message carries the whole query and its values (the locked tokens,
// the Gmail), so only its Postgres code is kept. Our own errors name no secret.
function safeReason(error: unknown): string {
  if (error === undefined) return "no detail";
  if (!(error instanceof Error)) return "an unknown error";

  const code = (error.cause as { code?: unknown } | undefined)?.code;
  if (error.message.startsWith("Failed query")) {
    return `database error ${typeof code === "string" ? code : "(no code)"}`;
  }
  return error.message;
}
