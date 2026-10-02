import { describe, expect, test } from "vitest";

import type { ResolvedBookableHoursType } from "../bookable-hours/apply-bookable-hours-rules.js";
import {
  applyFreeTimesRules,
  type FreeTimesInputType,
  type FreeTimesServiceType,
} from "./apply-free-times-rules.js";

// Edmonton is UTC-6 in October: 9:00 there is 15:00Z.
const at = (time: string) => new Date(`${time}Z`);
const isoTimes = (times: Date[]) => times.map((time) => time.toISOString());
const busy = (start: string, end: string) => ({ start: at(start), end: at(end) });
const window = (startHour: number, endHour: number) => ({
  startMinute: startHour * 60,
  endMinute: endHour * 60,
});

// Friday Oct 2, 2026, 8:00 in Edmonton. Monday Oct 5 is the day most cases book.
const fridayMorning = at("2026-10-02T14:00:00");
const MONDAY = "2026-10-05";

const hours = (overrides: Partial<ResolvedBookableHoursType> = {}): ResolvedBookableHoursType => ({
  source: "organization",
  timezone: "America/Edmonton",
  weeklyHours: { mon: [window(9, 12)] },
  dateHours: [],
  minimumNoticeMinutes: 0,
  horizonDays: 60,
  closedDates: [],
  ...overrides,
});

const facial: FreeTimesServiceType = {
  durationMinutes: 75,
  bufferBeforeMinutes: 0,
  bufferAfterMinutes: 0,
  slotIntervalMinutes: null,
};

const freeTimes = (overrides: Partial<FreeTimesInputType> = {}) =>
  isoTimes(
    applyFreeTimesRules({
      hours: hours(),
      service: facial,
      busy: [],
      standbyDates: [],
      rooms: null,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
      ...overrides,
    })
  );

describe("where a start time may sit", () => {
  test("every service length from the window's start, the appointment ending inside it", () => {
    // 9:00 and 10:15; 11:30 would end at 12:45, past noon.
    expect(freeTimes()).toEqual(["2026-10-05T15:00:00.000Z", "2026-10-05T16:15:00.000Z"]);
  });

  test("the service's own step, when it has one", () => {
    const peel = { ...facial, durationMinutes: 30, slotIntervalMinutes: 15 };
    expect(
      freeTimes({ service: peel, hours: hours({ weeklyHours: { mon: [window(9, 10)] } }) })
    ).toEqual(["2026-10-05T15:00:00.000Z", "2026-10-05T15:15:00.000Z", "2026-10-05T15:30:00.000Z"]);
  });

  test("Primo's 7:30 to 8:30 window offers 7:30 with the 15 after running outside it", () => {
    const estimate = { ...facial, durationMinutes: 60, bufferAfterMinutes: 15 };
    const primo = hours({ weeklyHours: { mon: [{ startMinute: 450, endMinute: 510 }] } });
    expect(freeTimes({ service: estimate, hours: primo })).toEqual(["2026-10-05T13:30:00.000Z"]);

    // 8:30 to 8:45 taken: the buffer would run into it.
    expect(
      freeTimes({
        service: estimate,
        hours: primo,
        busy: [busy("2026-10-05T14:30:00", "2026-10-05T14:45:00")],
      })
    ).toEqual([]);
  });

  test("several windows in a day, sorted, each counted from its own start", () => {
    const split = hours({ weeklyHours: { mon: [window(13, 15), window(9, 10)] } });
    const hourLong = { ...facial, durationMinutes: 60 };
    expect(freeTimes({ service: hourLong, hours: split })).toEqual([
      "2026-10-05T15:00:00.000Z",
      "2026-10-05T19:00:00.000Z",
      "2026-10-05T20:00:00.000Z",
    ]);
  });
});

describe("busy time", () => {
  test("a booking that starts as the appointment ends does not block it", () => {
    // Ana's Monday: booked 10:15 to 11:30, so only 9:00 is left.
    expect(freeTimes({ busy: [busy("2026-10-05T16:15:00", "2026-10-05T17:30:00")] })).toEqual([
      "2026-10-05T15:00:00.000Z",
    ]);
  });

  test("the buffers are part of the busy span", () => {
    const withAfter = { ...facial, bufferAfterMinutes: 15 };
    expect(
      freeTimes({ service: withAfter, busy: [busy("2026-10-05T16:15:00", "2026-10-05T17:30:00")] })
    ).toEqual([]);

    const withBefore = { ...facial, bufferBeforeMinutes: 15 };
    // Busy until 8:50: a 9:00 start needs 8:45 clear.
    expect(
      freeTimes({ service: withBefore, busy: [busy("2026-10-05T14:00:00", "2026-10-05T14:50:00")] })
    ).toEqual(["2026-10-05T16:15:00.000Z"]);
  });

  test("busy time arriving in any order is read the same", () => {
    const blocks = [
      busy("2026-10-05T16:30:00", "2026-10-05T16:45:00"),
      busy("2026-10-05T15:00:00", "2026-10-05T15:10:00"),
    ];
    expect(freeTimes({ busy: blocks })).toEqual([]);
  });
});

