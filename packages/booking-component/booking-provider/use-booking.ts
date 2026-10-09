// Booking component: open the booking window from a host's own control. With a booking id it opens
// straight on that service; without one, on the list.

"use client";

import { useContext, useMemo } from "react";

import { BookingContext } from "./booking-context.js";

export type UseBookingType = { open(bookingId?: string): void };

export function useBooking(): UseBookingType {
  const booking = useContext(BookingContext);
  if (!booking) throw new Error("useBooking() must be used inside <BookingProvider>.");

  return useMemo(
    () => ({
      // Focus returns to whatever had it when the window opened, usually the control pressed.
      open: (bookingId?: string) =>
        booking.openFrom(
          bookingId,
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        ),
    }),
    [booking]
  );
}
