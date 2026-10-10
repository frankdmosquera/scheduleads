import { describe, expect, it } from "vitest";

import { problemFromApiAnswer } from "./problem-from-api-answer.js";

describe("problemFromApiAnswer", () => {
  it("reads a business or service that is not here as nothing to book", () => {
    expect(problemFromApiAnswer(404)).toBe("nothing-to-book");
    expect(problemFromApiAnswer(400)).toBe("nothing-to-book");
  });

  it("reads the rate limit's refusal as too many tries", () => {
    expect(problemFromApiAnswer(429)).toBe("too-many-tries");
  });

  it("reads no answer, a timeout or a server fault as cannot load", () => {
    expect(problemFromApiAnswer(null)).toBe("cannot-load");
    expect(problemFromApiAnswer(500)).toBe("cannot-load");
    expect(problemFromApiAnswer(503)).toBe("cannot-load");
  });
});
