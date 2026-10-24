// Booking component: the window while its first answer is on the way (10 seconds at most).

import { useBookingWords } from "../../words/booking-words-context.js";

export type LoadingScreenPropsType = { titleId: string };

export function LoadingScreen({ titleId }: LoadingScreenPropsType) {
  const words = useBookingWords();
  return (
    <>
      <div className="sa-head">
        <h2 className="sa-title" id={titleId} tabIndex={-1}>
          {words.bookOnline}
        </h2>
      </div>
      <div className="sa-body">
        <p className="sa-loading" role="status">
          {words.loading}
        </p>
      </div>
    </>
  );
}
