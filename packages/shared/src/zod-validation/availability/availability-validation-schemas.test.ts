import { describe, expect, test } from "vitest";

import { availabilityRuleValidationSchema } from "./availability-rule-validation-schema.js";
import { dateHoursValidationSchema } from "./date-hours-validation-schema.js";
import { weeklyHoursValidationSchema } from "./weekly-hours-validation-schema.js";

const nineToFive = { startMinute: 540, endMinute: 1020 };

const primoBusinessRow = {
  resourceId: null,
  weeklyHours: { mon: [nineToFive] },
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 60,
  closedDates: ["2026-12-25"],
  holidayCountry: "CA",
  holidayRegion: "AB",
};

describe("weeklyHoursValidationSchema", () => {
  test("accepts several windows a day, in any order, touching included", () => {
    const week = {
      mon: [
        { startMinute: 1020, endMinute: 1170 },
        { startMinute: 540, endMinute: 720 },
        { startMinute: 720, endMinute: 780 },
      ],
      sun: [],
    };
    expect(weeklyHoursValidationSchema.safeParse(week).success).toBe(true);
  });

  test("refuses two windows that overlap on the same day", () => {
    const week = { tue: [nineToFive, { startMinute: 960, endMinute: 1080 }] };
    expect(weeklyHoursValidationSchema.safeParse(week).success).toBe(false);
  });

  test("refuses a window that ends before it starts", () => {
    const week = { wed: [{ startMinute: 600, endMinute: 540 }] };
    expect(weeklyHoursValidationSchema.safeParse(week).success).toBe(false);
  });

  test("refuses a minute past the end of the day", () => {
    const week = { thu: [{ startMinute: 1400, endMinute: 1441 }] };
    expect(weeklyHoursValidationSchema.safeParse(week).success).toBe(false);
  });

  test("refuses a misspelled day instead of quietly closing it", () => {
    expect(weeklyHoursValidationSchema.safeParse({ tues: [nineToFive] }).success).toBe(false);
  });
});

describe("dateHoursValidationSchema", () => {
  test("accepts a one-off date with its windows", () => {
    const dates = [{ date: "2026-10-13", windows: [nineToFive] }];
    expect(dateHoursValidationSchema.safeParse(dates).success).toBe(true);
  });

  test("refuses the same date twice", () => {
    const dates = [
      { date: "2026-10-13", windows: [nineToFive] },
      { date: "2026-10-13", windows: [{ startMinute: 1080, endMinute: 1140 }] },
    ];
    expect(dateHoursValidationSchema.safeParse(dates).success).toBe(false);
  });

  test("refuses a date that does not exist", () => {
    const dates = [{ date: "2026-02-30", windows: [nineToFive] }];
    expect(dateHoursValidationSchema.safeParse(dates).success).toBe(false);
  });

  test("refuses a one-off date with no windows", () => {
    expect(dateHoursValidationSchema.safeParse([{ date: "2026-10-13", windows: [] }]).success).toBe(
      false
    );
  });
});

describe("availabilityRuleValidationSchema", () => {
  test("accepts Primo's business row", () => {
    expect(availabilityRuleValidationSchema.safeParse(primoBusinessRow).success).toBe(true);
  });

  test("accepts a person who follows the business's week, with one one-off date", () => {
    const juan = { resourceId: "juan", dateHours: [{ date: "2026-10-13", windows: [nineToFive] }] };
    expect(availabilityRuleValidationSchema.safeParse(juan).success).toBe(true);
  });

  test("refuses a time zone on a person's row", () => {
    const juan = { resourceId: "juan", weeklyHours: null, timezone: "Asia/Tokyo" };
    expect(availabilityRuleValidationSchema.safeParse(juan).success).toBe(false);
  });

  test("refuses a business row with no week", () => {
    const { weeklyHours: _weeklyHours, ...withoutWeek } = primoBusinessRow;
    expect(availabilityRuleValidationSchema.safeParse(withoutWeek).success).toBe(false);
  });

  test("refuses a time zone that does not exist", () => {
    const row = { ...primoBusinessRow, timezone: "America/Nowhere" };
    expect(availabilityRuleValidationSchema.safeParse(row).success).toBe(false);
  });

  test("refuses the same closed date twice", () => {
    const row = { ...primoBusinessRow, closedDates: ["2026-12-25", "2026-12-25"] };
    expect(availabilityRuleValidationSchema.safeParse(row).success).toBe(false);
  });

  test("refuses a country or province written out instead of its code", () => {
    const countryWrittenOut = { ...primoBusinessRow, holidayCountry: "Canada" };
    const provinceWrittenOut = { ...primoBusinessRow, holidayRegion: "Alberta" };
    expect(availabilityRuleValidationSchema.safeParse(countryWrittenOut).success).toBe(false);
    expect(availabilityRuleValidationSchema.safeParse(provinceWrittenOut).success).toBe(false);
  });

  test("refuses booking zero days ahead", () => {
    const row = { ...primoBusinessRow, horizonDays: 0 };
    expect(availabilityRuleValidationSchema.safeParse(row).success).toBe(false);
  });

  test("refuses negative notice", () => {
    const row = { ...primoBusinessRow, minimumNoticeMinutes: -30 };
    expect(availabilityRuleValidationSchema.safeParse(row).success).toBe(false);
  });

  test("refuses a province without its country", () => {
    const row = { ...primoBusinessRow, holidayCountry: null };
    expect(availabilityRuleValidationSchema.safeParse(row).success).toBe(false);
  });
});
