// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BookingProvider } from "../booking-provider/booking-provider.js";
import type { PageCalendarDataType } from "./fetch-page-calendar.js";
import { PageCalendar } from "./page-calendar.js";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const at = (date: string, time: string, startsAt: string) => ({ startsAt, date, time, when: "" });

const calendar: PageCalendarDataType = {
  timeZone: "America/Edmonton",
  today: "2026-11-01",
  horizonDays: 60,
  service: {
    id: "est",
    slug: "free-estimate",
    name: "Free Estimate",
    description: null,
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    addressMode: "required",
    price: null,
    imageUrl: null,
    layout: "month",
    personChoice: "business_assigns",
  } as PageCalendarDataType["service"],
  theme: null,
  months: ["2026-11", "2026-12"],
  openDays: ["2026-11-02", "2026-11-03"],
};

// The times route by date: Nov 2 filled since the page was built, Nov 3 still has a time.
function fakeApi() {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      asked.push(url.pathname + url.search);
      if (url.pathname.endsWith("/times")) {
        const from = url.searchParams.get("from");
        const times =
          from === "2026-11-03" ? [at("2026-11-03", "10:00 a.m.", "2026-11-03T16:00:00.000Z")] : [];
        return json({
          timezone: "America/Edmonton",
          people: [],
          startTimes: [],
          localStartTimes: times,
        });
      }
      return json({ error: { code: "x", message: "x" } }, 500);
    })
  );
  return asked;
}

const page = () =>
  render(
    createElement(BookingProvider, {
      apiUrl: "https://api.example.com",
      slug: "primo",
      children: createElement(PageCalendar, {
        calendar,
        title: "Pick a day",
        bookLabel: "Book now",
      }),
    })
  );

describe("a calendar on the site's own page", () => {
  it("draws the built-in month with its open days, before anything is read", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    const asked = fakeApi();
    page();
    expect(screen.getByText("November 2026")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Monday, November 2" }) as HTMLButtonElement).disabled
    ).toBe(false);
    expect(
      (screen.getByRole("button", { name: "Wednesday, November 4" }) as HTMLButtonElement).disabled
    ).toBe(true);
    expect(asked).toEqual([]);
  });

  it("says a day filled since the page was built, and offers the next open day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    page();
    fireEvent.click(screen.getByRole("button", { name: "Monday, November 2" }));
    expect(await screen.findByText("No times left on Monday, November 2.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next open day" }));
    expect(await screen.findByRole("button", { name: "10:00 a.m." })).toBeTruthy();
  });

  it("opens the window on the form with the picked time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    page();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: "Book now" }));
    await waitFor(() => expect(document.querySelector("dialog.sa-dialog")).not.toBeNull());
  });

  it("never offers a day that passed since the page was built", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T08:00:00.000Z")); // Nov 3 in Calgary: Nov 2 has gone
    fakeApi();
    page();
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Monday, November 2" }) as HTMLButtonElement).disabled
      ).toBe(true)
    );
  });
});
