import { describe, expect, test } from "vitest";

import { addDays } from "./add-days.js";

describe("addDays", () => {
  test("crosses months and the clock change without drifting", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });

  test("goes back across a year, and a leap day counts", () => {
    expect(addDays("2027-01-02", -3)).toBe("2026-12-30");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
