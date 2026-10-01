import { describe, expect, test } from "vitest";

import { ACTIVITY_TYPES } from "./activity-types.js";

describe("ACTIVITY_TYPES", () => {
  test("are the eight kinds of timeline entry, each once", () => {
    expect(ACTIVITY_TYPES).toHaveLength(8);
    expect(new Set(ACTIVITY_TYPES).size).toBe(8);
  });
});
