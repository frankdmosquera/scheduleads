// Booking component: screen two's form read into what Book sends, checked with the same shared
// schema the route checks, before anything is sent. Every error is tied to its field, in the
// form's own order, so the first one is where focus goes.

import { createBookingValidationSchema } from "@scheduleads-app/shared/zod-validation";

import type {
  BookingBusinessType,
  BookingRequestType,
} from "../../api-client/booking-api-types.js";
import type {
  BookingFormErrorType,
  BookingFormFieldType,
  BookingFormValuesType,
} from "./booking-form-values-type.js";

export type BookingFormChoiceType = {
  bookingLinkId: string;
  startsAt: string;
  personId: string | null; // null = any available
  asksAddress: boolean; // the service's own setting: no address box, and none sent, when false
};

export type ReadBookingFormResultType =
  | { state: "ok"; request: BookingRequestType }
  | { state: "errors"; errors: BookingFormErrorType[] };

const answerNeeded = "Answer this question.";

// A box left empty is not sent: an empty email is no email, not a wrong one.
const filled = (text: string) => (text.trim() === "" ? undefined : text.trim());

export function readBookingForm(
  values: BookingFormValuesType,
  questions: BookingBusinessType["questions"],
  choice: BookingFormChoiceType
): ReadBookingFormResultType {
  const answered = questions.filter((question) => filled(values.answers[question.id] ?? ""));
  const request = {
    bookingLinkId: choice.bookingLinkId,
    startsAt: choice.startsAt,
    ...(choice.personId === null ? {} : { personId: choice.personId }),
    requestKey: values.requestKey,
    customer: {
      name: values.name.trim(),
      email: filled(values.email),
      phone: filled(values.phone),
    },
    ...(choice.asksAddress ? { location: values.location.trim() } : {}), // empty: "Enter the address."
    details: filled(values.details),
    answers: answered.map((question) => ({
      questionId: question.id,
      answer: (values.answers[question.id] ?? "").trim(),
    })),
    ...(values.laterTextsYes ? { laterTextsYes: true } : {}), // no tick: nothing sent
  };

  const found = new Map<BookingFormFieldType, string>();
  const parsed = createBookingValidationSchema.safeParse(request);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = fieldOf(issue.path, answered) ?? "form";
      if (!found.has(field)) found.set(field, issue.message);
    }
  }
  // The route asks for a required question's answer too; here it is said before sending.
  for (const question of questions) {
    const field: BookingFormFieldType = `answer:${question.id}`;
    if (question.required && !filled(values.answers[question.id] ?? "") && !found.has(field)) {
      found.set(field, answerNeeded);
    }
  }

  if (found.size === 0) return { state: "ok", request };
  const order: BookingFormFieldType[] = [
    "name",
    "email",
    "phone",
    "location",
    "details",
    ...questions.map((question) => `answer:${question.id}` as const),
    "form",
  ];
  return {
    state: "errors",
    errors: order
      .filter((field) => found.has(field))
      .map((field) => ({ field, message: found.get(field) ?? "" })),
  };
}

// The field a schema issue is about; null for a part no field shows (the time, the service, the
// number of answers).
function fieldOf(
  path: PropertyKey[],
  answered: BookingBusinessType["questions"]
): BookingFormFieldType | null {
  const [first, second] = path;
  if (first === "customer" && (second === "name" || second === "email" || second === "phone")) {
    return second;
  }
  if (first === "location" || first === "details") return first;
  if (first === "answers" && typeof second === "number") {
    const question = answered[second];
    return question ? `answer:${question.id}` : null;
  }
  return null;
}
