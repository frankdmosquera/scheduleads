import { describe, expect, it } from "vitest";

import { contrastRatio } from "@scheduleads-app/shared/contrast-ratio";

import { siteColourTokens } from "./site-colour-tokens.js";

const COPPER = { main: "#c0704f", mainInk: "#0f172a", background: "#f7f2ea", text: "#1c1a17" };

describe("siteColourTokens", () => {
  it("gives no tokens for a business with no colours, so the site keeps its own", () => {
    expect(siteColourTokens(null)).toEqual({});
    expect(siteColourTokens(undefined)).toEqual({});
  });

  it("gives all five tokens for a full theme", () => {
    const tokens = siteColourTokens(COPPER);
    expect(tokens["--site-main"]).toBe("#c0704f");
    expect(tokens["--site-bg"]).toBe("#f7f2ea");
    expect(tokens["--site-text"]).toBe("#1c1a17");
    expect(contrastRatio(tokens["--site-main-ink"]!, "#c0704f")).toBeGreaterThanOrEqual(4.5);
  });

  it("puts the site's own light or dark on the main colour, whichever reads better, never another", () => {
    const inks = { light: "#fffdf9", dark: "#1c1a17" };
    expect(siteColourTokens({ ...COPPER, main: "#2b2522" }, inks)["--site-main-ink"]).toBe(
      "#fffdf9"
    );
    expect(siteColourTokens({ ...COPPER, main: "#e8b04a" }, inks)["--site-main-ink"]).toBe(
      "#1c1a17"
    );
    // a site that names no inks gets plain white or black
    expect(siteColourTokens({ ...COPPER, main: "#2b2522" })["--site-main-ink"]).toBe("#ffffff");
  });

  it("writes the main colour as text that reads at 4.5 on the business's background", () => {
    const tokens = siteColourTokens({ ...COPPER, main: "#e8b04a" }); // a light gold
    expect(contrastRatio(tokens["--site-main-text"]!, "#f7f2ea")).toBeGreaterThanOrEqual(4.5);
  });

  it("checks the main colour's text against white when no background was saved", () => {
    const tokens = siteColourTokens({ ...COPPER, main: "#e8b04a", background: null });
    expect(tokens["--site-bg"]).toBeUndefined();
    expect(contrastRatio(tokens["--site-main-text"]!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("drops anything that is not a #rrggbb colour before it reaches a style attribute", () => {
    const tokens = siteColourTokens({
      main: "red; background: url(x)",
      mainInk: "#0f172a",
      background: "#f7f2ea",
      text: "#1C1A17",
    });
    expect(tokens["--site-main"]).toBeUndefined();
    expect(tokens["--site-main-text"]).toBeUndefined();
    expect(tokens["--site-text"]).toBe("#1c1a17");
  });
});
