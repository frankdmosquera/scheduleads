import { describe, expect, it } from "vitest";

import { bookingProblemScreen } from "./booking-problem-screen-state.js";

const retry = () => {};

describe("bookingProblemScreen", () => {
  it("offers no Try again when there is nothing to book: trying again cannot change that", () => {
    expect(bookingProblemScreen("nothing-to-book", null, retry)).toMatchObject({ retry: null });
  });

  it("offers Try again when the window could not load or the visitor tried too often", () => {
    expect(bookingProblemScreen("cannot-load", null, retry)).toMatchObject({ retry });
    expect(bookingProblemScreen("too-many-tries", null, retry)).toMatchObject({ retry });
  });
});
