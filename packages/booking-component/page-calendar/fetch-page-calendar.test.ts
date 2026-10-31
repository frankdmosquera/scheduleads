import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPageCalendar } from "./fetch-page-calendar.js";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const estimate = { id: "est", slug: "free-estimate", name: "Free Estimate" };
const touchUp = { id: "touch", slug: "touch-up", name: "Touch-up" };
const time = (date: string) => ({
  startsAt: `${date}T16:00:00.000Z`,
  date,
  time: "10:00 a.m.",
  when: "",
});

// A fake API: the service list, one service (Calgary, `horizonDays` ahead) and its times, by date.
function fakeApi({
  links = [estimate],
  horizonDays = 60,
  openDates = ["2026-10-31", "2026-11-02", "2026-11-20"],
  timesStatus = 200,
} = {}) {
  const asked: URL[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    asked.push(url);
    if (url.pathname.endsWith("/times")) {
      if (timesStatus !== 200) return json({ error: { code: "x", message: "x" } }, timesStatus);
      const from = url.searchParams.get("from")!;
      const to = url.searchParams.get("to")!;
      const times = openDates.filter((d) => d >= from && d <= to).map(time);
      return json({
        timezone: "America/Edmonton",
        people: [],
        startTimes: [],
        localStartTimes: times,
      });
    }
    if (/\/booking-links\/[^/]+$/.test(url.pathname)) {
      return json({
        bookingLink: { ...estimate, durationMinutes: 30 },
        availability: { timezone: "America/Edmonton", horizonDays },
      });
    }
    return json({ business: { name: "Primo" }, bookingLinks: links });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { asked, fetchMock };
}

// Already Nov 1 in UTC, still the evening of Oct 31 in Calgary: today is the business's date.
const NOW = new Date("2026-11-01T03:00:00.000Z");

afterEach(() => vi.unstubAllGlobals());

describe("fetchPageCalendar", () => {
  it("reads this month and the next on the business's clock, each in one call of 31 dates or fewer", async () => {
    const { asked } = fakeApi();
    const calendar = await fetchPageCalendar("https://api.example.com", "primo", { now: NOW });
    expect(calendar).toMatchObject({
      timeZone: "America/Edmonton",
      today: "2026-10-31",
      horizonDays: 60,
      months: ["2026-10", "2026-11"],
      openDays: ["2026-10-31", "2026-11-02", "2026-11-20"],
    });
    expect(calendar?.service.id).toBe("est");
    const times = asked.filter((url) => url.pathname.endsWith("/times"));
    expect(times.map((url) => [url.searchParams.get("from"), url.searchParams.get("to")])).toEqual([
      ["2026-10-31", "2026-10-31"],
      ["2026-11-01", "2026-11-30"],
    ]);
    expect(times.every((url) => !url.searchParams.has("language"))).toBe(true);
  });

  it("stops at the business's horizon", async () => {
    const { asked } = fakeApi({ horizonDays: 10 });
    const calendar = await fetchPageCalendar("https://api.example.com", "primo", { now: NOW });
    expect(calendar?.openDays).toEqual(["2026-10-31", "2026-11-02"]);
    const last = asked.filter((url) => url.pathname.endsWith("/times")).at(-1)!;
    expect(last.searchParams.get("to")).toBe("2026-11-10");
  });

  it("passes the site's caching to every call", async () => {
    const { fetchMock } = fakeApi();
    const init = { cache: "force-cache" } as RequestInit;
    await fetchPageCalendar("https://api.example.com", "primo", { now: NOW, init });
    for (const call of fetchMock.mock.calls) {
      expect((call as unknown as [unknown, RequestInit])[1].cache).toBe("force-cache");
    }
  });

  it("takes the service named by its slug, and none when several and none named", async () => {
    fakeApi({ links: [touchUp, estimate] });
    const named = await fetchPageCalendar("https://api.example.com", "primo", {
      now: NOW,
      service: "free-estimate",
    });
    expect(named).not.toBeNull();
    expect(await fetchPageCalendar("https://api.example.com", "primo", { now: NOW })).toBeNull();
    expect(
      await fetchPageCalendar("https://api.example.com", "primo", { now: NOW, service: "gone" })
    ).toBeNull();
  });

  it("answers null, never throws, when a read fails or the API cannot be reached", async () => {
    fakeApi({ timesStatus: 503 });
    expect(await fetchPageCalendar("https://api.example.com", "primo", { now: NOW })).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("fetch failed")))
    );
    expect(await fetchPageCalendar("https://api.example.com", "primo", { now: NOW })).toBeNull();
    expect(await fetchPageCalendar("https://api.example.com", " ", { now: NOW })).toBeNull();
  });
});
