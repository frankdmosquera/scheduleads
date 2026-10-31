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
      if (/\/booking-links\/[^/]+$/.test(url.pathname)) {
        return json({
          bookingLink: calendar.service,
          availability: { timezone: "America/Edmonton", horizonDays: 60 },
        });
      }
      return json({
        business: {
          name: "Primo Painters",
          logo: null,
          phone: null,
          contactRule: "email",
          detailsLabel: null,
          detailsRequired: false,
          questions: [],
          theme: null,
        },
        bookingLinks: [calendar.service],
      });
    })
  );
  return asked;
}

const asked = vi.fn();
const pageOf = (shown: PageCalendarDataType, zoneLine?: boolean) =>
  createElement(BookingProvider, {
    apiUrl: "https://api.example.com",
    slug: "primo",
    children: createElement(PageCalendar, {
      calendar: shown,
      title: "Pick a day",
      bookLabel: "Book now",
      ask: { label: "Ask us", onAsk: asked },
      zoneLine,
    }),
  });
const page = (shown: PageCalendarDataType = calendar) => render(pageOf(shown));

describe("a calendar on the site's own page", () => {
  it("is one group named by its title, with Ask us beside Book now", () => {
    fakeApi();
    page();
    expect(screen.getByRole("group", { name: "Pick a day" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ask us" }));
    expect(asked).toHaveBeenCalledTimes(1);
  });

  it("opens a tapped day beside the month, with the service's name and length", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    const { container } = page();
    expect(container.querySelector(".sa-pagecal--open")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    await screen.findByRole("button", { name: "10:00 a.m." });
    expect(container.querySelector(".sa-pagecal--open")).not.toBeNull();
    const day = container.querySelector(".sa-pagecal-day")!;
    expect(day.textContent).toContain("Free Estimate");
    expect(day.textContent).toContain("30 min");
  });

  it("names the zone over the month unless the site leaves the line out", () => {
    fakeApi();
    const shown = page();
    expect(shown.container.querySelector(".sa-tz")).not.toBeNull();
    cleanup();
    const left = render(pageOf(calendar, false));
    expect(left.container.querySelector(".sa-tz")).toBeNull();
  });

  it("moves focus to the next open day it offers, so it is never lost", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Monday, November 2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Next open day" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(container.querySelector(".sa-pagecal-day"))
    );
  });

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
    // Straight on the form, with the time picked on the page: no times to pick again in the window.
    expect(await screen.findByLabelText("Name")).toBeTruthy();
    const dialog = document.querySelector("dialog.sa-dialog")!;
    expect(dialog.textContent).toContain("10:00 a.m., Tuesday, November 3");
  });

  it("says plainly when the month on screen has no open day", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    page({ ...calendar, openDays: [] });
    expect(await screen.findByText("No times left in November 2026.")).toBeTruthy();
    // The arrow, and the button under the message.
    expect(screen.getAllByRole("button", { name: "Next month" })).toHaveLength(2);
  });

  it("hydrates the page built yesterday without a mismatch, then moves today on", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    fakeApi();
    // The page as the site's server drew it on Nov 1, the day it was built.
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    const built = page();
    const html = built.container.innerHTML;
    built.unmount();
    // A visitor on Nov 3 gets that page, and the browser takes it over.
    vi.setSystemTime(new Date("2026-11-03T08:00:00.000Z"));
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const problems = vi.spyOn(console, "error").mockImplementation(() => {});
    render(pageOf(calendar), { container, hydrate: true });
    await waitFor(() =>
      expect(
        (container.querySelector('[aria-label="Monday, November 2"]') as HTMLButtonElement).disabled
      ).toBe(true)
    );
    // React reports a page that does not match what it draws as a console error.
    expect(problems).not.toHaveBeenCalled();
    problems.mockRestore();
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
