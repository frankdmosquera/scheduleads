import { describe, expect, test } from "vitest";

import { provisionClientValidationSchema } from "./provision-client-validation-schema.js";

const primo = {
  businessName: "Primo Painters",
  clientName: "Maria Lopez",
  clientEmail: "maria@primo.example",
};

describe("provisionClientValidationSchema", () => {
  test("accepts a normal entry", () => {
    expect(provisionClientValidationSchema.parse(primo)).toEqual(primo);
  });

  test("trims every field and lowercases the email", () => {
    const parsed = provisionClientValidationSchema.parse({
      businessName: "  Primo Painters ",
      clientName: " Maria Lopez  ",
      clientEmail: "  Maria@Primo.Example ",
    });
    expect(parsed).toEqual(primo);
  });

  test.each([
    ["a blank business name", { businessName: "   " }],
    ["a business name with no letters or digits", { businessName: "!! ??" }],
    ["an empty client name", { clientName: "  " }],
    ["a client name over 100 characters", { clientName: "a".repeat(101) }],
    ["a bad email", { clientEmail: "maria@" }],
    ["a missing email", { clientEmail: undefined }],
  ])("rejects %s", (_name, change) => {
    expect(provisionClientValidationSchema.safeParse({ ...primo, ...change }).success).toBe(false);
  });
});
