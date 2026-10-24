// Backend helper: the language a login's sign-in code email is written in (feature 12j): the
// login's own pick, else the language of the sign-in page that asked for the code, else English.

import { eq } from "drizzle-orm";

import { user } from "@scheduleads-app/shared/db";
import {
  browserLanguagesOf,
  pickDashboardLanguage,
  type DashboardLanguageType,
} from "@scheduleads-app/shared/pick-dashboard-language";

import { db } from "../../database.js";

export async function loginLanguageOf(
  email: string,
  acceptLanguage: string | null
): Promise<DashboardLanguageType> {
  const [login] = await db
    .select({ language: user.language })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  return pickDashboardLanguage(login?.language ?? null, browserLanguagesOf(acceptLanguage));
}
