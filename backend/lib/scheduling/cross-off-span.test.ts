import { describe, expect, test } from "vitest";

import { crossOffSpan } from "./cross-off-span.js";

const at = (time: string) => new Date(`2026-10-05T${time}:00Z`);
const block = (start: string, end: string) => ({ start: at(start), end: at(end) });
const own = block("15:00", "16:00"); // the booking being moved, 9:00 to 10:00 in Edmonton

describe("crossOffSpan", () => {
  test("the booking's own event, exactly its span, is gone", () => {
    expect(crossOffSpan([block("15:00", "16:00")], own)).toEqual([]);
  });

  test("a block reaching past it keeps the part outside, on either side", () => {
    expect(crossOffSpan([block("14:30", "16:30")], own)).toEqual([
      block("14:30", "15:00"),
      block("16:00", "16:30"),
    ]);
  });

  test("blocks that only touch it, or lie elsewhere, are kept as they are", () => {
    const others = [block("14:00", "15:00"), block("16:00", "17:00"), block("20:00", "21:00")];
    expect(crossOffSpan(others, own)).toEqual(others);
  });
});
