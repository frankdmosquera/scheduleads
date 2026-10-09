import { describe, expect, it } from "vitest";

import { bookingProblemFor } from "./booking-problem-for.js";

describe("bookingProblemFor", () => {
  it("reads a business or service that is not here as nothing to book", () => {
    expect(bookingProblemFor(404)).toBe("nothing-to-book");
    expect(bookingProblemFor(400)).toBe("nothing-to-book");
  });

  it("reads the rate limit's refusal as too many tries", () => {
    expect(bookingProblemFor(429)).toBe("too-many-tries");
  });

  it("reads no answer, a timeout or a server fault as cannot load", () => {
    expect(bookingProblemFor(null)).toBe("cannot-load");
    expect(bookingProblemFor(500)).toBe("cannot-load");
    expect(bookingProblemFor(503)).toBe("cannot-load");
  });
});
