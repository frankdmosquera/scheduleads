import { hc } from "hono/client";
import { describe, expect, it } from "vitest";

import type { PublicAppType } from "backend/app-type";

import { fetchFreeTimes } from "./fetch-free-times.js";

// The real typed client over a fake fetch that records every address asked and answers `body`.
function clientAnswering(status: number, body: unknown) {
  const asked: string[] = [];
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: async (input: RequestInfo | URL) => {
      asked.push(String(input instanceof Request ? input.url : input));
      return new Response(JSON.stringify(body), { status });
    },
  });
  return { apiClient, asked };
}

const october = { from: "2026-10-09", to: "2026-10-31" };

describe("fetchFreeTimes", () => {
  it("asks for any available by sending no person", async () => {
    const freeTimes = {
      timezone: "America/Edmonton",
      people: [],
      startTimes: [],
      localStartTimes: [],
    };
    const { apiClient, asked } = clientAnswering(200, freeTimes);

    expect(
      await fetchFreeTimes(apiClient, "clinic-dev", "abc", { ...october, personId: null })
    ).toEqual({ state: "ok", freeTimes });
    expect(asked).toEqual([
      "https://api.example.com/public/clinic-dev/booking-links/abc/times?from=2026-10-09&to=2026-10-31",
    ]);
  });

  it("asks for one person by their id", async () => {
    const { apiClient, asked } = clientAnswering(200, {
      people: [],
      startTimes: [],
      localStartTimes: [],
    });

    await fetchFreeTimes(apiClient, "clinic-dev", "abc", { ...october, personId: "ana" });

    expect(asked[0]).toContain("&person=ana");
  });

  it("gives a calendar that cannot be read in the route's own words, apart from other faults", async () => {
    const words = "Times cannot be read right now. Try again shortly.";
    const { apiClient } = clientAnswering(503, { error: { code: "unavailable", message: words } });

    expect(
      await fetchFreeTimes(apiClient, "clinic-dev", "abc", { ...october, personId: null })
    ).toEqual({ state: "times-unreadable", message: words });
  });

  it("reads an answer without its times as a problem, never a crash", async () => {
    const { apiClient } = clientAnswering(200, { timezone: "America/Edmonton" });

    expect(
      await fetchFreeTimes(apiClient, "clinic-dev", "abc", { ...october, personId: null })
    ).toEqual({ state: "problem", problem: "cannot-load" });
  });

  it("never asks the API for a blank service", async () => {
    const { apiClient, asked } = clientAnswering(200, {});

    expect(
      await fetchFreeTimes(apiClient, "clinic-dev", " ", { ...october, personId: null })
    ).toEqual({ state: "problem", problem: "nothing-to-book" });
    expect(asked).toEqual([]);
  });
});
