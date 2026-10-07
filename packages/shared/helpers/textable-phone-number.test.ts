import { describe, expect, test } from "vitest";

import { textablePhoneNumber } from "./textable-phone-number.js";

describe("textablePhoneNumber", () => {
  test.each([
    ["(403) 555-0148", "+14035550148"],
    ["403 555 0148", "+14035550148"],
    ["403.555.0148", "+14035550148"],
    ["4035550148", "+14035550148"],
    ["1 403 555 0148", "+14035550148"],
    ["+1 (780) 555-0101", "+17805550101"],
    [" +14035550148 ", "+14035550148"],
  ])("%s is texted as %s", (typed, number) => {
    expect(textablePhoneNumber(typed)).toBe(number);
  });

  test.each([
    ["nothing", null],
    ["an empty phone", ""],
    ["only spaces", "   "],
    ["seven digits, no area code", "555-0148"],
    ["another country's code", "+44 20 7946 0958"],
    ["an area code starting 1", "103 555 0148"],
    ["an area code starting 0", "003 555 0148"],
    ["an exchange starting 1", "403 155 0148"],
    ["an extension on the end", "403 555 0148 ext 2"],
    ["eleven digits not starting 1", "24035550148"],
    ["letters", "call me"],
  ])("%s is not textable", (_, typed) => {
    expect(textablePhoneNumber(typed)).toBeNull();
  });
});
