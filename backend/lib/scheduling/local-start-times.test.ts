import { describe, expect, test } from "vitest";

import { localStartTimes } from "./local-start-times.js";

describe("localStartTimes", () => {
  test("names each time's date and clock time in the business's zone, not in UTC", () => {
    // 8 p.m. in Edmonton on Oct 14 is already Oct 15 in UTC.
    expect(
      localStartTimes(["2026-10-14T15:30:00.000Z", "2026-10-15T02:00:00.000Z"], "America/Edmonton")
    ).toEqual([
      {
        startsAt: "2026-10-14T15:30:00.000Z",
        date: "2026-10-14",
        time: "9:30 a.m.",
        when: "Wednesday, October 14 at 9:30 a.m. MDT",
      },
      {
        startsAt: "2026-10-15T02:00:00.000Z",
        date: "2026-10-14",
        time: "8:00 p.m.",
        when: "Wednesday, October 14 at 8:00 p.m. MDT",
      },
    ]);
  });

  test("the same instant reads on another business's own clock", () => {
    expect(localStartTimes(["2026-10-14T15:30:00.000Z"], "America/Toronto")).toEqual([
      {
        startsAt: "2026-10-14T15:30:00.000Z",
        date: "2026-10-14",
        time: "11:30 a.m.",
        when: "Wednesday, October 14 at 11:30 a.m. EDT",
      },
    ]);
  });

  test("keeps the order it was given, and is empty for no times", () => {
    const times = ["2026-10-14T15:00:00.000Z", "2026-10-14T16:00:00.000Z"];
    expect(localStartTimes(times, "America/Edmonton").map((time) => time.startsAt)).toEqual(times);
    expect(localStartTimes([], "America/Edmonton")).toEqual([]);
  });
});
