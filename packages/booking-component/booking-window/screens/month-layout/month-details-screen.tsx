// Booking component: the month layout's screen two. The rail keeps whose booking and what, and
// gains the picked time, so it is never off screen; the panel holds the customer's details and Book.

"use client";

import { useState } from "react";

import type {
  BookingApiClientType,
  BookingAvailabilityType,
  BookingBusinessType,
  BookingMadeType,
  BookingServiceDetailsType,
} from "../../../api-client/booking-api-types.js";
import type { BookingFormValuesType } from "../../booking-form/booking-form-values-type.js";
import type { ChosenTimeType } from "../../booking-screen-type.js";
import { formatDayName } from "../../month-calendar/format-day-name.js";
import { formatZoneName } from "../../month-calendar/format-zone-name.js";
import { BookingFormView } from "../booking-form-view.js";
import { MonthRail } from "./month-rail.js";

export type MonthDetailsScreenPropsType = {
  apiClient: BookingApiClientType;
  slug: string;
  business: BookingBusinessType;
  service: BookingServiceDetailsType;
  availability: BookingAvailabilityType;
  chosen: ChosenTimeType;
  form: BookingFormValuesType;
  titleId: string;
  onFormChange(form: BookingFormValuesType): void;
  onBack(): void;
  onBooked(booking: BookingMadeType, email: string | null): void;
  onTimeTaken(message: string): void;
};

export function MonthDetailsScreen({
  apiClient,
  slug,
  business,
  service,
  availability,
  chosen,
  form,
  titleId,
  onFormChange,
  onBack,
  onBooked,
  onTimeTaken,
}: MonthDetailsScreenPropsType) {
  const day = formatDayName(chosen.date);
  // No Back while a lost answer is unknown: another time with the same form could book her twice.
  const [unsure, setUnsure] = useState(false);

  return (
    <div className="sa-book">
      <MonthRail
        business={business}
        service={service}
        back={unsure ? null : { label: "Back to the times", onBack }}
      >
        <div className="sa-facts">
          <div className="sa-fact sa-fact--picked">
            <span className="sa-fact-i" aria-hidden="true">
              &#128197;
            </span>
            <span>
              {chosen.time}, {day}
              <br />
              {formatZoneName(availability.timezone)}
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
        <BookingFormView
          apiClient={apiClient}
          slug={slug}
          business={business}
          choice={{
            bookingLinkId: service.id,
            startsAt: chosen.startsAt,
            personId: chosen.personId,
          }}
          form={form}
          onFormChange={onFormChange}
          onBooked={onBooked}
          onTimeTaken={onTimeTaken}
          onUnsureChange={setUnsure}
        />
      </div>
    </div>
  );
}
