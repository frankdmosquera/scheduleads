import { describe, expect, test } from "vitest";

import { ACTIVITY_TYPES } from "./activity-types.js";

describe("ACTIVITY_TYPES", () => {
  test("are the nine kinds of timeline entry, each once", () => {
    expect(ACTIVITY_TYPES).toHaveLength(9);
    expect(new Set(ACTIVITY_TYPES).size).toBe(9);
  });
});
