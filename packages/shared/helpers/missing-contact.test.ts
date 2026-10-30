import { describe, expect, test } from "vitest";

import { missingContact } from "./missing-contact.js";

const email = "jane@example.com";
const phone = "403 555 0100";

describe("the business's contact rule", () => {
  test("an email: a phone alone is not enough, said under Email", () => {
    expect(missingContact("email", { email })).toBeNull();
    expect(missingContact("email", { phone })).toEqual({
      field: "email",
      message: "Enter an email.",
    });
  });

  test("a phone: an email alone is not enough, said under Phone", () => {
    expect(missingContact("phone", { phone })).toBeNull();
    expect(missingContact("phone", { email })).toEqual({
      field: "phone",
      message: "Enter a phone number.",
    });
  });

  test("either one: one is enough, none is refused", () => {
    expect(missingContact("either", { email })).toBeNull();
    expect(missingContact("either", { phone })).toBeNull();
    expect(missingContact("either", {})).toEqual({
      field: "email",
      message: "Enter an email or a phone number. At least one is required.",
    });
  });

  test("both: an email and a phone, the missing one said under its own box, email first", () => {
    expect(missingContact("both", { email, phone })).toBeNull();
    expect(missingContact("both", { email })).toEqual({
      field: "phone",
      message: "Enter a phone number.",
    });
    expect(missingContact("both", { phone })).toEqual({
      field: "email",
      message: "Enter an email.",
    });
    expect(missingContact("both", {})).toEqual({ field: "email", message: "Enter an email." });
  });
});
