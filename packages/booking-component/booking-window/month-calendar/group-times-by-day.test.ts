import { describe, expect, it } from "vitest";

import { groupTimesByDay } from "./group-times-by-day.js";

const at = (startsAt: string, date: string, time: string) => ({ startsAt, date, time });

describe("groupTimesByDay", () => {
  it("puts each time on the business's date the API sent, not its date in UTC", () => {
    // 5 p.m. and 8 p.m. in Edmonton on Oct 14 are already Oct 15 in UTC.
    const times = [
      at("2026-10-14T15:30:00.000Z", "2026-10-14", "9:30 a.m."),
      at("2026-10-14T23:00:00.000Z", "2026-10-14", "5:00 p.m."),
      at("2026-10-15T02:00:00.000Z", "2026-10-14", "8:00 p.m."),
    ];

    expect([...groupTimesByDay(times)]).toEqual([["2026-10-14", times]]);
  });

  it("keeps the API's date and clock time as sent, never re-derived with the browser's rules", () => {
    // F-279: the API keeps Edmonton on UTC-6 after Nov 1 2026, an older browser falls back to
    // UTC-7 and would read 8:00 a.m. The label shown is the one sent.
    const nine = at("2026-11-02T15:00:00.000Z", "2026-11-02", "9:00 a.m.");

    expect(groupTimesByDay([nine]).get("2026-11-02")).toEqual([nine]);
  });

  it("keeps the days and their times in the order the API sent them", () => {
    const days = groupTimesByDay([
      at("2026-10-14T15:00:00.000Z", "2026-10-14", "9:00 a.m."),
      at("2026-10-16T15:00:00.000Z", "2026-10-16", "9:00 a.m."),
      at("2026-10-16T16:00:00.000Z", "2026-10-16", "10:00 a.m."),
    ]);

    expect([...days.keys()]).toEqual(["2026-10-14", "2026-10-16"]);
    expect(days.get("2026-10-16")?.map((time) => time.time)).toEqual(["9:00 a.m.", "10:00 a.m."]);
  });

  it("is empty for no times", () => {
    expect(groupTimesByDay([]).size).toBe(0);
  });
});
