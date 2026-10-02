import { describe, expect, test } from "vitest";

import { addDays } from "./add-days.js";

describe("addDays", () => {
  test("crosses months and the clock change without drifting", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
  });
});
