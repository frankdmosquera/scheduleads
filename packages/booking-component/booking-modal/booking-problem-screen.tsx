// Booking component: the window when it cannot go on. Never a dead end: Try again when trying
// again can help, and the business's phone whenever it is known.

import { telHref } from "@scheduleads-app/shared/tel-href";

import type { BookingBusinessType } from "../api-client/booking-api-types.js";
import type { BookingProblemType } from "../api-client/booking-problem-for.js";

// The words Frank agreed at step 9.4's plan (2026-10-09).
const problemWords: Record<BookingProblemType, string> = {
  "nothing-to-book": "Nothing can be booked online right now.",
  "cannot-load": "Booking couldn't load right now.",
  "too-many-tries": "Too many tries. Wait a few minutes.",
};

export type BookingProblemScreenPropsType = {
  problem: BookingProblemType;
  business: BookingBusinessType | null;
  retry: (() => void) | null;
  titleId: string;
};

export function BookingProblemScreen({
  problem,
  business,
  retry,
  titleId,
}: BookingProblemScreenPropsType) {
  const phone = business?.phone ?? null;

  return (
    <>
      <div className="sa-head">
        <h2 className="sa-title" id={titleId} tabIndex={-1}>
          {business ? `Book with ${business.name}` : "Book online"}
        </h2>
      </div>
      <div className="sa-body">
        <div className="sa-problem">
          <p className="sa-problem-words" role="alert">
            {problemWords[problem]}
          </p>
          {(retry || phone) && (
            <div className="sa-actions">
              {retry && (
                <button type="button" className="sa-go" onClick={retry}>
                  Try again
                </button>
              )}
              {phone && (
                <a className="sa-call" href={telHref(phone)}>
                  Call {phone}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
