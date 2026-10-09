import { describe, expect, it } from "vitest";

import { groupTimesByDay } from "./group-times-by-day.js";

describe("groupTimesByDay", () => {
  it("puts each time on its date in the business's zone, not in UTC", () => {
    // 5 p.m. and 8 p.m. in Edmonton on Oct 14 are already Oct 15 in UTC.
    const days = groupTimesByDay(
      ["2026-10-14T15:30:00.000Z", "2026-10-14T23:00:00.000Z", "2026-10-15T02:00:00.000Z"],
      "America/Edmonton"
    );

    expect([...days]).toEqual([
      [
        "2026-10-14",
        ["2026-10-14T15:30:00.000Z", "2026-10-14T23:00:00.000Z", "2026-10-15T02:00:00.000Z"],
      ],
    ]);
  });

  it("keeps the days and their times in the order the API sent them", () => {
    const days = groupTimesByDay(
      ["2026-10-14T15:00:00.000Z", "2026-10-16T15:00:00.000Z", "2026-10-16T16:00:00.000Z"],
      "America/Edmonton"
    );

    expect([...days.keys()]).toEqual(["2026-10-14", "2026-10-16"]);
    expect(days.get("2026-10-16")).toHaveLength(2);
  });

  it("is empty for no times", () => {
    expect(groupTimesByDay([], "America/Edmonton").size).toBe(0);
  });
});
