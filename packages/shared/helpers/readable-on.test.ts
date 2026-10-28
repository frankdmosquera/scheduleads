import { describe, expect, it } from "vitest";

import { contrastRatio } from "./contrast-ratio.js";
import { readableOn } from "./readable-on.js";

describe("readableOn", () => {
  it("keeps a colour that already reads", () => {
    expect(readableOn("#1d4ed8", "#ffffff")).toBe("#1d4ed8");
  });

  it("darkens Rose clay on its own background until it reads at 4.5", () => {
    const shade = readableOn("#b5838d", "#fbf6f2");
    expect(shade).not.toBe("#b5838d");
    expect(contrastRatio(shade, "#fbf6f2")).toBeGreaterThanOrEqual(4.5);
  });

  it("lightens a dark colour on a dark background", () => {
    const shade = readableOn("#6d3b74", "#1c1917");
    expect(contrastRatio(shade, "#1c1917")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(shade, "#ffffff")).toBeLessThan(contrastRatio("#6d3b74", "#ffffff"));
  });
});
