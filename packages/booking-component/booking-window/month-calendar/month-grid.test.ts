import { describe, expect, it } from "vitest";

import { monthGrid } from "./month-grid.js";

describe("monthGrid", () => {
  it("starts on Monday: October 2026 begins on a Thursday, after three blanks", () => {
    const cells = monthGrid("2026-10");

    expect(cells.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(31);
  });

  it("fills the last week with blanks: October 31 2026 is a Saturday", () => {
    expect(monthGrid("2026-10").slice(-2)).toEqual(["2026-10-31", null]);
  });

  it("knows February's length, leap years included", () => {
    expect(monthGrid("2027-02").filter(Boolean)).toHaveLength(28);
    expect(monthGrid("2028-02").filter(Boolean)).toHaveLength(29);
  });

  it("needs no blank before a month that starts on Monday (June 2026)", () => {
    expect(monthGrid("2026-06")[0]).toBe("2026-06-01");
  });
});
