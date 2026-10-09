import { describe, expect, it } from "vitest";

import { createFetchWithCeiling } from "./create-fetch-with-ceiling.js";

// A fetch that answers only when its signal gives up, as a stuck API would.
const neverAnswers: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

describe("createFetchWithCeiling", () => {
  it("never sends the visitor's cookies, whatever the caller asked", async () => {
    let sent: RequestInit | undefined;
    const fetchWithCeiling = createFetchWithCeiling(1000, async (_input, init) => {
      sent = init;
      return new Response("{}");
    });

    await fetchWithCeiling("https://api.example.com/public/x", { credentials: "include" });

    expect(sent?.credentials).toBe("omit");
  });

  it("gives up once the ceiling passes, so the call ends instead of spinning", async () => {
    const fetchWithCeiling = createFetchWithCeiling(20, neverAnswers);

    await expect(fetchWithCeiling("https://api.example.com/public/x")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("still stops when the caller's own signal stops first", async () => {
    const fetchWithCeiling = createFetchWithCeiling(10_000, neverAnswers);
    const caller = new AbortController();

    const call = fetchWithCeiling("https://api.example.com/public/x", { signal: caller.signal });
    caller.abort();

    await expect(call).rejects.toMatchObject({ name: "AbortError" });
  });
});
