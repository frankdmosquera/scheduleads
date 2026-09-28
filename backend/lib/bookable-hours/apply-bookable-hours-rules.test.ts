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
  holidayCountry: null,
  holidayRegion: null,
  closedHolidays: [],
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

// Alberta's nine main holidays, the picker's one-click set.
const albertaMainHolidays = [
  "New Year's Day",
  "Family Day",
  "Good Friday",
  "Victoria Day",
  "Canada Day",
  "Labour Day",
  "Thanksgiving",
  "Remembrance Day",
  "Christmas Day",
];

const albertaSalon: BusinessHoursInputType = {
  ...salon,
  closedDates: [],
  holidayCountry: "CA",
  holidayRegion: "AB",
};

const noonInEdmonton = (date: string) => new Date(`${date}T19:00:00Z`); // noon, either offset

describe("holidays the owner picked", () => {
  test("nothing picked closes no holiday, only the business's own closed dates", () => {
    const resolved = applyBookableHoursRules(
      { ...albertaSalon, closedDates: ["2026-12-24"] },
      null,
      noonSep25InEdmonton
    );

    expect(resolved.closedDates).toEqual(["2026-12-24"]);
  });

  test("Family Day is the third Monday of February, even when February 1 is a Monday", () => {
    const familyDay = { ...albertaSalon, horizonDays: 60, closedHolidays: ["Family Day"] };

    expect(
      applyBookableHoursRules(familyDay, null, noonInEdmonton("2026-01-10")).closedDates
    ).toEqual(["2026-02-16"]);
    expect(
      applyBookableHoursRules(familyDay, null, noonInEdmonton("2027-01-10")).closedDates
    ).toEqual(["2027-02-15"]);
  });

  test("all nine main holidays picked close exactly nine dates in a year", () => {
    const allNine = { ...albertaSalon, horizonDays: 364, closedHolidays: albertaMainHolidays };
    const resolved = applyBookableHoursRules(allNine, null, noonInEdmonton("2026-01-01"));

    expect(resolved.closedDates).toEqual([
      "2026-01-01",
      "2026-02-16",
      "2026-04-03",
      "2026-05-18",
      "2026-07-01",
      "2026-09-07",
      "2026-10-12",
      "2026-11-11",
      "2026-12-25",
    ]);
  });

  test("a national-only holiday can be picked by an Alberta business", () => {
    const truthAndReconciliation = {
      ...albertaSalon,
      closedHolidays: ["National Day for Truth and Reconciliation"],
    };
    const resolved = applyBookableHoursRules(truthAndReconciliation, null, noonSep25InEdmonton);

    expect(resolved.closedDates).toEqual(["2026-09-30"]);
  });

  test("a holiday that is not picked stays open", () => {
    const allNine = { ...albertaSalon, horizonDays: 70, closedHolidays: albertaMainHolidays };
    const resolved = applyBookableHoursRules(allNine, null, noonInEdmonton("2026-07-01")); // to Sep 9

    expect(resolved.closedDates).toEqual(["2026-07-01", "2026-09-07"]); // Heritage Day, Aug 3, stays open
  });

  test("a one-off date on a picked holiday opens it for that person only", () => {
    const canadaDay = { ...albertaSalon, horizonDays: 60, closedHolidays: ["Canada Day"] };
    const benOnCanadaDay: PersonHoursInputType = {
      weeklyHours: null,
      dateHours: [{ date: "2026-07-01", windows: [tenToTwo] }],
    };
    const june1 = noonInEdmonton("2026-06-01");

    expect(applyBookableHoursRules(canadaDay, benOnCanadaDay, june1).closedDates).toEqual([]);
    expect(applyBookableHoursRules(canadaDay, anaOwnWeek, june1).closedDates).toEqual([
      "2026-07-01",
    ]);
  });

  test("a horizon past New Year closes the picked holidays of both years", () => {
    const winter = {
      ...albertaSalon,
      horizonDays: 60,
      closedHolidays: ["Christmas Day", "New Year's Day"],
    };
    const resolved = applyBookableHoursRules(winter, null, noonInEdmonton("2026-12-01"));

    expect(resolved.closedDates).toEqual(["2026-12-25", "2027-01-01"]);
  });

  test("a name or province the holiday list does not know is an error, not a silent skip", () => {
    const misspelled = { ...albertaSalon, closedHolidays: ["Famly Day"] };
    const unknownProvince = {
      ...albertaSalon,
      holidayRegion: "ZZ",
      closedHolidays: ["Canada Day"],
    };

    expect(() => applyBookableHoursRules(misspelled, null, noonSep25InEdmonton)).toThrow(
      /Famly Day/
    );
    expect(() => applyBookableHoursRules(unknownProvince, null, noonSep25InEdmonton)).toThrow(
      /CA-ZZ/
    );
  });
});
