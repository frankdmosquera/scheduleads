// The key booking emails go through (feature 25a): the agency's, live and in tests, none on the
// laptop, so the seed's made-up customers are never emailed.

import { describe, expect, test } from "vitest";

import { readAgencyBookingKey } from "./read-agency-booking-key.js";

describe("the agency's booking key", () => {
  test("live, it is RESEND_API_KEY", () => {
    expect(readAgencyBookingKey({ NODE_ENV: "production", RESEND_API_KEY: " re_live_key " })).toBe(
      "re_live_key"
    );
  });

  test("in tests, it is RESEND_API_KEY, which the tests fake", () => {
    expect(readAgencyBookingKey({ NODE_ENV: "test", RESEND_API_KEY: "re_fake" })).toBe("re_fake");
  });

  test("on the laptop there is none, so nothing is sent", () => {
    expect(readAgencyBookingKey({ RESEND_API_KEY: "re_live_key" })).toBeNull();
    expect(
      readAgencyBookingKey({ NODE_ENV: "development", RESEND_API_KEY: "re_live_key" })
    ).toBeNull();
  });
});
