// Backend: today's date where the business is, not where the server is: at 11pm in Edmonton the
// server in UTC is already on tomorrow.

import { clockAsUtc } from "./clock-as-utc.js";

export function localDate(moment: Date, timezone: string): string {
  return new Date(clockAsUtc(moment.getTime(), timezone)).toISOString().slice(0, 10);
}
