// The counter behind every public limit, on a clock the test moves.

import { afterEach, describe, expect, test } from "vitest";

import { createRateLimiter } from "./create-rate-limiter.js";
import { rateLimitClock } from "./rate-limit-clock.js";

const MINUTE = 60_000;
let now = 1_000_000;
rateLimitClock.now = () => now;

afterEach(() => {
  now = 1_000_000;
});

const tries = (limiter: ReturnType<typeof createRateLimiter>, keys: string[], count: number) =>
  Array.from({ length: count }, () => limiter.take(keys));

describe("a window", () => {
  test("lets the limit through, refuses the next with the seconds left, and opens again after", () => {
    const limiter = createRateLimiter({ most: 3, windowMs: MINUTE });

    expect(tries(limiter, ["a"], 3).every((result) => result.allowed)).toBe(true);
    now += 20_000;
    expect(limiter.take(["a"])).toEqual({ allowed: false, retryAfterSeconds: 40 });

    now += 40_000; // the window's end
    expect(limiter.take(["a"])).toEqual({ allowed: true });
  });

  test("never answers less than one second", () => {
    const limiter = createRateLimiter({ most: 1, windowMs: MINUTE });
    limiter.take(["a"]);
    now += MINUTE - 1;
    expect(limiter.take(["a"])).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  test("counts each key apart", () => {
    const limiter = createRateLimiter({ most: 1, windowMs: MINUTE });
    expect(limiter.take(["a"]).allowed).toBe(true);
    expect(limiter.take(["b"]).allowed).toBe(true);
    expect(limiter.take(["a"]).allowed).toBe(false);
  });
});

describe("several keys at once", () => {
  test("a full key refuses the try and counts none of the others", () => {
    const limiter = createRateLimiter({ most: 2, windowMs: MINUTE });
    tries(limiter, ["email"], 2);

    expect(limiter.take(["email", "phone"]).allowed).toBe(false);
    // The phone was not counted by the refused try: two more still pass.
    expect(tries(limiter, ["phone"], 2).every((result) => result.allowed)).toBe(true);
  });
});

describe("giving back", () => {
  test("a try handed back frees its place in the window", () => {
    const limiter = createRateLimiter({ most: 1, windowMs: MINUTE });
    limiter.take(["a"]);
    limiter.giveBack(["a"]);
    expect(limiter.take(["a"]).allowed).toBe(true);
  });
});

describe("memory", () => {
  test("windows that are over are dropped", () => {
    const limiter = createRateLimiter({ most: 5, windowMs: MINUTE });
    limiter.take(["a"]);
    limiter.take(["b"]);
    expect(limiter.size()).toBe(2);

    now += MINUTE;
    limiter.take(["c"]);
    expect(limiter.size()).toBe(1);
  });
});
