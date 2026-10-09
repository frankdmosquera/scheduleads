// The per-visitor limits, through the real app. The calls go to a public address no route answers:
// the middleware counts every call under /public before any route runs, so no row is read or written.

import { afterEach, describe, expect, test, vi } from "vitest";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry what the app reads.
}

const { app } = await import("../../app.js");
const { rateLimitClock } = await import("../../lib/rate-limit/rate-limit-clock.js");

const dashboardOrigin = process.env.APP_ORIGIN ?? "http://localhost:3400";
const path = "/public/rate-limit-test";

let now = 1_000_000;
rateLimitClock.now = () => now;

afterEach(() => {
  now = 1_000_000;
  vi.unstubAllEnvs();
});

const look = (headers: Record<string, string> = {}) => app.request(path, { headers });
const act = () => app.request(path, { method: "POST" });

describe("looks", () => {
  test("the 61st in a minute is refused with Retry-After, and allowed in the next minute", async () => {
    for (let count = 0; count < 60; count++) expect((await look()).status).toBe(404);

    now += 15_000;
    const refused = await look({ Origin: dashboardOrigin });
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("45");
    expect(refused.headers.get("Access-Control-Allow-Origin")).toBe(dashboardOrigin); // its page can read why
    expect(await refused.json()).toEqual({
      error: {
        code: "too_many_tries",
        message: "Too many tries. Please wait a minute and try again.",
      },
    });

    now += 45_000;
    expect((await look()).status).toBe(404);
  });
});

describe("actions", () => {
  test("the 11th in 10 minutes is refused, and looks still pass", async () => {
    for (let count = 0; count < 10; count++) expect((await act()).status).toBe(404);

    const refused = await act();
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("600");
    expect((await look()).status).toBe(404);
  });
});

describe("who the visitor is", () => {
  test("in production, Railway's X-Real-IP tells two visitors apart", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (let count = 0; count < 60; count++) await look({ "X-Real-IP": "203.0.113.1" });

    expect((await look({ "X-Real-IP": "203.0.113.1" })).status).toBe(429);
    expect((await look({ "X-Real-IP": "203.0.113.2" })).status).toBe(404);
  });

  test("anywhere else the header is ignored, so nobody can pick a new address with it", async () => {
    for (let count = 0; count < 60; count++) await look({ "X-Real-IP": "203.0.113.1" });

    expect((await look({ "X-Real-IP": "203.0.113.2" })).status).toBe(429);
  });
});
