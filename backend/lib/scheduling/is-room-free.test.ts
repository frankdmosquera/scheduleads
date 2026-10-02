import { describe, expect, test } from "vitest";

import { isRoomFree } from "./is-room-free.js";

const MONDAY = "2026-10-05";
const at = (time: string) => new Date(`${MONDAY}T${time}:00Z`).getTime();
const busy = (from: string, to: string) => ({ start: new Date(at(from)), end: new Date(at(to)) });

// A 9:00 facial, 75 minutes with 15 after (Edmonton is UTC-6): the span is 15:00 to 16:30 in UTC.
const spanStart = at("15:00");
const spanEnd = at("16:30");

describe("the room rule", () => {
  test("a room with nothing on it is free", () => {
    expect(isRoomFree({ busy: [], standbyDates: [] }, MONDAY, spanStart, spanEnd)).toBe(true);
  });

  test("a room on standby that date is not free, another date it is", () => {
    const room = { busy: [], standbyDates: [MONDAY] };
    expect(isRoomFree(room, MONDAY, spanStart, spanEnd)).toBe(false);
    expect(isRoomFree(room, "2026-10-06", spanStart, spanEnd)).toBe(true);
  });

  test("a block over the appointment takes the room", () => {
    const room = { busy: [busy("15:30", "16:00")], standbyDates: [] };
    expect(isRoomFree(room, MONDAY, spanStart, spanEnd)).toBe(false);
  });

  test("a block over only the buffer after takes the room too", () => {
    const room = { busy: [busy("16:15", "16:45")], standbyDates: [] };
    expect(isRoomFree(room, MONDAY, spanStart, spanEnd)).toBe(false);
  });

  test("blocks that only touch the span leave the room free", () => {
    const room = { busy: [busy("14:00", "15:00"), busy("16:30", "17:00")], standbyDates: [] };
    expect(isRoomFree(room, MONDAY, spanStart, spanEnd)).toBe(true);
  });
});
