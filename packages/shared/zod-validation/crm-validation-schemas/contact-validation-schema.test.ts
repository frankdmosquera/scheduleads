import { describe, expect, test } from "vitest";

import { contactValidationSchema } from "./contact-validation-schema.js";

describe("contactValidationSchema", () => {
  test("accepts a name alone, or with an email and a phone", () => {
    expect(contactValidationSchema.parse({ name: "Maria" })).toEqual({ name: "Maria" });
    expect(
      contactValidationSchema.parse({
        name: "Maria",
        email: "maria@x.example",
        phone: "403 555 0101",
      })
    ).toEqual({ name: "Maria", email: "maria@x.example", phone: "403 555 0101" });
  });

  test("trims every field and lowercases the email", () => {
    expect(
      contactValidationSchema.parse({ name: " Maria ", email: " Maria@X.Example ", phone: " 555 " })
    ).toEqual({ name: "Maria", email: "maria@x.example", phone: "555" });
  });

  test.each([
    ["an empty name", { name: "  " }],
    ["a name over 120 characters", { name: "a".repeat(121) }],
    ["a bad email", { name: "Maria", email: "maria@" }],
    ["a blank phone", { name: "Maria", phone: "  " }],
    ["a phone over 40 characters", { name: "Maria", phone: "5".repeat(41) }],
  ])("rejects %s", (_name, input) => {
    expect(contactValidationSchema.safeParse(input).success).toBe(false);
  });
});
