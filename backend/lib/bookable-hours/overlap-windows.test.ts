import { describe, expect, test } from "vitest";

import { overlapWindows } from "./overlap-windows.js";

const w = (startMinute: number, endMinute: number) => ({ startMinute, endMinute });

describe("overlapWindows", () => {
  test("keeps only the time both share, in order", () => {
    expect(overlapWindows([w(540, 1020)], [w(780, 1080)])).toEqual([w(780, 1020)]);
    expect(overlapWindows([w(540, 720), w(780, 1020)], [w(600, 840)])).toEqual([
      w(600, 720),
      w(780, 840),
    ]);
  });

  test("windows that only touch, or never meet, share nothing", () => {
    expect(overlapWindows([w(540, 720)], [w(720, 900)])).toEqual([]);
    expect(overlapWindows([w(540, 600)], [])).toEqual([]);
  });
});
