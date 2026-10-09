// Booking component: the whole window when it cannot go on, with the business's name when it is
// known.

import type { BookingBusinessType } from "../../api-client/booking-api-types.js";
import type { BookingProblemType } from "../../api-client/problem-from-api-answer.js";
import { ProblemMessage } from "./problem-message.js";
import { problemWords } from "./problem-words.js";

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
  return (
    <>
      <div className="sa-head">
        <h2 className="sa-title" id={titleId} tabIndex={-1}>
          {business ? `Book with ${business.name}` : "Book online"}
        </h2>
      </div>
      <div className="sa-body">
        <ProblemMessage
          words={problemWords[problem]}
          retry={retry}
          phone={business?.phone ?? null}
        />
      </div>
    </>
  );
}
