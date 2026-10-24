// Frontend: the language the dashboard's messages are shown in, for the code that writes them outside
// React (the API client and the form checks), kept in step by DashboardWordsProvider. A message
// already on screen keeps its language until it is written again.

import { messageInLanguage } from "@scheduleads-app/shared/spanish-messages";

import type { DashboardLanguageType } from "@/lib/dashboard-words/dashboard-words-type";

let messageLanguage: DashboardLanguageType = "en";

export function setMessageLanguage(language: DashboardLanguageType): void {
  messageLanguage = language;
}

// The login's language, for a call that asks the API for words in it (the holiday names).
export function dashboardLanguage(): DashboardLanguageType {
  return messageLanguage;
}

// An API refusal, a form error or the client's own line, in the login's language.
export function inDashboardLanguage(message: string): string {
  return messageInLanguage(message, messageLanguage);
}
