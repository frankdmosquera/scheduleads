import { describe, expect, test } from "vitest";

import type { BusinessHoursInputType } from "./apply-bookable-hours-rules.js";
import { applyNewlyClosedRules } from "./apply-newly-closed-rules.js";

const nineToFive = { startMinute: 540, endMinute: 1020 };
const noonOct10InEdmonton = new Date("2026-10-10T18:00:00Z"); // Edmonton is UTC-6 in October

// Summit works Monday and Tuesday, 9:00 to 5:00, and already closed Tuesday, November 3.
const summit: BusinessHoursInputType = {
  weeklyHours: { mon: [nineToFive], tue: [nineToFive] },
  dateHours: [],
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 60,
  closedDates: ["2026-11-03"],
  holidayCountry: null,
  holidayRegion: null,
  closedHolidays: [],
};

const JUAN = "juan"; // follows the business's week
const ANA = "ana"; // has Monday, November 2 opened for her

// Edmonton is UTC-7 in November.
const booking = (customer: string, personId: string, startsAt: string, status = "confirmed") => ({
  customer,
  personId,
  startsAt: new Date(startsAt),
  endsAt: new Date(new Date(startsAt).getTime() + 3_600_000),
  status,
});

describe("applyNewlyClosedRules", () => {
  test("closing a day lists its bookings, except those of someone it is opened for", () => {
    const people = new Map([
      [ANA, { weeklyHours: null, dateHours: [{ date: "2026-11-02", windows: [nineToFive] }] }],
    ]);
    const bookings = [
      booking("Maria", JUAN, "2026-11-02T17:00:00Z"), // Monday 10:00, Juan
      booking("Lee", ANA, "2026-11-02T16:00:00Z"), // Monday 9:00, Ana: opened for her
      booking("Sam", JUAN, "2026-11-02T18:00:00Z", "cancelled"),
      booking("Kim", JUAN, "2026-11-03T17:00:00Z"), // Tuesday: already closed before the save
      booking("Bo", JUAN, "2026-11-09T17:00:00Z"), // the next Monday, still open
    ];

    const after = { ...summit, closedDates: ["2026-11-02", "2026-11-03"] };
    const listed = applyNewlyClosedRules(summit, after, people, bookings, noonOct10InEdmonton);
    expect(listed.map((row) => row.customer)).toEqual(["Maria"]);

    // Nothing newly closed: nothing listed.
    expect(applyNewlyClosedRules(after, after, people, bookings, noonOct10InEdmonton)).toEqual([]);
  });
});
