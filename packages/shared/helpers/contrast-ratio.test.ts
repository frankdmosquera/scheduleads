import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast-ratio.js";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a colour on itself, in either order", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#b5838d", "#b5838d")).toBe(1);
  });

  it("puts a light grey on white under the 4.5 readers need", () => {
    expect(contrastRatio("#aaaaaa", "#ffffff")).toBeLessThan(4.5);
    expect(contrastRatio("#3a2e39", "#fbf6f2")).toBeGreaterThan(4.5);
  });
});
