import { describe, expect, it } from "vitest";

import { businessLooksValidationSchema } from "./business-looks-validation-schema.js";

const copper = {
  name: "Copper",
  main: "#C0704F",
  background: "#f7f2ea",
  text: "#1c1a17",
  ink: "#fffdf9",
};

describe("businessLooksValidationSchema", () => {
  it("takes a business's looks, colours lower-cased", () => {
    const parsed = businessLooksValidationSchema.parse([copper]);
    expect(parsed[0]?.main).toBe("#c0704f");
  });

  it("refuses two looks by one name, whatever their case", () => {
    expect(
      businessLooksValidationSchema.safeParse([copper, { ...copper, name: "copper" }]).success
    ).toBe(false);
  });

  it("refuses text too faint on its background, and more than six looks", () => {
    expect(businessLooksValidationSchema.safeParse([{ ...copper, text: "#eeeeee" }]).success).toBe(
      false
    );
    const seven = Array.from({ length: 7 }, (_, i) => ({ ...copper, name: `Look ${i}` }));
    expect(businessLooksValidationSchema.safeParse(seven).success).toBe(false);
  });

  it("refuses a look without its button text", () => {
    const { ink: _ink, ...noInk } = copper;
    expect(businessLooksValidationSchema.safeParse([noInk]).success).toBe(false);
  });
});
