// Booking component: after a 201, the site hears of it, then the visitor stays on the confirmation or
// goes to the site's page. Shared by the window and a page calendar that books on the spot (13c.3).

import type { BookingMadeType } from "../api-client/booking-api-types.js";
import type { AfterBookingType, BookedType } from "./after-booking-type.js";

export type ReportBookedType = {
  afterBooking: AfterBookingType;
  onBooked: ((booked: BookedType) => void) | undefined;
  goTo(address: string): void; // the browser's own navigation; a test hands its own
};

// The confirmation shows either way, so nothing waits on a blank form while the browser leaves. A
// throwing onBooked still sends the visitor on (a broken count must not cost the thank-you page); a
// throwing redirectTo leaves them on the confirmation. Never a second booking.
export function reportBooked(
  booking: BookingMadeType,
  { afterBooking, onBooked, goTo }: ReportBookedType
): void {
  const made: BookedType = {
    bookingId: booking.id,
    serviceName: booking.service.name,
    startsAt: booking.startsAt,
    timeZone: booking.timezone,
  };
  try {
    onBooked?.(made);
  } catch (error) {
    console.error("The site's onBooked failed:", error);
  }
  if (afterBooking === "stay") return;
  try {
    const { redirectTo } = afterBooking;
    goTo(typeof redirectTo === "function" ? redirectTo(made) : redirectTo);
  } catch (error) {
    console.error("The site's redirectTo failed:", error);
  }
}
