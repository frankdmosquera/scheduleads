import { describe, expect, test } from "vitest";

import {
  applyBookableHoursRules,
  type BusinessHoursInputType,
  type PersonHoursInputType,
} from "./apply-bookable-hours-rules.js";
import { applyOpeningRules, listClosedDays } from "./apply-opening-rules.js";

const nineToFive = { startMinute: 540, endMinute: 1020 };
const eightToNoon = { startMinute: 480, endMinute: 720 };

const noonOct10InEdmonton = new Date("2026-10-10T18:00:00Z"); // Edmonton is UTC-6 in October

// Summit works Monday and Tuesday, 9:00 to 5:00, and closed Monday, November 2.
const summit: BusinessHoursInputType = {
  weeklyHours: { mon: [nineToFive], tue: [nineToFive] },
  dateHours: [],
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 60, // reaches December 9
  closedDates: ["2026-11-02"],
  holidayCountry: null,
  holidayRegion: null,
  closedHolidays: [],
};
const ANA = "ana";
const anaOwnMonday: PersonHoursInputType = { weeklyHours: { mon: [eightToNoon] }, dateHours: [] };

const closedFor = (business: BusinessHoursInputType, person: PersonHoursInputType | null) =>
  applyBookableHoursRules(business, person, noonOct10InEdmonton).closedDates;

describe("applyOpeningRules", () => {
  test("a closed day is closed for everyone", () => {
    expect(closedFor(summit, null)).toContain("2026-11-02"); // the business, and Juan, who follows it
    expect(closedFor(summit, anaOwnMonday)).toContain("2026-11-02"); // Ana, on her own week
    expect(listClosedDays(summit, new Map([[ANA, anaOwnMonday]]), noonOct10InEdmonton)).toEqual([
      { date: "2026-11-02", name: null, openedForEveryone: false, openedFor: [] },
    ]);
  });

  test("a day opened for Ana is open for her only, on her usual hours for that weekday", () => {
    const opening = applyOpeningRules(summit, anaOwnMonday, "2026-11-02", noonOct10InEdmonton);
    expect(opening).toEqual({
      ok: true,
      whose: "person",
      dateHours: [{ date: "2026-11-02", windows: [eightToNoon] }],
    });
    if (!opening.ok) return;

    const ana = { ...anaOwnMonday, dateHours: opening.dateHours };
    expect(closedFor(summit, ana)).not.toContain("2026-11-02");
    expect(applyBookableHoursRules(summit, ana, noonOct10InEdmonton).dateHours).toEqual([
      { date: "2026-11-02", windows: [eightToNoon] },
    ]);
    expect(closedFor(summit, null)).toContain("2026-11-02"); // still closed for everyone else
    expect(listClosedDays(summit, new Map([[ANA, ana]]), noonOct10InEdmonton)).toEqual([
      { date: "2026-11-02", name: null, openedForEveryone: false, openedFor: [ANA] },
    ]);

    // Opened for her, it is no longer closed for her: a second opening is refused.
    expect(applyOpeningRules(summit, ana, "2026-11-02", noonOct10InEdmonton)).toEqual({
      ok: false,
      reason: "not_closed",
    });
  });

  test("a day opened for everyone opens on the business's usual hours", () => {
    // A date the business closed simply leaves its closed dates: Monday's 9:00 to 5:00 applies.
    const opening = applyOpeningRules(summit, null, "2026-11-02", noonOct10InEdmonton);
    expect(opening).toEqual({ ok: true, whose: "business", closedDates: [], dateHours: [] });

    // A picked holiday stays picked, so it gets a one-off date on Monday's usual hours.
    const thanksgiving = {
      ...summit,
      closedDates: [],
      holidayCountry: "CA",
      holidayRegion: "AB",
      closedHolidays: ["Thanksgiving"],
    };
    const holidayOpening = applyOpeningRules(thanksgiving, null, "2026-10-12", noonOct10InEdmonton);
    expect(holidayOpening).toEqual({
      ok: true,
      whose: "business",
      closedDates: [],
      dateHours: [{ date: "2026-10-12", windows: [nineToFive] }],
    });
    if (!holidayOpening.ok || holidayOpening.whose !== "business") return;
    const opened = { ...thanksgiving, dateHours: holidayOpening.dateHours };
    expect(closedFor(opened, null)).not.toContain("2026-10-12");
    expect(closedFor(opened, anaOwnMonday)).not.toContain("2026-10-12"); // everyone, on their own hours
    expect(listClosedDays(opened, new Map(), noonOct10InEdmonton)[0]).toEqual({
      date: "2026-10-12",
      name: "Thanksgiving",
      openedForEveryone: true,
      openedFor: [],
    });
  });

  test("a closed day with no usual hours that weekday cannot be opened", () => {
    // Sunday, November 8: nobody works Sundays here.
    const sunday = { ...summit, closedDates: ["2026-11-08"] };
    expect(applyOpeningRules(sunday, null, "2026-11-08", noonOct10InEdmonton)).toEqual({
      ok: false,
      reason: "no_usual_hours",
    });

    // Tuesday, November 3: the business works it, but Ana's own week has no Tuesday.
    const tuesday = { ...summit, closedDates: ["2026-11-03"] };
    expect(applyOpeningRules(tuesday, anaOwnMonday, "2026-11-03", noonOct10InEdmonton)).toEqual({
      ok: false,
      reason: "no_usual_hours",
    });

    // And a day that is not closed is not opened.
    expect(applyOpeningRules(summit, null, "2026-11-09", noonOct10InEdmonton)).toEqual({
      ok: false,
      reason: "not_closed",
    });
  });
});
