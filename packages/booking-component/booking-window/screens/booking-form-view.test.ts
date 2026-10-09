// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { hc } from "hono/client";
import { createElement, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import type { PublicAppType } from "backend/app-type";

import type { BookingBusinessType } from "../../api-client/booking-api-types.js";
import type { BookingFormValuesType } from "../booking-form/booking-form-values-type.js";
import { newBookingForm } from "../booking-form/new-booking-form.js";
import { BookingFormView } from "./booking-form-view.js";

const booking = {
  id: "b1",
  startsAt: "2026-10-14T16:00:00.000Z",
  endsAt: "2026-10-14T17:00:00.000Z",
  timezone: "America/Edmonton",
  when: "Wednesday, October 14 at 10:00 a.m. MDT",
  service: { id: "facial", name: "Hydra Spa Facial" },
  person: { id: "ana", name: "Ana" },
};
const business = {
  name: "Riverbend Clinic",
  logo: null,
  phone: "403 555 0100",
  questions: [{ id: "q-colour", label: "Which colour?", required: true }],
} as BookingBusinessType;

// The real typed client over a fake fetch: each send is recorded and held until the test answers it.
function clientWithHeldSends() {
  const sends: { body: { requestKey: string }; answer(response: Response | null): void }[] = [];
  const apiClient = hc<PublicAppType>("https://api.example.com", {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      const body = await request.clone().json();
      return new Promise<Response>((resolve, reject) => {
        sends.push({
          body,
          answer: (response) =>
            response ? resolve(response) : reject(new TypeError("Failed to fetch")),
        });
      });
    },
  });
  return { apiClient, sends };
}

