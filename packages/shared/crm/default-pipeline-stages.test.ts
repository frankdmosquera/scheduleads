import { describe, expect, test } from "vitest";

import { DEFAULT_PIPELINE_STAGES } from "./default-pipeline-stages.js";

describe("DEFAULT_PIPELINE_STAGES", () => {
  test("are New, Contacted, Booked and Done, in that order", () => {
    expect(DEFAULT_PIPELINE_STAGES).toEqual(["New", "Contacted", "Booked", "Done"]);
  });

  test("never repeat a name, capitals ignored", () => {
    const lower = DEFAULT_PIPELINE_STAGES.map((name) => name.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });
});
