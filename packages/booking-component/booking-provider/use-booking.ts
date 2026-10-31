// Booking component: open the booking window from a host's own control. With a booking id it opens
// straight on that service; without one, on the list; with a time picked on the page too, on its
// form with that time chosen (feature 13c).

"use client";

import { useContext, useMemo } from "react";

import { BookingContext, type PickedTimeType } from "./booking-context.js";

export type UseBookingType = { open(bookingId?: string, chosen?: PickedTimeType): void };

export function useBooking(): UseBookingType {
  const booking = useContext(BookingContext);
  if (!booking) throw new Error("useBooking() must be used inside <BookingProvider>.");

  return useMemo(
    () => ({
      // Focus returns to whatever had it when the window opened, usually the control pressed.
      open: (bookingId?: string, chosen?: PickedTimeType) =>
        booking.openFrom(
          bookingId,
          document.activeElement instanceof HTMLElement ? document.activeElement : null,
          chosen
        ),
    }),
    [booking]
  );
}
