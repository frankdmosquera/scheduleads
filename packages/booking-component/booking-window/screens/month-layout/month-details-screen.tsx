// Booking component: the month layout's screen two. The rail keeps whose booking and what, and
// gains the picked time, so it is never off screen; the panel's questions come in step 9.6.

import type {
  BookingAvailabilityType,
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import type { ChosenTimeType } from "../../booking-screen-type.js";
import { formatDayName } from "../../month-calendar/format-day-name.js";
import { formatZoneName } from "../../month-calendar/format-zone-name.js";
import { MonthRail } from "./month-rail.js";

export type MonthDetailsScreenPropsType = {
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  availability: BookingAvailabilityType;
  chosen: ChosenTimeType;
  titleId: string;
  onBack(): void;
};

export function MonthDetailsScreen({
  business,
  service,
  availability,
  chosen,
  titleId,
  onBack,
}: MonthDetailsScreenPropsType) {
  const timeZone = availability.timezone;
  const day = formatDayName(chosen.date);

  return (
    <div className="sa-book">
      <MonthRail
        business={business}
        service={service}
        back={{ label: "Back to the times", onBack }}
      >
        <div className="sa-facts">
          <div className="sa-fact sa-fact--picked">
            <span className="sa-fact-i" aria-hidden="true">
              &#128197;
            </span>
            <span>
              {chosen.time}, {day}
              <br />
              {formatZoneName(timeZone)}
            </span>
          </div>
          {chosen.personName && (
            <div className="sa-fact">
              <span className="sa-fact-i" aria-hidden="true">
                &#128100;
              </span>
              <span>With {chosen.personName}</span>
            </div>
          )}
        </div>
      </MonthRail>

      <div className="sa-panel">
        <h2 className="sa-panel-h" id={titleId} tabIndex={-1}>
          Your details
        </h2>
      </div>
    </div>
  );
}
