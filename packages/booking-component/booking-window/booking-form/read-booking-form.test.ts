import { describe, expect, it } from "vitest";

import { newBookingForm } from "./new-booking-form.js";
import { readBookingForm } from "./read-booking-form.js";

const questions = [
  { id: "q-colour", label: "Which colour?", required: true },
  { id: "q-pets", label: "Any pets?", required: false },
];
const choice = { bookingLinkId: "facial", startsAt: "2026-10-14T16:00:00.000Z", personId: null };
const filledForm = {
  ...newBookingForm(),
  name: " Jane Doe ",
  email: "",
  phone: "403 555 0100",
  location: "12 Elm Street",
  details: "",
  answers: { "q-colour": " Blue ", "q-pets": "" },
};

describe("readBookingForm", () => {
  it("sends the form as the route reads it: trimmed, empty boxes left out, any available as no person", () => {
    const read = readBookingForm(filledForm, questions, choice);

    expect(read).toEqual({
      state: "ok",
      request: {
        bookingLinkId: "facial",
        startsAt: "2026-10-14T16:00:00.000Z",
        requestKey: filledForm.requestKey,
        customer: { name: "Jane Doe", email: undefined, phone: "403 555 0100" },
        location: "12 Elm Street",
        details: undefined,
        answers: [{ questionId: "q-colour", answer: "Blue" }],
      },
    });
  });

  it("sends the picked person when there is one", () => {
    const read = readBookingForm(filledForm, questions, { ...choice, personId: "ana" });

    expect(read.state === "ok" && read.request.personId).toBe("ana");
  });

  it("asks for an email or a phone under the email when both are empty", () => {
    const read = readBookingForm({ ...filledForm, phone: "" }, questions, choice);

    expect(read).toEqual({
      state: "errors",
      errors: [
        { field: "email", message: "Enter an email or a phone number. At least one is required." },
      ],
    });
  });

  it("says a wrong email under the email", () => {
    const read = readBookingForm({ ...filledForm, email: "jane@" }, questions, choice);

    expect(read).toEqual({
      state: "errors",
      errors: [{ field: "email", message: "Enter a valid email address." }],
    });
  });

  it("lists every error in the form's order, a required question left empty among them", () => {
    const read = readBookingForm(
      { ...filledForm, name: "  ", location: "", answers: { "q-colour": " " } },
      questions,
      choice
    );

    expect(read).toEqual({
      state: "errors",
      errors: [
        { field: "name", message: "Enter a name." },
        { field: "location", message: "Enter the address." },
        { field: "answer:q-colour", message: "Answer this question." },
      ],
    });
  });

  it("gives each new form its own key, of the shape the route takes", () => {
    const first = newBookingForm().requestKey;
    const second = newBookingForm().requestKey;

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});
