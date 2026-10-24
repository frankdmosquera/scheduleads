// Frontend: the language picked on the sign-in page, kept in this browser until sign-in (feature
// 12j). Signed in, it counts as the browser's own language for a login that never picked one.
// Storage can be blocked (a private window), so every read and write is allowed to fail.

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

const KEY = "booking-crm.sign-in-language";
const listeners = new Set<() => void>();

export function readSignInLanguagePick(): DashboardLanguageType | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "en" || value === "es" ? value : null;
  } catch {
    return null;
  }
}

export function saveSignInLanguagePick(language: DashboardLanguageType): void {
  try {
    window.localStorage.setItem(KEY, language);
  } catch {
    // Not kept: the page still changes, until the next visit.
  }
  for (const listener of listeners) listener();
}

export function subscribeToSignInLanguagePick(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
