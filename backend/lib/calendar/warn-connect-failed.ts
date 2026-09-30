// Backend: the one log line a failed calendar connect leaves, so whoever fixes it can tell
// a wrong secret from a bad token key or a database fault. Never a token or Google's code.

import { safeErrorReason } from "./safe-error-reason.js";

export function warnConnectFailed(step: string, error?: unknown): void {
  console.warn(`[calendar] connect failed at ${step}: ${safeErrorReason(error)}`);
}
