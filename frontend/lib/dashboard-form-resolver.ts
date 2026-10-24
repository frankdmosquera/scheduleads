// Frontend: the dashboard forms' check against the shared rules: zodResolver, with each error's message
// written in the login's language (feature 12j). The rules themselves stay one English set, the API's too.

import { zodResolver } from "@hookform/resolvers/zod";

import { inDashboardLanguage } from "@/lib/dashboard-words/message-language";

// Every { message } in the errors, however deep (a list's rows, a field's sub-fields); never its DOM ref.
function sayInDashboardLanguage(errors: unknown): void {
  if (!errors || typeof errors !== "object") return;
  for (const [key, value] of Object.entries(errors)) {
    if (key === "ref") continue;
    if (key === "message" && typeof value === "string") {
      (errors as Record<string, unknown>).message = inDashboardLanguage(value);
    } else sayInDashboardLanguage(value);
  }
}

export const dashboardFormResolver: typeof zodResolver = ((
  ...setUp: Parameters<typeof zodResolver>
) => {
  const resolve = zodResolver(...setUp);
  return async (...checked: Parameters<typeof resolve>) => {
    const result = await resolve(...checked);
    sayInDashboardLanguage(result.errors);
    return result;
  };
}) as typeof zodResolver;