describe("notice and the horizon", () => {
  test("a start with less notice than the business asks for is not offered", () => {
    // Monday 8:00 with two hours' notice: 9:00 is too soon, 10:15 is fine.
    const mondayEight = at("2026-10-05T14:00:00");
    expect(freeTimes({ now: mondayEight, hours: hours({ minimumNoticeMinutes: 120 }) })).toEqual([
      "2026-10-05T16:15:00.000Z",
    ]);
  });

  test("dates before today and past the horizon are left out", () => {
    // Today is Friday Oct 2; a 7-day horizon ends Friday Oct 9, so the Monday after is out.
    const times = freeTimes({
      hours: hours({ horizonDays: 7 }),
      fromDate: "2026-09-28",
      toDate: "2026-10-12",
    });
    expect(times).toEqual(["2026-10-05T15:00:00.000Z", "2026-10-05T16:15:00.000Z"]);
  });
});

describe("closed, one-off and standby dates", () => {
  test("a closed date offers nothing", () => {
    expect(freeTimes({ hours: hours({ closedDates: [MONDAY] }) })).toEqual([]);
  });

  test("a one-off date replaces the week's hours that day, and opens a day the week closes", () => {
    const oneOff = hours({
      dateHours: [
        { date: MONDAY, windows: [window(14, 16)] },
        { date: "2026-10-04", windows: [window(10, 12)] }, // a Sunday
      ],
    });
    expect(freeTimes({ hours: oneOff, fromDate: "2026-10-04" })).toEqual([
      "2026-10-04T16:00:00.000Z",
      "2026-10-05T20:00:00.000Z",
    ]);
  });

  test("a standby date hides the person that day only", () => {
    expect(freeTimes({ standbyDates: [MONDAY], toDate: "2026-10-12" })).toEqual([
      "2026-10-12T15:00:00.000Z",
      "2026-10-12T16:15:00.000Z",
    ]);
  });
});

describe("rooms", () => {
  const room3Taken = {
    busy: [busy("2026-10-05T15:00:00", "2026-10-05T16:15:00")],
    standbyDates: [],
  };
  const room4Free = { busy: [], standbyDates: [] };

  test("no room check offers every time the person is free", () => {
    expect(freeTimes({ rooms: null })).toHaveLength(2);
  });

  test("a room needed and none usable offers nothing", () => {
    expect(freeTimes({ rooms: [] })).toEqual([]);
  });

  test("one free room is enough", () => {
    expect(freeTimes({ rooms: [room3Taken, room4Free] })).toHaveLength(2);
  });

  test("a time with every room taken or on standby is not offered", () => {
    const room4OnStandby = { busy: [], standbyDates: [MONDAY] };
    expect(freeTimes({ rooms: [room3Taken, room4OnStandby] })).toEqual([
      "2026-10-05T16:15:00.000Z",
    ]);
  });
});

// Alberta stopped changing its clocks in 2026 (Edmonton stays UTC-6), so the changes are
// proved in Denver, the same zone that still does.
describe("clock changes in Denver", () => {
  const hourLong = { ...facial, durationMinutes: 60 };

  test("spring: the skipped hour is never offered", () => {
    // Sunday Mar 14, 2027: 2:00 jumps to 3:00. 1:00 is MST (8:00Z), 3:00 is MDT (9:00Z).
    const sunday = hours({ timezone: "America/Denver", weeklyHours: { sun: [window(1, 4)] } });
    expect(
      freeTimes({
        hours: sunday,
        service: hourLong,
        fromDate: "2027-03-14",
        toDate: "2027-03-14",
        now: at("2027-03-01T12:00:00"),
      })
    ).toEqual(["2027-03-14T08:00:00.000Z", "2027-03-14T09:00:00.000Z"]);
  });

  test("autumn: the repeated hour is offered once, at its first occurrence", () => {
    // Sunday Nov 1, 2026: 2:00 falls back to 1:00. 0:00 and 1:00 are MDT, 2:00 is MST.
    const sunday = hours({ timezone: "America/Denver", weeklyHours: { sun: [window(0, 3)] } });
    expect(
      freeTimes({ hours: sunday, service: hourLong, fromDate: "2026-11-01", toDate: "2026-11-01" })
    ).toEqual(["2026-11-01T06:00:00.000Z", "2026-11-01T07:00:00.000Z", "2026-11-01T09:00:00.000Z"]);
  });
});

