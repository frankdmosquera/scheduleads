import { describe, expect, test } from "vitest";

import { appointmentSpan } from "./appointment-span.js";

const at = (time: string) => new Date(`2026-10-05T${time}:00Z`).getTime();

describe("the span an appointment keeps busy", () => {
  test("both buffers are inside it", () => {
    const facial = { durationMinutes: 75, bufferBeforeMinutes: 10, bufferAfterMinutes: 15 };
    expect(appointmentSpan(at("15:00"), facial)).toEqual({
      spanStart: at("14:50"),
      spanEnd: at("16:30"),
    });
  });

  test("with no buffers it is the appointment itself", () => {
    const peel = { durationMinutes: 30, bufferBeforeMinutes: 0, bufferAfterMinutes: 0 };
    expect(appointmentSpan(at("15:00"), peel)).toEqual({
      spanStart: at("15:00"),
      spanEnd: at("15:30"),
    });
  });
});
