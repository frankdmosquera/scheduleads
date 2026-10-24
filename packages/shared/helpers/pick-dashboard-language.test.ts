import { describe, expect, test } from "vitest";

import { browserLanguagesOf, pickDashboardLanguage } from "./pick-dashboard-language.js";

describe("the dashboard's language", () => {
  test("the login's own pick wins over its browser", () => {
    expect(pickDashboardLanguage("en", ["es-CO"])).toBe("en");
    expect(pickDashboardLanguage("es", ["en-US"])).toBe("es");
  });

  test("with no pick, a Colombian browser gives Spanish", () => {
    expect(pickDashboardLanguage(null, ["es-CO", "en"])).toBe("es");
    expect(pickDashboardLanguage(null, ["ES"])).toBe("es");
  });

  test("with no pick, a French browser gives English", () => {
    expect(pickDashboardLanguage(null, ["fr-FR", "es"])).toBe("en");
  });

  test("with no pick and no browser languages, English", () => {
    expect(pickDashboardLanguage(null, [])).toBe("en");
  });
});

describe("an Accept-Language header", () => {
  test("is read as the browser's languages, in its order", () => {
    expect(browserLanguagesOf("es-CO,es;q=0.9,en;q=0.8")).toEqual(["es-CO", "es", "en"]);
  });

  test("missing or empty gives none", () => {
    expect(browserLanguagesOf(null)).toEqual([]);
    expect(browserLanguagesOf("")).toEqual([]);
  });
});
