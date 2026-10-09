// Booking component: one month's free times for the calendar, asked once per month and person,
// grouped by day in the business's zone. An answer for a month or person no longer shown is dropped.

"use client";

import { useCallback, useEffect, useState } from "react";

import type { BookingApiClientType } from "../../../api-client/booking-api-types.js";
import { fetchFreeTimes } from "../../../api-client/fetch-free-times.js";
import type { BookingProblemType } from "../../../api-client/problem-from-api-answer.js";
import { groupTimesByDay } from "../../month-calendar/group-times-by-day.js";

export type MonthTimesType =
  | { state: "loading" }
  | { state: "ok"; days: Map<string, string[]> }
  | { state: "times-unreadable"; message: string }
  | { state: "problem"; problem: BookingProblemType };

export type MonthTimesQuestionType = {
  apiClient: BookingApiClientType;
  slug: string;
  bookingLinkId: string;
  timeZone: string;
  dates: { from: string; to: string } | null; // null: nothing in this month can be booked
  personId: string | null;
};

export function useMonthTimes(question: MonthTimesQuestionType) {
  const { apiClient, slug, bookingLinkId, timeZone, dates, personId } = question;
  const from = dates?.from ?? null;
  const to = dates?.to ?? null;
  const [times, setTimes] = useState<MonthTimesType>({ state: "loading" });
  // The people the customer may pick, kept from the last answer so the list never blinks.
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [asks, setAsks] = useState(0); // Try again asks the same month once more

  useEffect(() => {
    if (from === null || to === null) {
      setTimes({ state: "ok", days: new Map() });
      return;
    }
    let live = true;
    setTimes({ state: "loading" });
    fetchFreeTimes(apiClient, slug, bookingLinkId, { from, to, personId }).then((answer) => {
      if (!live) return;
      if (answer.state !== "ok") {
        setTimes(answer);
        return;
      }
      const { startTimes, people: answeredPeople } = answer.freeTimes;
      setTimes({ state: "ok", days: groupTimesByDay(startTimes, timeZone) });
      setPeople(answeredPeople);
    });
    return () => {
      live = false;
    };
  }, [apiClient, slug, bookingLinkId, timeZone, from, to, personId, asks]);

  const askAgain = useCallback(() => setAsks((count) => count + 1), []);
  return { times, people, askAgain };
}
