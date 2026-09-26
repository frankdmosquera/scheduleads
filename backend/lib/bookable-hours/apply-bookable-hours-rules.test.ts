import { describe, expect, test } from "vitest";

import {
  applyBookableHoursRules,
  type BusinessHoursInputType,
  type PersonHoursInputType,
} from "./apply-bookable-hours-rules.js";

const nineToFive = { startMinute: 540, endMinute: 1020 };
const tenToTwo = { startMinute: 600, endMinute: 840 };

const noonSep25InEdmonton = new Date("2026-09-25T18:00:00Z"); // Edmonton is UTC-6 in September

// The test salon: open Monday and Saturday, closed on Christmas Eve.
const salon: BusinessHoursInputType = {
  weeklyHours: { mon: [nineToFive], sat: [nineToFive] },
  dateHours: [],
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 120, // reaches Jan 23, so Christmas Eve is inside
  closedDates: ["2026-12-24"],
};

const anaOwnWeek: PersonHoursInputType = {
  weeklyHours: { tue: [nineToFive], thu: [nineToFive] },
  dateHours: [],
};

const benOnlyChristmasEve: PersonHoursInputType = {
  weeklyHours: null,
  dateHours: [{ date: "2026-12-24", windows: [tenToTwo] }],
};

describe("applyBookableHoursRules", () => {
  test("a person with their own week gets it", () => {
    const resolved = applyBookableHoursRules(salon, anaOwnWeek, noonSep25InEdmonton);

    expect(resolved.source).toBe("resource");
    expect(resolved.weeklyHours).toEqual(anaOwnWeek.weeklyHours);
  });

  test("a person with no row gets the business's week", () => {
    const resolved = applyBookableHoursRules(salon, null, noonSep25InEdmonton);

    expect(resolved.source).toBe("organization");
    expect(resolved.weeklyHours).toEqual(salon.weeklyHours);
  });

  test("a person with only a one-off date gets the business's week plus that date", () => {
    const resolved = applyBookableHoursRules(salon, benOnlyChristmasEve, noonSep25InEdmonton);

    expect(resolved.source).toBe("organization");
    expect(resolved.weeklyHours).toEqual(salon.weeklyHours);
    expect(resolved.dateHours).toEqual(benOnlyChristmasEve.dateHours);
  });

  test("a person with a row who follows the business's week keeps the business's one-off dates", () => {
    const salonOpensNov2 = {
      ...salon,
      dateHours: [{ date: "2026-11-02", windows: [nineToFive] }],
    };
    const benOct13: PersonHoursInputType = {
      weeklyHours: null, // has a row, but follows the salon's week
      dateHours: [{ date: "2026-10-13", windows: [tenToTwo] }],
    };
    const resolved = applyBookableHoursRules(salonOpensNov2, benOct13, noonSep25InEdmonton);

    expect(resolved.dateHours.map((entry) => entry.date)).toEqual(["2026-10-13", "2026-11-02"]);
  });

  test("on the same date, a person's one-off date beats the business's", () => {
    const salonOpensChristmasEve = {
      ...salon,
      dateHours: [{ date: "2026-12-24", windows: [nineToFive] }],
    };
    const resolved = applyBookableHoursRules(
      salonOpensChristmasEve,
      benOnlyChristmasEve,
      noonSep25InEdmonton
    );

    expect(resolved.dateHours).toEqual([{ date: "2026-12-24", windows: [tenToTwo] }]);
  });

  test("a business closed date is closed even for a person with their own week", () => {
    const resolved = applyBookableHoursRules(salon, anaOwnWeek, noonSep25InEdmonton);

    expect(resolved.closedDates).toEqual(["2026-12-24"]);
  });

  test("a person's one-off date opens a closed day for them only", () => {
    const forBen = applyBookableHoursRules(salon, benOnlyChristmasEve, noonSep25InEdmonton);
    const forAna = applyBookableHoursRules(salon, anaOwnWeek, noonSep25InEdmonton);

    expect(forBen.closedDates).toEqual([]);
    expect(forAna.closedDates).toEqual(["2026-12-24"]);
  });

  test("a business one-off date opens a closed day for everyone, each on their own hours", () => {
    const salonOpensChristmasEve = {
      ...salon,
      dateHours: [{ date: "2026-12-24", windows: [nineToFive] }],
    };
    const forAna = applyBookableHoursRules(salonOpensChristmasEve, anaOwnWeek, noonSep25InEdmonton);
    const forBusiness = applyBookableHoursRules(salonOpensChristmasEve, null, noonSep25InEdmonton);

    expect(forAna.closedDates).toEqual([]);
    expect(forAna.dateHours).toEqual([]); // open on her own Thursday hours, not the salon's
    expect(forBusiness.closedDates).toEqual([]);
    expect(forBusiness.dateHours).toEqual(salonOpensChristmasEve.dateHours);
  });

  test("past dates and dates beyond the horizon are dropped", () => {
    const sixtyDays = {
      ...salon,
      horizonDays: 60, // on Sep 25 the last date is Nov 24
      closedDates: ["2026-11-25", "2026-09-20", "2026-11-24", "2026-09-25"],
      dateHours: [
        { date: "2026-09-24", windows: [nineToFive] },
        { date: "2026-10-13", windows: [nineToFive] },
        { date: "2026-11-25", windows: [nineToFive] },
      ],
    };
    const resolved = applyBookableHoursRules(sixtyDays, null, noonSep25InEdmonton);

    expect(resolved.closedDates).toEqual(["2026-09-25", "2026-11-24"]); // sorted too
    expect(resolved.dateHours.map((entry) => entry.date)).toEqual(["2026-10-13"]);
  });

  test("today is the business's date, not the server's", () => {
    const lateSep25InEdmonton = new Date("2026-09-26T04:30:00Z"); // 10:30pm Sep 25 there, Sep 26 in UTC
    const sixtyDays = { ...salon, horizonDays: 60, closedDates: ["2026-09-25", "2026-11-25"] };
    const resolved = applyBookableHoursRules(sixtyDays, null, lateSep25InEdmonton);

    expect(resolved.closedDates).toEqual(["2026-09-25"]);
  });

  test("business settings always come from the business", () => {
    const resolved = applyBookableHoursRules(salon, anaOwnWeek, noonSep25InEdmonton);

    expect(resolved.timezone).toBe("America/Edmonton");
    expect(resolved.minimumNoticeMinutes).toBe(240);
    expect(resolved.horizonDays).toBe(120);
  });
});
