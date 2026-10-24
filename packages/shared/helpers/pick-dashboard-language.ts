// Shared helper: which language the dashboard speaks to a login (feature 12j). Its own pick wins;
// with none, its browser's first language, Spanish when it is Spanish and English otherwise.

export type DashboardLanguageType = "en" | "es";

export function pickDashboardLanguage(
  saved: DashboardLanguageType | null,
  browserLanguages: readonly string[]
): DashboardLanguageType {
  if (saved) return saved;
  return browserLanguages[0]?.trim().toLowerCase().startsWith("es") ? "es" : "en";
}

// An Accept-Language header ("es-CO,es;q=0.9,en;q=0.8") as the browser's languages, in its order.
export function browserLanguagesOf(acceptLanguage: string | null): string[] {
  if (!acceptLanguage) return [];
  return acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim())
    .filter((tag) => tag !== "");
}
