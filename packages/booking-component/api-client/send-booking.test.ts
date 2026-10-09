import { hc } from "hono/client";
import { describe, expect, it } from "vitest";

import type { PublicAppType } from "backend/app-type";

import { sendBooking } from "./send-booking.js";

// The real typed client over a fake fetch that records every request and answers `body`, or fails
// as a lost connection does when `body` is "no answer".
function clientAnswering(status: number, body: unknown) {
  const sent: { url: string; body: unknown }[] = [];
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      sent.push({ url: request.url, body: await request.clone().json() });
      if (body === "no answer") throw new TypeError("Failed to fetch");
      return new Response(JSON.stringify(body), { status });
    },
  });
  return { apiClient, sent };
}

const request = {
  bookingLinkId: "facial",
  startsAt: "2026-10-14T16:00:00.000Z",
  requestKey: "form-1",
  customer: { name: "Jane Doe", phone: "403 555 0100" },
  location: "12 Elm Street",
};
const booking = {
  id: "b1",
  startsAt: "2026-10-14T16:00:00.000Z",
  endsAt: "2026-10-14T17:00:00.000Z",
  timezone: "America/Edmonton",
  when: "Wednesday, October 14 at 10:00 a.m. MDT",
  service: { id: "facial", name: "Hydra Spa Facial" },
  person: { id: "ana", name: "Ana" },
};
const refusal = (code: string, message: string) => ({ error: { code, message } });

describe("sendBooking", () => {
  it("sends the form, its key included, to the business's booking address", async () => {
    const { apiClient, sent } = clientAnswering(201, { booking });

    expect(await sendBooking(apiClient, "clinic-dev", request)).toEqual({
      state: "booked",
      booking,
    });
    expect(sent).toEqual([
      { url: "https://api.example.com/public/clinic-dev/bookings", body: request },
    ]);
  });

  it("reads a time taken while she typed apart, in the route's own words", async () => {
    const words = "Sorry, that time was taken while you were booking. Please pick another one.";
    const { apiClient } = clientAnswering(409, refusal("time_taken", words));

    expect(await sendBooking(apiClient, "clinic-dev", request)).toEqual({
      state: "time-taken",
      message: words,
    });
  });

  it("gives a used form or a missing answer in the route's words, with no Try again", async () => {
    const used = clientAnswering(
      409,
      refusal("request_key_used", "This booking form was already used.")
    );
    const missing = clientAnswering(400, refusal("bad_request", "Answer: Which colour?"));

    expect(await sendBooking(used.apiClient, "clinic-dev", request)).toEqual({
      state: "refused",
      message: "This booking form was already used.",
      canRetry: false,
    });
    expect(await sendBooking(missing.apiClient, "clinic-dev", request)).toEqual({
      state: "refused",
      message: "Answer: Which colour?",
      canRetry: false,
    });
  });

  it("offers Try again when a calendar cannot be read, and reads the rate limit as too many tries", async () => {
    const unreadable = clientAnswering(
      503,
      refusal("unavailable", "Times cannot be read right now.")
    );
    const limited = clientAnswering(429, refusal("too_many_tries", "Too many tries."));

    expect(await sendBooking(unreadable.apiClient, "clinic-dev", request)).toEqual({
      state: "refused",
      message: "Times cannot be read right now.",
      canRetry: true,
    });
    expect(await sendBooking(limited.apiClient, "clinic-dev", request)).toEqual({
      state: "problem",
      problem: "too-many-tries",
    });
  });

  it("tells a lost connection apart: the booking may or may not have been made", async () => {
    const { apiClient } = clientAnswering(0, "no answer");

    expect(await sendBooking(apiClient, "clinic-dev", request)).toEqual({ state: "no-answer" });
  });

  it("reads a 201 without its booking as a problem, never a crash", async () => {
    const { apiClient } = clientAnswering(201, { booking: { id: "b1" } });

    expect(await sendBooking(apiClient, "clinic-dev", request)).toEqual({
      state: "problem",
      problem: "cannot-load",
    });
  });

  it("never sends for a blank business: the address would reach another route", async () => {
    const { apiClient, sent } = clientAnswering(201, { booking });

    expect(await sendBooking(apiClient, " ", request)).toEqual({
      state: "problem",
      problem: "nothing-to-book",
    });
    expect(sent).toEqual([]);
  });
});
