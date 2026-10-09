// Booking component: screen two's form and Book, the same in every layout. Checked before sending;
// each error under its field, focus on the first, cleared as that field is edited. Book locks after
// one press and sends the form's key, so pressing again, or Try again after a lost connection,
// never makes a second booking (decision 9). After a lost answer nothing can change until an answer
// comes. Everything typed is shown as text, never as markup.

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import type {
  BookingApiClientType,
  BookingBusinessType,
  BookingMadeType,
  BookingRequestType,
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
  onUnsureChange(unsure: boolean): void; // the screen hides its Back while a lost answer is unknown
};

type SendProblemType = { words: string; retry: boolean };

const noAnswerWords =
  "We couldn't hear back about your booking. It may have gone through: press Try again to find out. It never books twice.";
// While unsure, a limit reached still leaves her booking unknown, and says so.
const tooManyWhileUnsureWords =
  "Too many tries. Wait a few minutes, then press Try again to find out whether your booking went through. It never books twice.";

export function BookingFormView({
  apiClient,
  slug,
  business,
  choice,
  form,
  onFormChange,
  onBooked,
  onTimeTaken,
  onUnsureChange,
}: BookingFormViewPropsType) {
  const idPrefix = useId();
  const idOf = (field: BookingFormFieldType) => `${idPrefix}-${field.replace(":", "-")}`;
  const [errors, setErrors] = useState<BookingFormErrorType[]>([]);
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState<SendProblemType | null>(null);
  // Locks at the press itself: a second click before the screen redraws must not send again.
  const sendingNow = useRef(false);
  // No answer came back: until one comes nothing can be changed, so Try again sends the same
  // booking with the same key, and a booking made unseen is answered again, never made twice.
  const [unsure, setUnsure] = useState(false);
  // Try again removes itself as it sends, so a line takes its place, and the focus, until the answer.
  const [retrying, setRetrying] = useState(false);
  const waiting = sending && (unsure || retrying);
  // Focus never falls to the page: on the waiting line while Try again sends, and on the words
  // whenever a send ends with words on screen.
  const checkingRef = useRef<HTMLParagraphElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const [wordsShown, setWordsShown] = useState(0);
  useEffect(() => {
    if (waiting) checkingRef.current?.focus();
  }, [waiting]);
  useEffect(() => {
    if (wordsShown > 0) problemRef.current?.focus();
  }, [wordsShown]);
  const showWords = (shown: SendProblemType) => {
    setProblem(shown);
    setWordsShown((count) => count + 1);
  };

  const errorOf = (field: BookingFormFieldType) =>
    errors.find((error) => error.field === field)?.message ?? null;

  const edit = (fields: BookingFormFieldType[], next: BookingFormValuesType) => {
    onFormChange(next);
    if (errors.some((error) => fields.includes(error.field))) {
      setErrors(errors.filter((error) => !fields.includes(error.field)));
    }
  };

  async function book(fromRetry = false) {
    if (sendingNow.current) return;
    const read = readBookingForm(form, business.questions, choice);
    if (read.state === "errors") {
      const fieldErrors = read.errors.filter((error) => error.field !== "form");
      const formError = read.errors.find((error) => error.field === "form");
      setErrors(fieldErrors);
      // A part no field shows (too many answers): said with the phone, nothing is sent.
      setProblem(formError ? { words: formError.message, retry: false } : null);
      const first = fieldErrors[0];
      if (first) document.getElementById(idOf(first.field))?.focus();
      return;
    }
    await send(read.request, fromRetry);
  }

  async function send(request: BookingRequestType, fromRetry: boolean) {
    if (sendingNow.current) return;
    sendingNow.current = true;
    setSending(true);
    setRetrying(fromRetry);
    setProblem(null);
    const answer = await sendBooking(apiClient, slug, request);
    sendingNow.current = false;
    setSending(false);
    setRetrying(false);
    // The route's own answers about this form settle it: it looks the form's key up first. No
    // answer, or one the route did not write (a server fault, a proxy), may hide a booking made;
    // a "too many tries" may come before the look-up. Those freeze the form, or keep it frozen.
    const settled =
      answer.state === "booked" || answer.state === "time-taken" || answer.state === "refused";
    const unclear =
      answer.state === "no-answer" ||
      (answer.state === "problem" && answer.problem === "cannot-load");
    const nowUnsure = unsure ? !settled : unclear;
    setUnsure(nowUnsure);
    onUnsureChange(nowUnsure);

    switch (answer.state) {
      case "booked":
        onBooked(answer.booking, request.customer.email ?? null); // where the confirmation went
        return;
      case "time-taken":
        onTimeTaken(answer.message);
        return;
      case "refused":
        showWords({ words: answer.message, retry: answer.canRetry });
        return;
      case "problem":
        showWords({
          words: !nowUnsure
            ? problemWords[answer.problem]
            : answer.problem === "too-many-tries"
              ? tooManyWhileUnsureWords
              : noAnswerWords,
          retry: nowUnsure || answer.problem !== "nothing-to-book",
        });
        return;
      case "no-answer":
        showWords({ words: noAnswerWords, retry: true });
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
      <fieldset className="sa-fields" disabled={unsure}>
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
      </fieldset>

      {problem && (
        <div ref={problemRef} tabIndex={-1} className="sa-focus-place">
          <ProblemMessage
            words={problem.words}
            retry={problem.retry ? () => void book(true) : null}
            phone={business.phone}
          />
        </div>
      )}

      {!unsure && !waiting && (
        <button type="submit" className="sa-submit" disabled={sending} aria-busy={sending}>
          {sending ? "Booking…" : "Book"}
        </button>
      )}
      {waiting && (
        <p ref={checkingRef} tabIndex={-1} className="sa-loading sa-focus-place" role="status">
          {unsure ? "Checking your booking…" : "Booking…"}
        </p>
      )}
    </form>
  );
}
