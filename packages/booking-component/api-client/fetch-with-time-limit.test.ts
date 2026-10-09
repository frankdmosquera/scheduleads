import { describe, expect, it } from "vitest";

import { fetchWithTimeLimit } from "./fetch-with-time-limit.js";

// A fetch that answers only when its signal gives up, as a stuck API would.
const neverAnswers: typeof fetch = (_input, init) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
  });

describe("fetchWithTimeLimit", () => {
  it("never sends the visitor's cookies, whatever the caller asked", async () => {
    let sent: RequestInit | undefined;
    const limitedFetch = fetchWithTimeLimit(1000, async (_input, init) => {
      sent = init;
      return new Response("{}");
    });

    await limitedFetch("https://api.example.com/public/x", { credentials: "include" });

    expect(sent?.credentials).toBe("omit");
  });

  it("gives up once the time limit passes, so the call ends instead of spinning", async () => {
    const limitedFetch = fetchWithTimeLimit(20, neverAnswers);

    await expect(limitedFetch("https://api.example.com/public/x")).rejects.toMatchObject({
      name: "TimeoutError",
    });
  });

  it("still stops when the caller's own signal stops first", async () => {
    const limitedFetch = fetchWithTimeLimit(10_000, neverAnswers);
    const caller = new AbortController();

    const call = limitedFetch("https://api.example.com/public/x", { signal: caller.signal });
    caller.abort();

    await expect(call).rejects.toMatchObject({ name: "AbortError" });
  });
});
