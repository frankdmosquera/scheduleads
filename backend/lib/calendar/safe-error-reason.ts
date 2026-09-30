// Backend: why a calendar call failed, in words safe to print. A database error's message
// carries the whole query and its values (the locked tokens, the Gmail), so only its
// Postgres code is kept. Our own errors name no secret.

export function safeErrorReason(error: unknown): string {
  if (error === undefined) return "no detail";
  if (!(error instanceof Error)) return "an unknown error";

  const code = (error.cause as { code?: unknown } | undefined)?.code;
  if (error.message.startsWith("Failed query")) {
    return `database error ${typeof code === "string" ? code : "(no code)"}`;
  }
  return error.message;
}
