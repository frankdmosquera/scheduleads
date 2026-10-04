import { describe, expect, test } from "vitest";

import { telHref } from "./tel-href.js";

describe("telHref", () => {
  test("keeps every digit and a leading plus, drops the rest", () => {
    expect(telHref("(403) 555-0148")).toBe("tel:4035550148");
    expect(telHref("+1 780 555 0101")).toBe("tel:+17805550101");
    expect(telHref("403.555.0148")).toBe("tel:4035550148");
  });
});
