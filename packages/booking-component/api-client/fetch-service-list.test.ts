import { hc } from "hono/client";
import { describe, expect, it } from "vitest";

import type { PublicAppType } from "backend/app-type";

import { fetchServiceList } from "./fetch-service-list.js";

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

describe("fetchServiceList", () => {
  it("never asks the API for a blank business: the address would reach another route", async () => {
    const { apiClient, asked } = clientAnswering(200, {});

    expect(await fetchServiceList(apiClient, "")).toEqual({
      state: "problem",
      problem: "nothing-to-book",
    });
    expect(asked).toEqual([]);
  });

  it("reads an answer without the business or its list as a problem, never a crash", async () => {
    const { apiClient } = clientAnswering(200, { bookingLink: { id: "abc" } });

    expect(await fetchServiceList(apiClient, "clinic-dev")).toEqual({
      state: "problem",
      problem: "cannot-load",
    });
  });

  it("answers the business and its services", async () => {
    const business = { name: "Clinic", logo: null, phone: null, questions: [] };
    const { apiClient, asked } = clientAnswering(200, { business, bookingLinks: [] });

    expect(await fetchServiceList(apiClient, "clinic-dev")).toEqual({
      state: "ok",
      business,
      services: [],
    });
    expect(asked).toEqual(["https://api.example.com/public/clinic-dev/booking-links"]);
  });
});
