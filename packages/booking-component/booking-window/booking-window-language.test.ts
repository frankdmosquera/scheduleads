// @vitest-environment jsdom

import {
  act,
  cleanup,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { hc } from "hono/client";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { PublicAppType } from "backend/app-type";

import type { AfterBookingType, BookedType } from "../booking-provider/after-booking-type.js";
import type { BookingWordsType } from "../words/booking-words-type.js";
import { englishWords } from "../words/english-words.js";
import { spanishWords } from "../words/spanish-words.js";
import { BookingWindow } from "./booking-window.js";

// Two jsdom window files run side by side; a cold first run can take longer than a second.
configure({ asyncUtilTimeout: 3000 });

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
  vi.restoreAllMocks();
});

const madeBooking = {
  id: "b1",
  startsAt: "2026-10-14T16:00:00.000Z",
  endsAt: "2026-10-14T17:00:00.000Z",
  timezone: "America/Edmonton",
  when: "Miércoles, 14 de octubre, 10:00 a.m. MDT",
  service: { id: "facial", name: "Hydra Spa Facial" },
  person: { id: "ana", name: "Ana" },
};

type FakeApiSetupType = {
  listed?: boolean; // the service list has the service (else it is empty: nothing to book)
  customerPicks?: boolean; // the customer picks who does it, from Ana
  timeTaken?: boolean; // Book answers that the time was taken meanwhile
};

// A fake API for one business with one service, writing its times in whichever language it is
// asked; it records every times question and every Book.
function fakeApi(setup: FakeApiSetupType = {}) {
  const timesAsked: string[] = [];
  const posted: Record<string, unknown>[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const url = new URL(request.url);
      if (request.method === "POST") {
        posted.push(await request.clone().json());
        return setup.timeTaken
          ? json({ error: { code: "time_taken", message: "That time was just taken." } }, 409)
          : json({ booking: madeBooking }, 201);
      }
      if (url.pathname.endsWith("/times")) {
        timesAsked.push(url.search);
        const spanish = url.searchParams.get("language") === "es";
        const time = spanish ? "10:00 a. m." : "10:00 a.m.";
        return json({
          timezone: "America/Edmonton",
          people: setup.customerPicks ? [{ id: "ana", name: "Ana" }] : [],
          startTimes: [madeBooking.startsAt],
          localStartTimes: [
            { startsAt: madeBooking.startsAt, date: "2026-10-14", time, when: madeBooking.when },
          ],
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
            addressMode: "not_asked",
            layout: "month",
            personChoice: setup.customerPicks ? "customer_picks" : "business_assigns",
          },
          availability: { timezone: "America/Edmonton", horizonDays: 120 },
        });
      }
      return json({
        business: {
          name: "Riverbend Clinic",
          logo: null,
          phone: null,
          contactRule: "either",
          questions: [],
        },
        bookingLinks: setup.listed
          ? [{ id: "facial", name: "Hydra Spa Facial", durationMinutes: 60, description: null }]
          : [],
      });
    },
  });
  return { apiClient, timesAsked, posted };
}

type WindowSetupType = {
  api?: FakeApiSetupType;
  bookingId?: string; // left out: the window opens on the facial
  words?: BookingWordsType;
  afterBooking?: AfterBookingType;
  onBooked?: (booked: BookedType) => void;
  goTo?: (address: string) => void;
};

