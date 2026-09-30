// Backend: the plug for a connection's provider. Google is the only one today; another
// provider is one more entry here, behind the same seam.

import type { CalendarProviderType } from "./calendar-provider.js";
import { googleCalendarProvider } from "./google-calendar-provider.js";

const PROVIDERS: Record<string, CalendarProviderType> = { google: googleCalendarProvider };

export function findCalendarProvider(provider: string): CalendarProviderType {
  const plug = PROVIDERS[provider];
  if (!plug) throw new Error(`No calendar plug for "${provider}".`);
  return plug;
}
