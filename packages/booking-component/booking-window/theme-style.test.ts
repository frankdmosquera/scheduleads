import { describe, expect, it } from "vitest";

import { themeStyle } from "./theme-style.js";

describe("themeStyle", () => {
  it("sets nothing for a business with no colours", () => {
    expect(themeStyle(null)).toEqual({});
    expect(themeStyle(undefined)).toEqual({});
  });

  it("puts the main colour on the buttons with the ink worked out for it", () => {
    const style = themeStyle({ main: "#f5d76e", mainInk: "#0f172a", background: null, text: null });
    expect(style).toMatchObject({ "--sa-action": "#f5d76e", "--sa-action-ink": "#0f172a" });
    expect(style).not.toHaveProperty("--sa-bg"); // the window's own white stays
  });

  it("mixes the softer greys from a dark background and light text", () => {
    const style = themeStyle({ main: null, mainInk: null, background: "#1c1917", text: "#fafaf9" });
    expect(style).toMatchObject({
      "--sa-bg": "#1c1917",
      "--sa-text": "#fafaf9",
      "--sa-muted": "color-mix(in srgb, #fafaf9 68%, #1c1917)",
    });
    expect(style).not.toHaveProperty("--sa-action");
  });
});
