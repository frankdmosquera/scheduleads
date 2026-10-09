// Booking component: Book. Sends the time, the customer and her answers with the form's key, and
// reads the route's answer. No answer at all is told apart from a refusal: the booking may or may
// not have been made, and sending again with the same key never makes a second one (decision 9).

import type {
  BookingApiClientType,
  BookingMadeType,
  BookingRequestType,
} from "./booking-api-types.js";
import { problemFromApiAnswer, type BookingProblemType } from "./problem-from-api-answer.js";

export type SendBookingResultType =
  | { state: "booked"; booking: BookingMadeType }
  // Booked by someone else while she typed (409): back to the times, in the route's own words.
  | { state: "time-taken"; message: string }
  // The words of a refusal the customer can act on: the form's key used, a missing answer (400),
  // a calendar that cannot be read (503).
  | { state: "refused"; message: string; canRetry: boolean }
  | { state: "problem"; problem: BookingProblemType }
  // The network or the time limit: nothing is known, so Try again sends the same form.
  | { state: "no-answer" };

const fallbackWords = {
  timeTaken: "Sorry, that time was taken while you were booking. Please pick another one.",
  refused: "That is not a valid booking.",
  unreadable: "Times cannot be read right now. Try again shortly.",
};

export async function sendBooking(
  apiClient: BookingApiClientType,
  slug: string,
  request: BookingRequestType
): Promise<SendBookingResultType> {
  // Hono's client drops an empty segment, so a blank value would reach another route (F-278).
  if (slug.trim() === "") return { state: "problem", problem: "nothing-to-book" };

  let response: Response;
  try {
    response = await apiClient.public[":slug"].bookings.$post({
      param: { slug: encodeURIComponent(slug) },
      json: request,
    });
  } catch {
    return { state: "no-answer" };
  }

  // Read loosely: the rate limit's 429 and a proxy's own pages are not in the route's type.
  const answer = (await response.json().catch(() => null)) as {
    booking?: BookingMadeType;
    error?: { code?: unknown; message?: unknown };
  } | null;
  const words = answer?.error?.message;
  const message = typeof words === "string" && words.trim() !== "" ? words : null;

  if (response.status === 201) {
    // Never trusted blindly: an answer without its booking would crash the done screen.
    const booking = answer?.booking;
    if (!booking || typeof booking.when !== "string" || !booking.service || !booking.person) {
      return { state: "problem", problem: problemFromApiAnswer(null) };
    }
    return { state: "booked", booking };
  }
  if (response.status === 409 && answer?.error?.code === "time_taken") {
    return { state: "time-taken", message: message ?? fallbackWords.timeTaken };
  }
  if (response.status === 409) {
    return { state: "refused", message: message ?? fallbackWords.refused, canRetry: false };
  }
  if (response.status === 400) {
    return { state: "refused", message: message ?? fallbackWords.refused, canRetry: false };
  }
  if (response.status === 503) {
    return { state: "refused", message: message ?? fallbackWords.unreadable, canRetry: true };
  }
  return { state: "problem", problem: problemFromApiAnswer(response.status) };
}