function renderForm(apiClient: ReturnType<typeof clientWithHeldSends>["apiClient"]) {
  const booked: unknown[] = [];
  const taken: string[] = [];
  const unsure: boolean[] = [];
  function Holder() {
    const [form, setForm] = useState<BookingFormValuesType>(newBookingForm);
    return createElement(BookingFormView, {
      apiClient,
      slug: "clinic-dev",
      business,
      choice: { bookingLinkId: "facial", startsAt: booking.startsAt, personId: null },
      form,
      onFormChange: setForm,
      onBooked: (made, email) => booked.push({ made, email }),
      onTimeTaken: (message) => taken.push(message),
      onUnsureChange: (now) => unsure.push(now),
    });
  }
  render(createElement(Holder));
  return { booked, taken, unsure };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillIn = () => {
  type("Name", "Jane Doe");
  type("Email", "jane@example.com");
  type("Address", "12 Elm Street");
  type("Which colour?", "Blue");
};

afterEach(() => cleanup());

describe("screen two's form", () => {
  it("shows each error under its field, focuses the first, and clears it when that field is edited", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    renderForm(apiClient);

    fireEvent.click(screen.getByRole("button", { name: "Book" }));

    const name = screen.getByLabelText("Name");
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter a name.").id).toBe(name.getAttribute("aria-describedby"));
    expect(screen.getByText("Answer this question.")).toBeDefined();
    expect(sends).toHaveLength(0);

    type("Name", "J");
    expect(screen.queryByText("Enter a name.")).toBeNull();
    expect(name.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText("Answer this question.")).toBeDefined(); // only the edited field clears
  });

  it("sends once however fast Book is pressed, and hands on the booking with her email", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    const { booked } = renderForm(apiClient);
    fillIn();

    const book = screen.getByRole("button", { name: "Book" });
    fireEvent.click(book);
    fireEvent.click(book);
    await waitFor(() => expect(sends).toHaveLength(1));
    expect(screen.getByRole("button", { name: "Booking…" })).toHaveProperty("disabled", true);

    await act(async () =>
      sends[0]?.answer(new Response(JSON.stringify({ booking }), { status: 201 }))
    );
    expect(sends).toHaveLength(1);
    expect(booked).toEqual([{ made: booking, email: "jane@example.com" }]);
  });

  it("after a lost answer changes nothing until one comes: Try again sends the very same booking", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    const { booked, unsure } = renderForm(apiClient);
    fillIn();

    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    await waitFor(() => expect(sends).toHaveLength(1));
    await act(async () => sends[0]?.answer(null));

    expect(screen.getByRole("alert").textContent).toContain("It never books twice");
    expect(unsure).toEqual([true]); // the screen hides its Back
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Jane Doe");
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true); // the whole group
    expect(screen.queryByRole("button", { name: "Book" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(sends).toHaveLength(2));
    expect(sends[1]?.body).toEqual(sends[0]?.body);
    await act(async () =>
      sends[1]?.answer(new Response(JSON.stringify({ booking }), { status: 201 }))
    );
    expect(booked).toEqual([{ made: booking, email: "jane@example.com" }]);
    expect(unsure).toEqual([true, false]);
  });

  it("stays frozen on an answer that does not settle the form, and says it is checking", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    const { unsure } = renderForm(apiClient);
    fillIn();
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

    // A server fault on the first try may hide a booking made: frozen, as a lost answer.
    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    await waitFor(() => expect(sends).toHaveLength(1));
    await act(async () => sends[0]?.answer(json(500, { error: "x" })));
    expect(screen.getByRole("alert").textContent).toContain("It never books twice");
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);

    // Try again says it is checking while it waits, and focus waits there, not on the page.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(sends).toHaveLength(2));
    expect(screen.getByRole("status").textContent).toBe("Checking your booking…");
    expect(document.activeElement).toBe(screen.getByRole("status"));

    // "Too many tries" may come before the form is looked up: still frozen, still Try again.
    await act(async () =>
      sends[1]?.answer(json(429, { error: { code: "too_many_tries", message: "Too many." } }))
    );
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(true);
    expect(screen.queryByRole("button", { name: "Book" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("whether your booking went through");
    // Focus is on the words' own place, never the page.
    expect(document.activeElement).toBe(screen.getByRole("alert").closest(".sa-focus-place"));
    expect(screen.getByRole("button", { name: "Try again" })).toBeDefined();
    expect(unsure).toEqual([true, true]);

    // The route's own refusal settles it: she may change her details again.
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(sends).toHaveLength(3));
    await act(async () =>
      sends[2]?.answer(
        json(400, { error: { code: "bad_request", message: "Answer: Which colour?" } })
      )
    );
    expect(screen.getByLabelText("Email").matches(":disabled")).toBe(false);
    expect(unsure).toEqual([true, true, false]);
    // The refusal's words take the focus from the checking line that held it.
    expect(screen.getByRole("alert").textContent).toBe("Answer: Which colour?");
    expect(document.activeElement).toBe(screen.getByRole("alert").closest(".sa-focus-place"));
  });

  it("says a part of the form no field shows, and sends nothing", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    const many = Array.from({ length: 21 }, (_, n) => ({
      id: `q-${n}`,
      label: `Question ${n}`,
      required: false,
    }));
    function Holder() {
      const [form, setForm] = useState<BookingFormValuesType>(newBookingForm);
      return createElement(BookingFormView, {
        apiClient,
        slug: "clinic-dev",
        business: { ...business, questions: many },
        choice: { bookingLinkId: "facial", startsAt: booking.startsAt, personId: null },
        form,
        onFormChange: setForm,
        onBooked: () => {},
        onTimeTaken: () => {},
        onUnsureChange: () => {},
      });
    }
    render(createElement(Holder));
    type("Name", "Jane Doe");
    type("Email", "jane@example.com");
    type("Address", "12 Elm Street");
    for (const question of many) type(question.label, "Yes");

    fireEvent.click(screen.getByRole("button", { name: "Book" }));

    expect(screen.getByRole("alert").textContent).toBe("That is too many answers.");
    expect(sends).toHaveLength(0);
  });

  it("hands a time taken while she typed back to the window, in the route's words", async () => {
    const { apiClient, sends } = clientWithHeldSends();
    const { taken } = renderForm(apiClient);
    fillIn();

    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    await waitFor(() => expect(sends).toHaveLength(1));
    const words = "Sorry, that time was taken while you were booking. Please pick another one.";
    await act(async () =>
      sends[0]?.answer(
        new Response(JSON.stringify({ error: { code: "time_taken", message: words } }), {
          status: 409,
        })
      )
    );

    expect(taken).toEqual([words]);
  });
});
