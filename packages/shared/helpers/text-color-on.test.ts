import { describe, expect, test } from "vitest";

import { textColorOn } from "./text-color-on.js";

describe("textColorOn", () => {
  test("a dark brand colour gets white text, a light one dark ink", () => {
    expect(textColorOn("#1d4ed8")).toBe("#ffffff"); // a deep blue
    expect(textColorOn("#0f172a")).toBe("#ffffff");
    expect(textColorOn("#facc15")).toBe("#0f172a"); // a bright yellow
    expect(textColorOn("#ffffff")).toBe("#0f172a");
  });

  test("anything that is not #rrggbb falls back to white", () => {
    expect(textColorOn("red")).toBe("#ffffff");
  });
});
