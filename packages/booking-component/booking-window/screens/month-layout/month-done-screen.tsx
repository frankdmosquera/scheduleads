// Booking component: the month layout's last screen, after Book. Everything on it is the route's
// own answer: the service, the time written by the API with its zone, the person.

import type {
  BookingBusinessType,
  BookingMadeType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import { useBookingWords } from "../../../words/booking-words-context.js";
import { MonthRail } from "./month-rail.js";

export type MonthDoneScreenPropsType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  booking: BookingMadeType;
  email: string | null; // the address the confirmation goes to, when she gave one
  titleId: string;
};

export function MonthDoneScreen({
  business,
  service,
  booking,
  email,
  titleId,
}: MonthDoneScreenPropsType) {
  const words = useBookingWords();
  return (
    <div className="sa-book">
      <MonthRail business={business} service={service} back={null} />

      <div className="sa-panel sa-done">
        <h2 className="sa-panel-h" id={titleId} tabIndex={-1}>
          {words.youreBooked}
        </h2>
        <div className="sa-facts">
          <div className="sa-fact">
            <span className="sa-fact-i" aria-hidden="true">
              &#10003;
            </span>
            <span>{booking.service.name}</span>
          </div>
          <div className="sa-fact sa-fact--picked">
            <span className="sa-fact-i" aria-hidden="true">
              &#128197;
            </span>
            <span>{booking.when}</span>
          </div>
          <div className="sa-fact">
            <span className="sa-fact-i" aria-hidden="true">
              &#128100;
            </span>
            <span>{words.withPerson(booking.person.name)}</span>
          </div>
        </div>
        {email && (
          <>
            <p className="sa-fine">{words.confirmationOnItsWay(email)}</p>
            <p className="sa-fine">{words.checkSpamFolder}</p>
          </>
        )}
      </div>
    </div>
  );
}
