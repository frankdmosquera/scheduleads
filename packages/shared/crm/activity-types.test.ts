import { describe, expect, test } from "vitest";

import { ACTIVITY_TYPES } from "./activity-types.js";

describe("ACTIVITY_TYPES", () => {
  test("are the ten kinds of timeline entry, each once", () => {
    expect(ACTIVITY_TYPES).toHaveLength(10);
    expect(new Set(ACTIVITY_TYPES).size).toBe(10);
  });
});
