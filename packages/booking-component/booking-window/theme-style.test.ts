import { describe, expect, it } from "vitest";

import { contrastRatio } from "@scheduleads-app/shared/contrast-ratio";

import { themeStyle } from "./theme-style.js";

const tokens = (style: object) => style as Record<string, string>;

describe("themeStyle", () => {
  it("sets nothing for a business with no colours", () => {
    expect(themeStyle(null)).toEqual({});
    expect(themeStyle(undefined)).toEqual({});
  });

  it("fills the buttons with the main colour, and writes it as readable text on the background", () => {
    const style = tokens(
      themeStyle({ main: "#b5838d", mainInk: "#0f172a", background: "#fbf6f2", text: "#3a2e39" })
    );
    expect(style["--sa-action"]).toBe("#b5838d");
    expect(style["--sa-action-ink"]).toBe("#0f172a");
    expect(contrastRatio(style["--sa-identity"]!, "#fbf6f2")).toBeGreaterThanOrEqual(4.5);
    // and on the free days' disc: 6% of the text mixed into the background
    expect(contrastRatio(style["--sa-identity"]!, "#efeae7")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps a light main colour readable on the window's own white and its grey disc", () => {
    const style = tokens(
      themeStyle({ main: "#f59e0b", mainInk: "#0f172a", background: null, text: null })
    );
    expect(contrastRatio(style["--sa-identity"]!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(style["--sa-identity"]!, "#f4f4f5")).toBeGreaterThanOrEqual(4.5);
    expect(style).not.toHaveProperty("--sa-bg"); // the window's own white stays
  });

  it("gives a dark background with no main colour light buttons and text, never black on black", () => {
    const style = tokens(
      themeStyle({ main: null, mainInk: null, background: "#1c1917", text: "#fafaf9" })
    );
    expect(style["--sa-action"]).toBe("#fafaf9");
    expect(contrastRatio(style["--sa-identity"]!, "#1c1917")).toBeGreaterThanOrEqual(4.5);
    expect(style["--sa-muted"]).toBe("color-mix(in srgb, #fafaf9 68%, #1c1917)");
  });
});
