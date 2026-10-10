import { describe, expect, it } from "vitest";

import { worstBookingProblem } from "./worst-booking-problem.js";

describe("worstBookingProblem", () => {
  it("is no problem when both calls answered", () => {
    expect(worstBookingProblem([null, null])).toBeNull();
  });

  it("offers Try again when one call could be retried, even if the other found nothing", () => {
    expect(worstBookingProblem(["nothing-to-book", "cannot-load"])).toBe("cannot-load");
    expect(worstBookingProblem(["cannot-load", "too-many-tries"])).toBe("too-many-tries");
  });

  it("is nothing to book when that is all either call found", () => {
    expect(worstBookingProblem([null, "nothing-to-book"])).toBe("nothing-to-book");
  });
});
