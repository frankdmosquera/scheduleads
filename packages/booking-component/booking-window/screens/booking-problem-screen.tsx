// Booking component: the whole window when it cannot go on, with the business's name when it is
// known.

import type { BookingBusinessType } from "../../api-client/booking-api-types.js";
import type { BookingProblemType } from "../../api-client/problem-from-api-answer.js";
import { useBookingWords } from "../../words/booking-words-context.js";
import { ProblemMessage } from "./problem-message.js";

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
  const words = useBookingWords();
  return (
    <>
      <div className="sa-head">
        <h2 className="sa-title" id={titleId} tabIndex={-1}>
          {business ? words.bookWith(business.name) : words.bookOnline}
        </h2>
      </div>
      <div className="sa-body">
        <ProblemMessage
          words={words.problems[problem]}
          retry={retry}
          phone={business?.phone ?? null}
        />
      </div>
    </>
  );
}
