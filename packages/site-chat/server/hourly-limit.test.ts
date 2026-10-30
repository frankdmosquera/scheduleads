import { describe, expect, it } from "vitest";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import { createHourlyLimit, requestAddress } from "./hourly-limit.js";

const HOUR = 60 * 60 * 1000;

describe("createHourlyLimit", () => {
  it("counts each address for an hour, then opens again", () => {
    let clock = 0;
    const perHour = CHAT_SETTINGS.requestsPerHour;
    const overLimit = createHourlyLimit(perHour, () => clock);
    const results = Array.from({ length: perHour }, () => overLimit("a"));
    expect(results.every((over) => !over)).toBe(true);
    expect(overLimit("a")).toBe(true);
    expect(overLimit("b")).toBe(false); // another address has its own count
    clock = HOUR - 60_000;
    expect(overLimit("a")).toBe(true);
    clock = HOUR + 1;
    expect(overLimit("a")).toBe(false);
  });

  it("sweeps expired addresses past a thousand, so the count never grows without end", () => {
    let clock = 0;
    const overLimit = createHourlyLimit(1, () => clock);
    for (let i = 0; i < 1001; i++) overLimit(`old${i}`);
    clock = HOUR + 1;
    overLimit("trigger");
    expect(overLimit("old0")).toBe(false);
  });
});

describe("requestAddress", () => {
  it("is the first forwarded address, or local on the laptop", () => {
    expect(requestAddress(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe(
      "203.0.113.7"
    );
    expect(requestAddress(new Headers())).toBe("local");
  });
});
