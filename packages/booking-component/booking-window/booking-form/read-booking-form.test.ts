import { describe, expect, it } from "vitest";

import { newBookingForm } from "./new-booking-form.js";
import { readBookingForm } from "./read-booking-form.js";

const questions = [
  { id: "q-colour", label: "Which colour?", required: true },
  { id: "q-pets", label: "Any pets?", required: false },
];
const choice = {
  bookingLinkId: "facial",
  startsAt: "2026-10-14T16:00:00.000Z",
  personId: null,
  addressMode: "required" as const,
};
const business = { questions, contactRule: "either" as const };
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
  it("for a service that asks no address, sends none and asks for none (the address fix)", () => {
    const noAddress = { ...choice, addressMode: "not_asked" as const };
    const read = readBookingForm({ ...filledForm, location: "" }, business, noAddress);

    expect(read.state).toBe("ok");
    expect(read.state === "ok" && read.request).not.toHaveProperty("location");
  });

  it("for a service that asks, an empty address is said under Address", () => {
    const read = readBookingForm({ ...filledForm, location: " " }, business, choice);

    expect(read).toEqual({
      state: "errors",
      errors: [{ field: "location", message: "Enter the address." }],
    });
  });

  it("sends the form as the route reads it: trimmed, empty boxes left out, every question shown, any available as no person", () => {
    const read = readBookingForm(filledForm, business, choice);

    expect(read).toEqual({
      state: "ok",
      request: {
        bookingLinkId: "facial",
        startsAt: "2026-10-14T16:00:00.000Z",
        requestKey: filledForm.requestKey,
        customer: { name: "Jane Doe", email: undefined, phone: "403 555 0100" },
        location: "12 Elm Street",
        details: undefined,
        answers: [
          { questionId: "q-colour", question: "Which colour?", answer: "Blue" },
          { questionId: "q-pets", question: "Any pets?", answer: "" },
        ],
      },
    });
  });

  it("sends the picked person when there is one", () => {
    const read = readBookingForm(filledForm, business, { ...choice, personId: "ana" });

    expect(read.state === "ok" && read.request.personId).toBe("ana");
  });

  it("asks for an email or a phone under the email when both are empty", () => {
    const read = readBookingForm({ ...filledForm, phone: "" }, business, choice);

    expect(read).toEqual({
      state: "errors",
      errors: [
        { field: "email", message: "Enter an email or a phone number. At least one is required." },
      ],
    });
  });

  it("says a wrong email under the email", () => {
    const read = readBookingForm({ ...filledForm, email: "jane@" }, business, choice);

    expect(read).toEqual({
      state: "errors",
      errors: [{ field: "email", message: "Enter a valid email address." }],
    });
  });

  it("lists every error in the form's order, a required question left empty among them", () => {
    const read = readBookingForm(
      { ...filledForm, name: "  ", location: "", answers: { "q-colour": " " } },
      business,
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

  it("ties each answer's error to its own question, in the business's order", () => {
    // The second question is answered too long, the first left empty: each error is its own.
    const read = readBookingForm(
      { ...filledForm, answers: { "q-colour": "", "q-pets": "x".repeat(501) } },
      business,
      choice
    );

    expect(read).toEqual({
      state: "errors",
      errors: [
        { field: "answer:q-colour", message: "Answer this question." },
        { field: "answer:q-pets", message: "Keep each answer to 500 characters." },
      ],
    });
  });

  it("ties a too-long answer to its own question when every question is answered", () => {
    const read = readBookingForm(
      { ...filledForm, answers: { "q-colour": "Blue", "q-pets": "x".repeat(501) } },
      business,
      choice
    );

    expect(read).toEqual({
      state: "errors",
      errors: [{ field: "answer:q-pets", message: "Keep each answer to 500 characters." }],
    });
    // And the first of the two, so neither end of the list can stand in for the other.
    expect(
      readBookingForm(
        { ...filledForm, answers: { "q-colour": "x".repeat(501), "q-pets": "Yes" } },
        business,
        choice
      )
    ).toEqual({
      state: "errors",
      errors: [{ field: "answer:q-colour", message: "Keep each answer to 500 characters." }],
    });
  });

  it("says a part no field shows as the form's own error: more answers than the route takes", () => {
    const many = Array.from({ length: 21 }, (_, n) => ({
      id: `q-${n}`,
      label: "?",
      required: false,
    }));
    const answers = Object.fromEntries(many.map((question) => [question.id, "Yes"]));

    expect(
      readBookingForm({ ...filledForm, answers }, { ...business, questions: many }, choice)
    ).toEqual({
      state: "errors",
      errors: [{ field: "form", message: "That is too many answers." }],
    });
  });

  it("sends a tick for later texts, and nothing at all without one (decision 13)", () => {
    const ticked = readBookingForm({ ...filledForm, laterTextsYes: true }, business, choice);
    const unticked = readBookingForm(filledForm, business, choice);

    expect(ticked.state === "ok" && ticked.request.laterTextsYes).toBe(true);
    expect(unticked.state === "ok" && "laterTextsYes" in unticked.request).toBe(false);
  });

  it("says under Phone when a tick has no phone that can get texts", () => {
    for (const phone of ["", "555 0100"]) {
      expect(
        readBookingForm(
          { ...filledForm, email: "jane@example.com", phone, laterTextsYes: true },
          business,
          choice
        )
      ).toEqual({
        state: "errors",
        errors: [{ field: "phone", message: "Enter a phone that can get texts." }],
      });
    }
  });

  // Feature 12f: the business's contact rule and the service's address choice, as the route checks.
  it("for a business that requires a phone, an email alone is said under Phone", () => {
    const phoneOnly = { ...business, contactRule: "phone" as const };
    const read = readBookingForm(
      { ...filledForm, email: "jane@example.com", phone: "" },
      phoneOnly,
      choice
    );

    expect(read).toEqual({
      state: "errors",
      errors: [{ field: "phone", message: "Enter a phone number." }],
    });
  });

  it("for a service where the address is optional, sends it only when written", () => {
    const optional = { ...choice, addressMode: "optional" as const };
    const empty = readBookingForm({ ...filledForm, location: " " }, business, optional);
    const written = readBookingForm(filledForm, business, optional);

    expect(empty.state === "ok" && empty.request.location).toBeUndefined();
    expect(written.state === "ok" && written.request.location).toBe("12 Elm Street");
  });

  it("gives each new form its own key, of the shape the route takes", () => {
    const first = newBookingForm().requestKey;
    const second = newBookingForm().requestKey;

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
  });
});
