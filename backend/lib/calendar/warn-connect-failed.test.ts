import { afterEach, describe, expect, test, vi } from "vitest";

import { warnConnectFailed } from "./warn-connect-failed.js";

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
afterEach(() => warn.mockClear());

describe("warnConnectFailed", () => {
  test("a database error logs only its code, never the query and its values", () => {
    const failedQuery = new Error(
      'Failed query: insert into "calendar_connection" ... params: v1.locked-tokens,ana@gmail.com',
      { cause: { code: "23505" } }
    );
    warnConnectFailed("the save", failedQuery);

    expect(warn).toHaveBeenCalledWith(
      "[calendar] connect failed at the save: database error 23505"
    );
    expect(String(warn.mock.calls[0][0])).not.toContain("v1.");
    expect(String(warn.mock.calls[0][0])).not.toContain("ana@gmail.com");
  });

  test("our own error is logged as it reads", () => {
    warnConnectFailed(
      "the code swap",
      new Error("Google refused the code swap (401 invalid_client).")
    );
    expect(warn).toHaveBeenCalledWith(
      "[calendar] connect failed at the code swap: Google refused the code swap (401 invalid_client)."
    );
  });
});
