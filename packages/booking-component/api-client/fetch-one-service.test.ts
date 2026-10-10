import { hc } from "hono/client";
import { describe, expect, it } from "vitest";

import type { PublicAppType } from "backend/app-type";

import { fetchOneService } from "./fetch-one-service.js";

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

const theListsAnswer = { business: { name: "Clinic" }, bookingLinks: [] };

describe("fetchOneService", () => {
  it("never asks the API for a blank id: it would get the whole list instead", async () => {
    const { apiClient, asked } = clientAnswering(200, theListsAnswer);

    expect(await fetchOneService(apiClient, "clinic-dev", "")).toEqual({
      state: "problem",
      problem: "nothing-to-book",
    });
    expect(await fetchOneService(apiClient, "clinic-dev", "  ")).toMatchObject({
      problem: "nothing-to-book",
    });
    expect(asked).toEqual([]);
  });

  it("reads an answer with no service in it as a problem, never as a service", async () => {
    const { apiClient } = clientAnswering(200, theListsAnswer);

    expect(await fetchOneService(apiClient, "clinic-dev", "abc")).toEqual({
      state: "problem",
      problem: "cannot-load",
    });
  });

  it("keeps an id with a / or ? inside its own segment of the address", async () => {
    const { apiClient, asked } = clientAnswering(404, {});

    await fetchOneService(apiClient, "clinic-dev", "a/b?c");

    expect(asked).toEqual(["https://api.example.com/public/clinic-dev/booking-links/a%2Fb%3Fc"]);
  });

  it("answers the service the route sends", async () => {
    const bookingLink = { id: "abc", name: "Chemical Peel", layout: "month" };
    const availability = { timezone: "America/Edmonton", horizonDays: 60 };
    const { apiClient } = clientAnswering(200, { bookingLink, availability });

    expect(await fetchOneService(apiClient, "clinic-dev", "abc")).toEqual({
      state: "ok",
      service: bookingLink,
      availability,
    });
  });
});
