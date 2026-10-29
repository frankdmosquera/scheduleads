// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { BookingProvider } from "./booking-provider.js";
import { useBooking } from "./use-booking.js";

// jsdom has no <dialog> behaviour. Here the first showModal does nothing, as when a window the
// page holds as open never reached the screen (Face and Body's /book, Oct 29); later ones show it.
let showModalCalls = 0;
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    showModalCalls += 1;
    if (showModalCalls > 1) this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Opener() {
  const { open } = useBooking();
  return createElement("button", { type: "button", onClick: () => open() }, "Book now");
}

describe("BookingProvider", () => {
  it("shows the window on the next open when the first never reached the screen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              business: {
                name: "Clinic",
                logo: null,
                phone: null,
                contactRule: "email",
                questions: [],
                laterTextsYesWords: null,
                theme: null,
              },
              bookingLinks: [],
            }),
            { status: 200 }
          )
      )
    );
    render(
      createElement(BookingProvider, {
        apiUrl: "https://api.example.com",
        slug: "clinic",
        children: createElement(Opener),
      })
    );
    const book = screen.getByRole("button", { name: "Book now" });
    showModalCalls = 0;

    fireEvent.click(book);
    const dialog = document.querySelector("dialog")!;
    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(false); // held as open, never on screen

    fireEvent.click(book);
    await waitFor(() => expect(dialog.open).toBe(true));
    expect(document.querySelectorAll("dialog")).toHaveLength(1); // still the one window

    // a window already showing is left as it is
    fireEvent.click(book);
    expect(showModalCalls).toBe(2);
  });
});