describe("edges", () => {
  test("a room is checked over the buffers too, not only the appointment", () => {
    // 9:00 runs to 10:15, then 15 after; the room is taken 10:15 to 10:30.
    const withAfter = { ...facial, bufferAfterMinutes: 15 };
    const roomTakenAfter = {
      busy: [busy("2026-10-05T16:15:00", "2026-10-05T16:30:00")],
      standbyDates: [],
    };
    // Checked over the appointment alone, 9:00 would wrongly pass; 10:15 overlaps the room itself.
    expect(freeTimes({ service: withAfter, rooms: [roomTakenAfter] })).toEqual([]);
  });

  test("busy time that ends as the appointment starts does not block it", () => {
    expect(freeTimes({ busy: [busy("2026-10-05T14:00:00", "2026-10-05T15:00:00")] })).toEqual([
      "2026-10-05T15:00:00.000Z",
      "2026-10-05T16:15:00.000Z",
    ]);
  });

  test("the horizon's last date is still offered", () => {
    // From Friday Oct 2, a 3-day horizon ends on Monday Oct 5.
    expect(freeTimes({ hours: hours({ horizonDays: 3 }) })).toHaveLength(2);
  });

  test("a window running to midnight", () => {
    const lateWindow = hours({ weeklyHours: { mon: [window(22, 24)] } });
    expect(freeTimes({ hours: lateWindow, service: { ...facial, durationMinutes: 60 } })).toEqual([
      "2026-10-06T04:00:00.000Z",
      "2026-10-06T05:00:00.000Z",
    ]);
  });

  test("the spring change cannot stretch an appointment past its window", () => {
    // Denver, Mar 14, 2027: a 1:30 start lasting 60 real minutes ends at 3:30, past 3:00.
    const sunday = hours({
      timezone: "America/Denver",
      weeklyHours: { sun: [{ startMinute: 90, endMinute: 180 }] },
    });
    expect(
      freeTimes({
        hours: sunday,
        service: { ...facial, durationMinutes: 60 },
        fromDate: "2027-03-14",
        toDate: "2027-03-14",
        now: at("2027-03-01T12:00:00"),
      })
    ).toEqual([]);
  });
});

// The Simulate page's six cases (explorable-free-times.html in the build log), one test each, named
// as on the page, so what the page shows is also what the real code is proved to give.
describe("the Simulate page's cases", () => {
  const withAfter = { ...facial, bufferAfterMinutes: 15 };
  const estimate = { ...facial, durationMinutes: 60, bufferAfterMinutes: 15 };
  const primo = hours({ weeklyHours: { mon: [{ startMinute: 450, endMinute: 510 }] } });
  const anaBooked = busy("2026-10-05T16:15:00", "2026-10-05T17:30:00"); // 10:15 to 11:30

  test("Ana, a facial: 9:00", () => {
    expect(freeTimes({ busy: [anaBooked] })).toEqual(["2026-10-05T15:00:00.000Z"]);
  });

  test("Same, 15 after: no times", () => {
    expect(freeTimes({ service: withAfter, busy: [anaBooked] })).toEqual([]);
  });

  test("Primo's estimate: 7:30", () => {
    expect(freeTimes({ service: estimate, hours: primo })).toEqual(["2026-10-05T13:30:00.000Z"]);
  });

  test("Primo, 8:30 taken: no times", () => {
    const googleAtEightThirty = busy("2026-10-05T14:30:00", "2026-10-05T15:15:00"); // 8:30 to 9:15
    expect(freeTimes({ service: estimate, hours: primo, busy: [googleAtEightThirty] })).toEqual([]);
  });

  test("A peel, every 15: 9:45 and 10:00", () => {
    const peel = { ...facial, durationMinutes: 30, slotIntervalMinutes: 15 };
    const nineToTenThirty = hours({ weeklyHours: { mon: [{ startMinute: 540, endMinute: 630 }] } });
    expect(
      freeTimes({
        service: peel,
        hours: nineToTenThirty,
        busy: [busy("2026-10-05T15:15:00", "2026-10-05T15:45:00")], // 9:15 to 9:45
      })
    ).toEqual(["2026-10-05T15:45:00.000Z", "2026-10-05T16:00:00.000Z"]);
  });

  test("Too soon: 10:15", () => {
    const mondayEight = at("2026-10-05T14:00:00");
    expect(freeTimes({ now: mondayEight, hours: hours({ minimumNoticeMinutes: 120 }) })).toEqual([
      "2026-10-05T16:15:00.000Z",
    ]);
  });
});