function openWindow(setup: WindowSetupType = {}) {
  const api = fakeApi(setup.api);
  render(
    createElement(BookingWindow, {
      apiClient: api.apiClient,
      slug: "clinic-dev",
      bookingId: "bookingId" in setup ? setup.bookingId : "facial",
      words: setup.words ?? englishWords,
      afterBooking: setup.afterBooking ?? "stay",
      onBooked: setup.onBooked,
      goTo: setup.goTo ?? (() => {}),
      onClosed() {},
    })
  );
  return api;
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

// Screen one to Book, in whichever language: the one time, Next, a name and an email, Book.
async function bookTheOneTime(words: BookingWordsType) {
  fireEvent.click(await screen.findByRole("button", { name: /^10:00/ }));
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${words.next}: `) }));
  type(words.nameLabel, "Jane Doe");
  type(words.emailLabel, "jane@example.com");
  await act(async () => fireEvent.click(screen.getByRole("button", { name: words.book })));
}

describe("the booking window's language", () => {
  it("speaks Spanish from the times to the confirmation, and asks the API in Spanish", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const { timesAsked, posted } = openWindow({ words: spanishWords });

    expect(await screen.findByRole("heading", { name: "Elija fecha y hora" })).toBeDefined();
    expect(screen.getByText("Octubre de 2026")).toBeDefined();
    expect(screen.getByRole("button", { name: "Miércoles, 14 de octubre" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeDefined();
    // The window says its own language, whatever the page around it speaks.
    expect(document.querySelector("dialog")?.getAttribute("lang")).toBe("es");
    await waitFor(() => expect(timesAsked.length).toBeGreaterThan(0));
    expect(timesAsked.every((search) => search.includes("language=es"))).toBe(true);

    await bookTheOneTime(spanishWords);
    expect(
      await screen.findByRole("heading", { name: "Su reserva está confirmada" })
    ).toBeDefined();
    expect(screen.getByText(madeBooking.when)).toBeDefined();
    expect(screen.getByText("Le enviamos la confirmación a jane@example.com.")).toBeDefined();
    expect(posted[0]?.language).toBe("es");
  });

  it("shows a form error in Spanish, never the shared rules' English", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const { posted } = openWindow({ words: spanishWords });
    fireEvent.click(await screen.findByRole("button", { name: /^10:00/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Siguiente: / }));
    type("Correo electrónico", "not-an-email");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reservar" })));

    expect(screen.getByText("Escriba su nombre.")).toBeDefined();
    // Inside a sentence the day stays lowercase, as Spanish writes it.
    expect(screen.getByText(/10:00 a\. m\., miércoles, 14 de octubre/)).toBeDefined();
    expect(screen.getByText("Escriba un correo electrónico válido.")).toBeDefined();
    expect(screen.queryByText("Enter a name.")).toBeNull();
    expect(posted).toHaveLength(0);
  });

  it("asks the API for English times as before, with no language in the question", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const { timesAsked, posted } = openWindow();
    await bookTheOneTime(englishWords);
    expect(timesAsked.some((search) => search.includes("language"))).toBe(false);
    expect(posted[0]?.language).toBe("en");
  });
});

describe("every screen in Spanish", () => {
  it("loads, lists the services and names the person choice in Spanish", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    openWindow({
      words: spanishWords,
      bookingId: undefined,
      api: { listed: true, customerPicks: true },
    });
    expect(screen.getByText("Cargando…")).toBeDefined();
    expect(
      await screen.findByRole("heading", { name: "Reserve con Riverbend Clinic" })
    ).toBeDefined();
    expect(screen.getByText("Elija qué desea reservar.")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: /Hydra Spa Facial/ }));
    expect(await screen.findByText("¿Con quién desea su cita?")).toBeDefined();
    expect(screen.getByRole("radio", { name: "Cualquiera disponible" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Volver a los servicios" })).toBeDefined();
  });

  it("says nothing can be booked in Spanish", async () => {
    openWindow({ words: spanishWords, bookingId: undefined });
    expect(await screen.findByText("En este momento no se puede reservar en línea.")).toBeDefined();
    expect(screen.getByRole("heading", { name: "Reserve con Riverbend Clinic" })).toBeDefined();
  });

  it("says a time taken meanwhile in Spanish, not in the API's English", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    openWindow({ words: spanishWords, api: { timeTaken: true } });
    await bookTheOneTime(spanishWords);
    expect((await screen.findByRole("alert")).textContent).toBe(spanishWords.timeTaken);
  });
});

describe("on a phone, the calendar and a day's times take turns", () => {
  it("opens a day's times when the day is picked, and goes back to the calendar", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    openWindow({ words: spanishWords });
    const pick = () => document.querySelector(".sa-pick");
    await screen.findByRole("button", { name: /^10:00/ });
    expect(pick()?.classList.contains("sa-pick--day")).toBe(false); // the calendar first

    fireEvent.click(screen.getByRole("button", { name: "Miércoles, 14 de octubre" }));
    expect(pick()?.classList.contains("sa-pick--day")).toBe(true); // the day's times, alone

    fireEvent.click(screen.getByRole("button", { name: /Volver al calendario/ }));
    expect(pick()?.classList.contains("sa-pick--day")).toBe(false);
  });
});

describe("after a booking", () => {
  it("stays on its own confirmation when the site names no page", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const goTo = vi.fn();
    openWindow({ goTo });
    await bookTheOneTime(englishWords);
    expect(await screen.findByRole("heading", { name: "You're booked" })).toBeDefined();
    expect(goTo).not.toHaveBeenCalled();
  });

  it("tells the site once, with nothing about the customer, and goes to its thank-you page", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const onBooked = vi.fn();
    const goTo = vi.fn();
    openWindow({ afterBooking: { redirectTo: "/gracias" }, onBooked, goTo });
    await bookTheOneTime(englishWords);

    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/gracias"));
    expect(onBooked).toHaveBeenCalledTimes(1);
    expect(onBooked).toHaveBeenCalledWith({
      bookingId: "b1",
      serviceName: "Hydra Spa Facial",
      startsAt: madeBooking.startsAt,
      timeZone: "America/Edmonton",
    });
    expect(JSON.stringify(onBooked.mock.calls)).not.toContain("jane");
  });

  it("builds the page's address from the booking when the site gives a function", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    const goTo = vi.fn();
    openWindow({
      afterBooking: { redirectTo: (booked) => `/gracias?at=${booked.startsAt}` },
      goTo,
    });
    await bookTheOneTime(englishWords);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith(`/gracias?at=${madeBooking.startsAt}`));
  });

  it("still goes to the thank-you page when the site's onBooked throws", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const goTo = vi.fn();
    openWindow({
      afterBooking: { redirectTo: "/gracias" },
      onBooked: () => {
        throw new Error("the site's count failed");
      },
      goTo,
    });
    await bookTheOneTime(englishWords);
    await waitFor(() => expect(goTo).toHaveBeenCalledWith("/gracias"));
  });

  it("keeps its own confirmation when the site's code throws, and books only once", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-09T18:00:00.000Z"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const goTo = vi.fn();
    const { posted } = openWindow({
      afterBooking: {
        redirectTo: () => {
          throw new Error("the site's bug");
        },
      },
      onBooked: () => {
        throw new Error("the site's other bug");
      },
      goTo,
    });
    await bookTheOneTime(englishWords);

    expect(await screen.findByRole("heading", { name: "You're booked" })).toBeDefined();
    expect(goTo).not.toHaveBeenCalled();
    expect(posted).toHaveLength(1);
  });
});
