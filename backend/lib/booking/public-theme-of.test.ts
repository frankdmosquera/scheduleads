import { describe, expect, test } from "vitest";

import { publicThemeOf } from "./public-theme-of.js";

describe("publicThemeOf", () => {
  test("no theme until the owner saved her colours", () => {
    expect(publicThemeOf(false, "#c0704f", "#f7f2ea", "#1c1a17")).toBeNull();
    expect(publicThemeOf(true, null, null, null)).toBeNull();
  });

  test("the text on the main colour is worked out for contrast", () => {
    expect(publicThemeOf(true, "#c0704f", "#f7f2ea", "#1c1a17")?.mainInk).toBe("#0f172a");
  });

  test("a look's own text on the main colour wins when one is kept (feature 25f)", () => {
    expect(publicThemeOf(true, "#c0704f", "#f7f2ea", "#1c1a17", "#fffdf9")).toEqual({
      main: "#c0704f",
      mainInk: "#fffdf9",
      background: "#f7f2ea",
      text: "#1c1a17",
    });
  });

  test("no main colour, no text on it", () => {
    expect(publicThemeOf(true, null, "#f7f2ea", "#1c1a17", "#fffdf9")?.mainInk).toBeNull();
  });
});
