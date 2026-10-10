// The rule that lists the bookings a save of hours leaves outside them. Each case is one on the
// feature's Simulate page, under the same name. Times are Edmonton's: MDT is UTC-6 in October.

import { describe, expect, test } from "vitest";

import { applyOutsideHoursRules, type HoursRowsType } from "./apply-outside-hours-rules.js";

const nineToFive = { startMinute: 540, endMinute: 1020 };
const nineToThree = { startMinute: 540, endMinute: 900 };
const now = new Date("2026-10-10T12:00:00Z"); // Saturday; Tuesday the 13th is still to come

const hours = (overrides: Partial<HoursRowsType>): HoursRowsType => ({
  timezone: "America/Edmonton",
  weeklyHours: { tue: [nineToFive] },
  dateHours: [],
  people: new Map(),
  ...overrides,
});

// Tuesday Oct 13, local clock times in Edmonton.
const tuesday = (from: string, to: string, personId = "ana", status = "confirmed") => ({
  personId,
  status,
  startsAt: new Date(`2026-10-13T${from}:00-06:00`),
  endsAt: new Date(`2026-10-13T${to}:00-06:00`),
});

describe("applyOutsideHoursRules", () => {
  test("a booking after the new end is listed", () => {
    const maria = tuesday("16:00", "17:00");
    const listed = applyOutsideHoursRules(
      hours({}),
      hours({ weeklyHours: { tue: [nineToThree] } }),
      [maria],
      now
    );
    expect(listed).toEqual([maria]);
  });

  test("a booking still inside is not listed", () => {
    const listed = applyOutsideHoursRules(
      hours({}),
      hours({ weeklyHours: { tue: [nineToThree] } }),
      [tuesday("10:00", "11:00")],
      now
    );
    expect(listed).toEqual([]);
  });

  test("a booking already outside before the save is not listed again", () => {
    // Tuesday was already 9 to 3 and the owner booked 4 to 5 by hand; now Tuesday becomes 9 to 2.
    const listed = applyOutsideHoursRules(
      hours({ weeklyHours: { tue: [nineToThree] } }),
      hours({ weeklyHours: { tue: [{ startMinute: 540, endMinute: 840 }] } }),
      [tuesday("16:00", "17:00")],
      now
    );
    expect(listed).toEqual([]);
  });

  test("moving the time zone lists the bookings it pushes out", () => {
    // 9:00 in Edmonton is 8:00 in Vancouver, before the same 9:00 start.
    const early = tuesday("09:00", "10:00");
    const midday = tuesday("12:00", "13:00");
    const listed = applyOutsideHoursRules(
      hours({}),
      hours({ timezone: "America/Vancouver" }),
      [early, midday],
      now
    );
    expect(listed).toEqual([early]);
  });

  test("a person's own week leaves the business's change off their bookings", () => {
    const juansWeek = new Map([
      ["juan", { weeklyHours: { tue: [{ startMinute: 480, endMinute: 1080 }] }, dateHours: [] }],
    ]);
    const juan = tuesday("16:00", "17:00", "juan");
    const ana = tuesday("16:00", "17:00", "ana"); // follows the business's week
    const listed = applyOutsideHoursRules(
      hours({ people: juansWeek }),
      hours({ weeklyHours: { tue: [nineToThree] }, people: juansWeek }),
      [juan, ana],
      now
    );
    expect(listed).toEqual([ana]);
  });

  test("a one-off date that opens the day keeps its booking off the list", () => {
    const tuesdayThe20th = [
      { date: "2026-10-20", windows: [{ startMinute: 540, endMinute: 1080 }] },
    ];
    const booking = {
      personId: "ana",
      status: "confirmed",
      startsAt: new Date("2026-10-20T16:00:00-06:00"),
      endsAt: new Date("2026-10-20T17:00:00-06:00"),
    };
    const listed = applyOutsideHoursRules(
      hours({ dateHours: tuesdayThe20th }),
      hours({ weeklyHours: { tue: [nineToThree] }, dateHours: tuesdayThe20th }),
      [booking],
      now
    );
    expect(listed).toEqual([]);
  });

  test("a booking across the spring clock change is judged on real time", () => {
    // March 8, 2026: Edmonton's clocks jump from 2:00 to 3:00, so after it MDT is UTC-6. Sunday's
    // hours go from 1:00-5:00 to 1:00-4:00. Only three real hours pass between midnight and 4:00,
    // so a minutes-since-midnight count would see 4:00-5:00 as 180-240 and wrongly keep it.
    const sunday = (from: string, to: string) => ({
      personId: "ana",
      status: "confirmed",
      startsAt: new Date(`2026-03-08T${from}:00-06:00`),
      endsAt: new Date(`2026-03-08T${to}:00-06:00`),
    });
    const fourToFive = sunday("04:00", "05:00");
    const threeToFour = sunday("03:00", "04:00");
    const listed = applyOutsideHoursRules(
      hours({ weeklyHours: { sun: [{ startMinute: 60, endMinute: 300 }] } }),
      hours({ weeklyHours: { sun: [{ startMinute: 60, endMinute: 240 }] } }),
      [fourToFive, threeToFour],
      new Date("2026-03-01T12:00:00Z")
    );
    expect(listed).toEqual([fourToFive]);
  });

  test("a cancelled or past booking is never listed", () => {
    const cancelled = tuesday("16:00", "17:00", "ana", "cancelled");
    const past = tuesday("16:00", "17:00");
    const listed = applyOutsideHoursRules(
      hours({}),
      hours({ weeklyHours: { tue: [nineToThree] } }),
      [cancelled, past],
      new Date("2026-10-14T00:00:00Z") // Tuesday the 13th is over
    );
    expect(listed).toEqual([]);
  });
});
