import { describe, expect, test } from "vitest";

import { freeTimesQueryValidationSchema } from "./free-times-query-validation-schema.js";

const message = (query: Record<string, string>) =>
  freeTimesQueryValidationSchema.safeParse(query).error?.issues[0]?.message;

describe("the free times question", () => {
  test("one date, and no person for any available", () => {
    expect(freeTimesQueryValidationSchema.parse({ from: "2026-10-05", to: "2026-10-05" })).toEqual({
      from: "2026-10-05",
      to: "2026-10-05",
    });
  });

  test("31 dates, both ends included, is the most", () => {
    expect(message({ from: "2026-10-01", to: "2026-10-31" })).toBeUndefined();
    expect(message({ from: "2026-10-01", to: "2026-11-01" })).toBe("Ask for 31 dates at most.");
  });

  test("31 dates across a month end and a leap day", () => {
    expect(message({ from: "2028-02-10", to: "2028-03-11" })).toBeUndefined();
    expect(message({ from: "2028-02-10", to: "2028-03-12" })).toBe("Ask for 31 dates at most.");
  });

  test("the last date before the first is refused", () => {
    expect(message({ from: "2026-10-05", to: "2026-10-04" })).toBe(
      "The last date comes before the first."
    );
  });

  test.each([
    ["a date that does not exist", { from: "2026-02-30", to: "2026-03-01" }],
    ["a date in another format", { from: "05/10/2026", to: "2026-10-05" }],
    ["a missing date", { from: "2026-10-05" }],
  ])("%s is refused", (_name, query) => {
    expect(message(query)).toBe("Use a real date, YYYY-MM-DD.");
  });

  test("a person id with a quote is refused", () => {
    expect(message({ from: "2026-10-05", to: "2026-10-05", person: "abc'def" })).toBe(
      "That is not a person id."
    );
  });

  test("a person asked for twice is refused in the same words", () => {
    const twice = { from: "2026-10-05", to: "2026-10-05", person: ["a", "b"] };
    expect(freeTimesQueryValidationSchema.safeParse(twice).error?.issues[0]?.message).toBe(
      "That is not a person id."
    );
  });
});
