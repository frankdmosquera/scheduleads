// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hc } from "hono/client";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PublicAppType } from "backend/app-type";

import { BookingWindow } from "./booking-window.js";

// jsdom has no <dialog> behaviour: open and close are enough here.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const at = (startsAt: string, date: string, time: string) => ({
  startsAt,
  date,
  time,
  when: `${date} at ${time}`,
});
const tenOClock = at("2026-10-14T16:00:00.000Z", "2026-10-14", "10:00 a.m.");
const elevenOClock = at("2026-10-14T17:00:00.000Z", "2026-10-14", "11:00 a.m.");
// The API's own words for the time, never the browser's: the done screen shows them as sent.
const madeWhen = "Wednesday, October 14 at 11:00 a.m. MDT (as the API wrote it)";

// A fake API for one business with one service. Each Book answers with the next of `bookAnswers`.
function fakeApi(bookAnswers: (Response | Promise<Response>)[]) {
  const posted: { requestKey: string; startsAt: string }[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      if (request.method === "POST") {
        posted.push(await request.clone().json());
        return bookAnswers.shift() ?? json({ error: { code: "x", message: "No more." } }, 500);
      }
      if (url.pathname.endsWith("/times")) {
        // The second answer leaves out the time taken meanwhile.
        const times = posted.length === 0 ? [tenOClock, elevenOClock] : [elevenOClock];
        return json({
          timezone: "America/Edmonton",
          people: [],
          startTimes: times.map((time) => time.startsAt),
          localStartTimes: times,
        });
      }
      if (url.pathname.endsWith("/booking-links/facial")) {
        return json({
          bookingLink: {
            id: "facial",
            slug: "facial",
            name: "Hydra Spa Facial",
            description: null,
            durationMinutes: 60,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 0,
            layout: "month",
            personChoice: "business_assigns",
          },
          availability: { timezone: "America/Edmonton", horizonDays: 120 },
        });
      }
      return json({
        business: { name: "Riverbend Clinic", logo: null, phone: null, questions: [] },
        bookingLinks: [],
      });
    },
  });
  return { apiClient, posted };
}

const openToScreenTwo = async (apiClient: ReturnType<typeof fakeApi>["apiClient"]) => {
  render(
    createElement(BookingWindow, {
      apiClient,
      slug: "clinic-dev",
      bookingId: "facial",
      onClosed() {},
    })
  );
  fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
  fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
  type("Name", "Jane Doe");
  type("Email", "jane@example.com");
  type("Address", "12 Elm Street");
};

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("the booking window", () => {
  it("keeps the form and its key across a time taken, and shows the time the API wrote", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const taken = "Sorry, that time was taken while you were booking. Please pick another one.";
    const { apiClient, posted } = fakeApi([
      new Response(JSON.stringify({ error: { code: "time_taken", message: taken } }), {
        status: 409,
      }),
      new Response(
        JSON.stringify({
          booking: {
            id: "b1",
            startsAt: elevenOClock.startsAt,
            endsAt: "2026-10-14T18:00:00.000Z",
            timezone: "America/Edmonton",
            when: madeWhen,
            service: { id: "facial", name: "Hydra Spa Facial" },
            person: { id: "ana", name: "Ana" },
          },
        }),
        { status: 201 }
      ),
    ]);
    render(
      createElement(BookingWindow, {
        apiClient,
        slug: "clinic-dev",
        bookingId: "facial",
        onClosed() {},
      })
    );

    // Screen one: 10:00 on her day, then Next.
    fireEvent.click(await screen.findByRole("button", { name: "10:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));
    type("Name", "Jane Doe");
    type("Email", "jane@example.com");
    type("Address", "12 Elm Street");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));

    // Taken meanwhile: back on her day with the route's words, 10:00 gone.
    expect((await screen.findByRole("alert")).textContent).toBe(taken);
    expect(screen.queryByRole("button", { name: "10:00 a.m." })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "11:00 a.m." }));
    fireEvent.click(screen.getByRole("button", { name: /^Next: / }));

    // Her words are kept, and the same form books.
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Jane Doe");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));

    await waitFor(() => expect(screen.getByText(madeWhen)).toBeDefined());
    expect(screen.getByText("A confirmation is on its way to jane@example.com.")).toBeDefined();
    expect(posted.map((sent) => sent.startsAt)).toEqual([
      tenOClock.startsAt,
      elevenOClock.startsAt,
    ]);
    expect(posted[1]?.requestKey).toBe(posted[0]?.requestKey);
  });

  it("hides Back to the times while a lost answer is unknown, and shows it again once settled", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const words = "Sorry, that time was taken while you were booking. Please pick another one.";
    const { apiClient } = fakeApi([
      new Response("<html>Bad gateway</html>", { status: 502 }),
      new Response(JSON.stringify({ error: { code: "time_taken", message: words } }), {
        status: 409,
      }),
    ]);
    await openToScreenTwo(apiClient);
    expect(screen.getByRole("button", { name: "Back to the times" })).toBeDefined();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    expect(await screen.findByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Back to the times" })).toBeNull();

    // Settled: the time was taken, so this form booked nothing and screen one comes back.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Try again" })));
    expect((await screen.findByRole("alert")).textContent).toBe(words);
  });

  it("hides Back to the times and locks the fields from the press, so a lost answer stays frozen", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    let drop = () => {};
    const held = new Promise<Response>((_resolve, reject) => {
      drop = () => reject(new TypeError("Failed to fetch"));
    });
    const { apiClient, posted } = fakeApi([held]);
    await openToScreenTwo(apiClient);

    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    await waitFor(() => expect(posted).toHaveLength(1));
    // While the send is out: no Back to another time, nothing to edit.
    expect(screen.queryByRole("button", { name: "Back to the times" })).toBeNull();
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Booking…");

    // The answer is lost: still no Back, still frozen, Try again offered.
    await act(async () => drop());
    expect(await screen.findByRole("button", { name: "Try again" })).toBeDefined();
    expect(screen.queryByRole("button", { name: "Back to the times" })).toBeNull();
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);
  });

  it("gives each opening of the window its own form key", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const first = fakeApi([new Response("{}", { status: 500 })]);
    await openToScreenTwo(first.apiClient);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));
    cleanup(); // closed: the window is gone

    const second = fakeApi([new Response("{}", { status: 500 })]);
    await openToScreenTwo(second.apiClient);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Book" })));

    await waitFor(() => expect(second.posted).toHaveLength(1));
    expect(first.posted[0]?.requestKey).toBeDefined();
    expect(second.posted[0]?.requestKey).not.toBe(first.posted[0]?.requestKey);
  });
});
