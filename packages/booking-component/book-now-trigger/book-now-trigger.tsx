// Booking component: the host's "Book now" button. Unstyled: the host gives it its class and words.

"use client";

import { useContext, type ReactNode } from "react";

import { BookingContext } from "../booking-provider/booking-context.js";

export type BookNowTriggerPropsType = {
  bookingId?: string; // a service's id opens straight on it; none opens the list
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function BookNowTrigger({
  bookingId,
  className,
  ariaLabel,
  children,
}: BookNowTriggerPropsType) {
  const booking = useContext(BookingContext);
  if (!booking) throw new Error("<BookNowTrigger> must be used inside <BookingProvider>.");

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      // The button itself, not document.activeElement: Safari does not focus a clicked button.
      onClick={(event) => booking.openFrom(bookingId, event.currentTarget)}
    >
      {children}
    </button>
  );
}
