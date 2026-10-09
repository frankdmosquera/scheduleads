// Booking component: screen two's form and Book, the same in every layout. Checked before sending;
// each error under its field, focus on the first, cleared as that field is edited. Book locks after
// one press and sends the form's key, so pressing again, or Try again after a lost connection,
// never makes a second booking (decision 9). Everything typed is shown as text, never as markup.

"use client";

import { useId, useRef, useState, type ReactNode } from "react";

import type {
  BookingApiClientType,
  BookingBusinessType,
  BookingMadeType,
} from "../../api-client/booking-api-types.js";
import { sendBooking } from "../../api-client/send-booking.js";
import type {
  BookingFormErrorType,
  BookingFormFieldType,
  BookingFormValuesType,
} from "../booking-form/booking-form-values-type.js";
import { readBookingForm, type BookingFormChoiceType } from "../booking-form/read-booking-form.js";
import { ProblemMessage } from "./problem-message.js";
import { problemWords } from "./problem-words.js";

export type BookingFormViewPropsType = {
  apiClient: BookingApiClientType;
  slug: string;
  business: BookingBusinessType;
  choice: BookingFormChoiceType;
  form: BookingFormValuesType;
  onFormChange(form: BookingFormValuesType): void;
  onBooked(booking: BookingMadeType, email: string | null): void;
  onTimeTaken(message: string): void;
};

type SendProblemType = { words: string; retry: boolean };

const noAnswerWords =
  "We couldn't reach the booking just now. Your choice is kept: try again, it never books twice.";

export function BookingFormView({
  apiClient,
  slug,
  business,
  choice,
  form,
  onFormChange,
  onBooked,
  onTimeTaken,
}: BookingFormViewPropsType) {
  const idPrefix = useId();
  const idOf = (field: BookingFormFieldType) => `${idPrefix}-${field.replace(":", "-")}`;
  const [errors, setErrors] = useState<BookingFormErrorType[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<SendProblemType | null>(null);
  // Locks at the press itself: a second click before the screen redraws must not send again.
  const sendingNow = useRef(false);

  const errorOf = (field: BookingFormFieldType) =>
    errors.find((error) => error.field === field)?.message ?? null;

  const edit = (fields: BookingFormFieldType[], next: BookingFormValuesType) => {
    onFormChange(next);
    if (errors.some((error) => fields.includes(error.field))) {
      setErrors(errors.filter((error) => !fields.includes(error.field)));
    }
  };

  async function book() {
    if (sendingNow.current) return;
    const read = readBookingForm(form, business.questions, choice);
    if (read.state === "errors") {
      setErrors(read.errors);
      setProblem(null);
      const first = read.errors[0];
      if (first) document.getElementById(idOf(first.field))?.focus();
      return;
    }

    sendingNow.current = true;
    setSending(true);
    setProblem(null);
    const answer = await sendBooking(apiClient, slug, read.request);
    sendingNow.current = false;
    setSending(false);

    switch (answer.state) {
      case "booked":
        onBooked(answer.booking, read.request.customer.email ?? null);
        return;
      case "time-taken":
        onTimeTaken(answer.message);
        return;
      case "refused":
        setProblem({ words: answer.message, retry: answer.canRetry });
        return;
      case "problem":
        setProblem({
          words: problemWords[answer.problem],
          retry: answer.problem !== "nothing-to-book",
        });
        return;
      case "no-answer":
        setProblem({ words: noAnswerWords, retry: true });
        return;
    }
  }

  // One field: its label, its box, then its hint and its error, both read out with it.
  const field = (
    name: BookingFormFieldType,
    label: string,
    required: boolean,
    box: (props: {
      id: string;
      "aria-invalid": boolean;
      "aria-describedby": string | undefined;
      className: string;
    }) => ReactNode,
    hint?: string
  ) => {
    const id = idOf(name);
    const error = errorOf(name);
    const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ");
    return (
      <div key={name}>
        <label className={required ? "sa-flab sa-req" : "sa-flab"} htmlFor={id}>
          {label}
        </label>
        {box({
          id,
          "aria-invalid": error !== null,
          "aria-describedby": described || undefined,
          className: "sa-f",
        })}
        {hint && (
          <p className="sa-hint" id={`${id}-hint`}>
            {hint}
          </p>
        )}
        {error && (
          <p className="sa-err" id={`${id}-error`}>
            {error}
          </p>
        )}
      </div>
    );
  };

  return (
    <form
      className="sa-form"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void book();
      }}
    >
      {field("name", "Name", true, (props) => (
        <input
          {...props}
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(event) => edit(["name"], { ...form, name: event.target.value })}
        />
      ))}
      {field(
        "email",
        "Email",
        false,
        (props) => (
          <input
            {...props}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(event) => edit(["email", "phone"], { ...form, email: event.target.value })}
          />
        ),
        "An email or a phone. At least one is required."
      )}
      {field(
        "phone",
        "Phone",
        false,
        (props) => (
          <input
            {...props}
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => edit(["email", "phone"], { ...form, phone: event.target.value })}
          />
        ),
        "An email or a phone. At least one is required."
      )}
      {field("location", "Address", true, (props) => (
        <input
          {...props}
          type="text"
          autoComplete="street-address"
          value={form.location}
          onChange={(event) => edit(["location"], { ...form, location: event.target.value })}
        />
      ))}
      {field("details", "What would you like done?", false, (props) => (
        <textarea
          {...props}
          rows={3}
          value={form.details}
          onChange={(event) => edit(["details"], { ...form, details: event.target.value })}
        />
      ))}
      {business.questions.map((question) =>
        field(`answer:${question.id}`, question.label, question.required, (props) => (
          <input
            {...props}
            type="text"
            value={form.answers[question.id] ?? ""}
            onChange={(event) =>
              edit([`answer:${question.id}`], {
                ...form,
                answers: { ...form.answers, [question.id]: event.target.value },
              })
            }
          />
        ))
      )}

      {problem && (
        <ProblemMessage
          words={problem.words}
          retry={problem.retry ? () => void book() : null}
          phone={business.phone}
        />
      )}

      <button type="submit" className="sa-submit" disabled={sending} aria-busy={sending}>
        {sending ? "Booking…" : "Book"}
      </button>
    </form>
  );
}
