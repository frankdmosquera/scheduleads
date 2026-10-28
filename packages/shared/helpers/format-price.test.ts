import { describe, expect, it } from "vitest";

import { formatPrice } from "./format-price.js";

describe("formatPrice", () => {
  it("writes a whole amount with no cents", () => {
    expect(formatPrice(15000, "CAD", "en")).toBe("$150");
  });

  it("keeps the cents when there are some", () => {
    expect(formatPrice(1250, "USD", "en")).toBe("$12.50");
  });

  it("writes pesos the Spanish way", () => {
    expect(formatPrice(4500000, "COP", "es").replace(/\s/g, " ")).toBe("$ 45.000");
  });

  it("writes zero as a price, not as nothing", () => {
    expect(formatPrice(0, "CAD", "en")).toBe("$0");
  });
});
