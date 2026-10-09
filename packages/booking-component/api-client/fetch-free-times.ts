// Booking component: a service's free start times for some dates (31 at most), with one person or
// any available, and the people the customer may pick from.

import type { BookingApiClientType, BookingFreeTimesType } from "./booking-api-types.js";
import { problemFromApiAnswer, type BookingProblemType } from "./problem-from-api-answer.js";

export type FreeTimesQuestionType = {
  from: string; // YYYY-MM-DD in the business's zone
  to: string;
  personId: string | null; // null = any available
};

export type FreeTimesResultType =
  | { state: "ok"; freeTimes: BookingFreeTimesType }
  // A calendar could not be read (503), in the route's own words.
  | { state: "times-unreadable"; message: string }
  | { state: "problem"; problem: BookingProblemType };

const timesUnreadableWords = "Times cannot be read right now. Try again shortly.";

export async function fetchFreeTimes(
  apiClient: BookingApiClientType,
  slug: string,
  bookingLinkId: string,
  question: FreeTimesQuestionType
): Promise<FreeTimesResultType> {
  // Hono's client drops an empty segment, so a blank value would ask another route (F-278).
  if (slug.trim() === "" || bookingLinkId.trim() === "") {
    return { state: "problem", problem: "nothing-to-book" };
  }

  try {
    const response = await apiClient.public[":slug"]["booking-links"][":bookingLinkId"].times.$get({
      param: { slug: encodeURIComponent(slug), bookingLinkId: encodeURIComponent(bookingLinkId) },
      query: {
        from: question.from,
        to: question.to,
        ...(question.personId === null ? {} : { person: question.personId }),
      },
    });
    const status: number = response.status; // the rate limit's 429 is not in the route's type
    if (response.status === 503) {
      const answer = await response.json().catch(() => null);
      return { state: "times-unreadable", message: answer?.error?.message ?? timesUnreadableWords };
    }
    if (response.status !== 200) return { state: "problem", problem: problemFromApiAnswer(status) };

    const freeTimes = await response.json();
    // Never trusted blindly: an answer without its times would crash the calendar.
    if (!freeTimes || !Array.isArray(freeTimes.startTimes) || !Array.isArray(freeTimes.people)) {
      return { state: "problem", problem: problemFromApiAnswer(null) };
    }
    return { state: "ok", freeTimes };
  } catch {
    return { state: "problem", problem: problemFromApiAnswer(null) };
  }
}
