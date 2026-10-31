import { describe, expect, it } from "vitest";

import { openDaysShown } from "./open-days-shown.js";

const calendar = {
  months: ["2026-10", "2026-11"],
  openDays: ["2026-10-30", "2026-10-31", "2026-11-02"],
};
const time = (date: string) => ({
  startsAt: `${date}T16:00:00.000Z`,
  date,
  time: "10:00 a.m.",
  when: "",
});

describe("the open days a page calendar marks", () => {
  it("takes a built-in month's days, dropping those that passed since the page was built", () => {
    expect([...openDaysShown("2026-10", "2026-10-31", calendar, { state: "loading" })]).toEqual([
      "2026-10-31",
    ]);
    expect([...openDaysShown("2026-11", "2026-10-31", calendar, { state: "loading" })]).toEqual([
      "2026-11-02",
    ]);
  });

  it("takes a later month's days from its live read, none while it loads or fails", () => {
    const days = new Map([["2026-12-04", [time("2026-12-04")]]]);
    expect([...openDaysShown("2026-12", "2026-10-31", calendar, { state: "ok", days })]).toEqual([
      "2026-12-04",
    ]);
    expect(openDaysShown("2026-12", "2026-10-31", calendar, { state: "loading" }).size).toBe(0);
    expect(
      openDaysShown("2026-12", "2026-10-31", calendar, { state: "times-unreadable", message: "x" })
        .size
    ).toBe(0);
  });
});
