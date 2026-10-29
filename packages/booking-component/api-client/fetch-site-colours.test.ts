import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSiteColours } from "./fetch-site-colours.js";

const THEME = { main: "#c0704f", mainInk: "#0f172a", background: "#f7f2ea", text: "#1c1a17" };
const answer = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

afterEach(() => vi.unstubAllGlobals());

describe("fetchSiteColours", () => {
  it("answers the business's saved colours, and passes the site's caching to fetch", async () => {
    const fetchMock = answer(200, { business: { name: "Clinic", theme: THEME }, bookingLinks: [] });
    vi.stubGlobal("fetch", fetchMock);
    const init = { cache: "force-cache" } as RequestInit;
    expect(await fetchSiteColours("https://api.example.com/", "clinic", init)).toEqual(THEME);
    const [url, sent] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.example.com/public/clinic/booking-links");
    expect(sent.cache).toBe("force-cache");
    expect(sent.credentials).toBe("omit");
  });

  it("answers null when the business saved no colours", async () => {
    vi.stubGlobal("fetch", answer(200, { business: { theme: null }, bookingLinks: [] }));
    expect(await fetchSiteColours("https://api.example.com", "clinic")).toBeNull();
  });

  it("answers null on any answer but 200", async () => {
    vi.stubGlobal("fetch", answer(404, { error: "not_found" }));
    expect(await fetchSiteColours("https://api.example.com", "clinic")).toBeNull();
  });

  it("answers null, never throws, when the API cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed")))
    );
    expect(await fetchSiteColours("https://api.example.com", "clinic")).toBeNull();
  });

  it("answers null for a body without the business", async () => {
    vi.stubGlobal("fetch", answer(200, { bookingLinks: [] }));
    expect(await fetchSiteColours("https://api.example.com", "clinic")).toBeNull();
  });

  it("asks nothing for a blank slug", async () => {
    const fetchMock = answer(200, {});
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchSiteColours("https://api.example.com", " ")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
