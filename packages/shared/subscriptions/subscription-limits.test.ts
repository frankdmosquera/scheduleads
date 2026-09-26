import { describe, expect, test } from "vitest";
import { getSubscriptionLimits, LOCKED, subscriptionIncludes } from "./subscription-limits.js";

describe("getSubscriptionLimits", () => {
  test("the agency plan unlocks booking and the CRM", () => {
    expect(getSubscriptionLimits("agency").modules).toEqual(["booking", "crm"]);
  });

  test("an unknown plan unlocks nothing", () => {
    expect(getSubscriptionLimits("enterprise")).toBe(LOCKED);
  });

  test("a missing plan unlocks nothing", () => {
    expect(getSubscriptionLimits(null)).toBe(LOCKED);
    expect(getSubscriptionLimits(undefined)).toBe(LOCKED);
  });

  test("a plan named after a built-in is refused, not crashed on", () => {
    // `in` would walk the prototype and treat these as real plans
    expect(getSubscriptionLimits("toString")).toBe(LOCKED);
    expect(getSubscriptionLimits("constructor")).toBe(LOCKED);
  });
});

describe("subscriptionIncludes", () => {
  test("the agency plan includes the CRM", () => {
    expect(subscriptionIncludes("agency", "crm")).toBe(true);
  });

  test("an unknown plan includes no module", () => {
    expect(subscriptionIncludes("enterprise", "booking")).toBe(false);
  });
});
