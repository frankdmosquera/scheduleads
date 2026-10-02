import { describe, expect, test } from "vitest";

import { localDate } from "./local-date.js";

describe("localDate", () => {
  test("late evening in Edmonton is still that day, though UTC is on the next", () => {
    expect(localDate(new Date("2026-10-06T05:00:00Z"), "America/Edmonton")).toBe("2026-10-05");
  });
});
