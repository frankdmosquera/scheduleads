// The runner's first start waits for a database still coming up (F-179), and nothing else.

import { describe, expect, test } from "vitest";

import { retryWhileDatabaseRefuses } from "./retry-while-database-refuses.js";

const refused = () => Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

// A clock that moves only when the retry sleeps, so the test never waits.
function fakeClock() {
  let time = 0;
  return { now: () => time, sleep: async (ms: number) => void (time += ms) };
}

describe("the runner's first start", () => {
  test("retries while Postgres refuses, then starts", async () => {
    let tries = 0;
    const started = await retryWhileDatabaseRefuses(
      async () => {
        tries += 1;
        if (tries < 3) throw refused();
        return "runner";
      },
      { limitMs: 60_000, waitMs: 2_000, ...fakeClock() }
    );
    expect(started).toBe("runner");
    expect(tries).toBe(3);
  });

  test("also waits through 'starting up' and a refusal on every address", async () => {
    let tries = 0;
    await retryWhileDatabaseRefuses(
      async () => {
        tries += 1;
        if (tries === 1) throw Object.assign(new Error("starting up"), { code: "57P03" });
        if (tries === 2) throw new AggregateError([refused(), refused()]);
        return "runner";
      },
      { limitMs: 60_000, waitMs: 2_000, ...fakeClock() }
    );
    expect(tries).toBe(3);
  });

  test("gives up after its limit with the database's own error", async () => {
    let tries = 0;
    const start = retryWhileDatabaseRefuses(
      async () => {
        tries += 1;
        throw refused();
      },
      { limitMs: 60_000, waitMs: 2_000, ...fakeClock() }
    );
    await expect(start).rejects.toThrow("ECONNREFUSED");
    expect(tries).toBe(31); // at 0s, then every 2s up to 60s
  });

  test("throws any other error at once", async () => {
    let tries = 0;
    const start = retryWhileDatabaseRefuses(
      async () => {
        tries += 1;
        throw Object.assign(new Error("password authentication failed"), { code: "28P01" });
      },
      { limitMs: 60_000, waitMs: 2_000, ...fakeClock() }
    );
    await expect(start).rejects.toThrow("password authentication failed");
    expect(tries).toBe(1);
  });
});
