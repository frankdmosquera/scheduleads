// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
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

// The times route by date: Nov 2 filled since the page was built, Nov 3 still has a time. A booking
// sent takes the next of `answers` (a promise never kept is an answer that never comes), and its
// body is kept in `posted`. With `listFails`, the business cannot be read.
const posted: { requestKey: string; startsAt: string }[] = [];
function fakeApi(answers: (Response | Promise<Response>)[] = [], { listFails = false } = {}) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      asked.push(url.pathname + url.search);
      if (request.method === "POST" && url.pathname.endsWith("/bookings")) {
        posted.push(await request.json());
        return answers.shift() ?? json({ error: { code: "unexpected" } }, 500);
      }
      if (url.pathname.endsWith("/times")) {
        const from = url.searchParams.get("from") ?? "";
        const to = url.searchParams.get("to") ?? from;
        const times =
          from <= "2026-11-03" && "2026-11-03" <= to
            ? [at("2026-11-03", "10:00 a.m.", "2026-11-03T16:00:00.000Z")]
            : [];
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
      if (listFails && url.pathname.endsWith("/booking-links")) return json({ error: {} }, 500);
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
const heardBooked = vi.fn();
const pageOf = (shown: PageCalendarDataType, zoneLine?: boolean) =>
  createElement(BookingProvider, {
    apiUrl: "https://api.example.com",
    slug: "primo",
    onBooked: heardBooked,
    children: createElement(PageCalendar, {
      calendar: shown,
      title: "Pick a day",
      bookLabel: "Book now",
      ask: { label: "Ask us", onAsk: asked },
      zoneLine,
    }),
  });
const page = (shown: PageCalendarDataType = calendar) => render(pageOf(shown));

const madeWhen = "Tuesday, November 3 at 10:00 a.m. MST (as the API wrote it)";
const madeAnswer = () =>
  json(
    {
      booking: {
        id: "b1",
        startsAt: "2026-11-03T16:00:00.000Z",
        endsAt: "2026-11-03T16:30:00.000Z",
        timezone: "America/Edmonton",
        when: madeWhen,
        service: { id: "est", name: "Free Estimate" },
        person: { id: "frank", name: "Frank" },
      },
    },
    201
  );
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
// The form shows once the business is read, at the first Next.
const fillForm = async () => {
  await screen.findByLabelText("Name");
  type("Name", "Jane Doe");
  type("Email", "jane@example.com");
  type("Address", "12 Elm Street");
};

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

  it("stays grown once a day opened, through the month arrows", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi();
    const { container } = page();
    expect(container.querySelector(".sa-pagecal--grown")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    await screen.findByRole("button", { name: "10:00 a.m." });
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(container.querySelector(".sa-pagecal--open")).toBeNull();
    expect(container.querySelector(".sa-pagecal--grown")).not.toBeNull();
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

  it("draws the built-in month with its open days, then reads only the next three days", async () => {
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
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]).toContain("from=2026-11-01");
    expect(asked[0]).toContain("to=2026-11-03");
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

  it("books on the spot: Next shows the form in the card, one send, booked said there", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    posted.length = 0;
    heardBooked.mockClear();
    fakeApi([madeAnswer()]);
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    await fillForm();
    expect(document.querySelector("dialog.sa-dialog")).toBeNull();
    expect(container.querySelector(".sa-pagecal-spot")!.textContent).toContain(
      "10:00 a.m., Tuesday, November 3"
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    await waitFor(() => expect(container.textContent).toContain("You're booked"));
    expect(container.textContent).toContain(madeWhen);
    expect(posted.map((sent) => sent.startsAt)).toEqual(["2026-11-03T16:00:00.000Z"]);
    expect(heardBooked).toHaveBeenCalledTimes(1);
    expect(document.querySelector("dialog.sa-dialog")).toBeNull();
  });

  it("goes back to the day when the time was taken meanwhile, keeping the form and its key", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    posted.length = 0;
    const taken = "Sorry, that time was taken while you were booking. Please pick another one.";
    fakeApi([json({ error: { code: "time_taken", message: taken } }, 409), madeAnswer()]);
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    await fillForm();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    expect((await screen.findByRole("alert")).textContent).toBe(taken);
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Jane Doe");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    await waitFor(() => expect(container.textContent).toContain("You're booked"));
    expect(posted).toHaveLength(2);
    expect(posted[1]?.requestKey).toBe(posted[0]?.requestKey);
  });

  it("locks the month while a booking is on its way, so the same key never goes for another time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    posted.length = 0;
    fakeApi([new Promise<Response>(() => {})]);
    const { container } = page();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    await fillForm();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    expect(container.querySelector(".sa-pagecal-month")!.hasAttribute("inert")).toBe(true);
    expect(screen.queryByRole("button", { name: /Back to the times/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Monday, November 2" }));
    expect(container.querySelector(".sa-form")).not.toBeNull();
    expect(posted).toHaveLength(1);
  });

  it("makes a new form, with a new key, for a second booking from the card", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    posted.length = 0;
    fakeApi([madeAnswer(), madeAnswer()]);
    const { container } = page();
    for (const _ of [1, 2]) {
      fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
      fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
      fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
      expect(((await screen.findByLabelText("Name")) as HTMLInputElement).value).toBe("");
      await fillForm();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
      await waitFor(() => expect(container.textContent).toContain("You're booked"));
    }
    expect(posted).toHaveLength(2);
    expect(posted[1]?.requestKey).not.toBe(posted[0]?.requestKey);
  });

  it("opens the window on the picked time when the business cannot be read", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-01T18:00:00.000Z"));
    fakeApi([], { listFails: true });
    page();
    fireEvent.click(screen.getByRole("button", { name: "Tuesday, November 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    await waitFor(() => expect(document.querySelector("dialog.sa-dialog")).not.toBeNull());
    expect(document.querySelector(".sa-pagecal .sa-form")).toBeNull();
  });

  it("greys a day of the next three that ran out of times, and opens on the next month if it was all the month had", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-30T23:00:00.000Z")); // 4 p.m. in Calgary, his day done
    fakeApi();
    page({
      ...calendar,
      today: "2026-11-30",
      months: ["2026-11", "2026-12"],
      openDays: ["2026-11-30", "2026-12-02"],
    });
    await waitFor(() =>
      expect(document.querySelector(".sa-mtitle")!.textContent).toBe("December 2026")
    );
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    const lastDay = screen.getByRole("button", { name: "Monday, November 30" });
    expect(lastDay.getAttribute("data-free")).not.toBe("yes");
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
    const html = renderToString(pageOf(calendar));
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
