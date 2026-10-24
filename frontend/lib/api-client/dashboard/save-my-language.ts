// Frontend: PUT /me/language, the signed-in login's own pick of the dashboard's language
// (feature 12j). Only whether it was saved matters: a refusal keeps the screen as it was.

import type { DashboardLanguageType } from "@scheduleads-app/shared/pick-dashboard-language";

import { dashboardApiClient } from "@/lib/api-client/dashboard-api-client";

export async function saveMyLanguage(language: DashboardLanguageType): Promise<boolean> {
  const response = await dashboardApiClient.me.language
    .$put({ json: { language } })
    .catch(() => null);
  return response?.ok ?? false;
}
