// Backend: one upcoming booking as a Settings answer lists it, still booked: one a save of hours
// left outside them (12a), or one held by a person or place just turned off (12d).

import type { UpcomingBookingType } from "./find-upcoming-bookings.js";

export type ListedBookingType = {
  bookingId: string;
  leadId: string;
  customerName: string;
  serviceName: string;
  personName: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
};

export function listedBookingOf(upcoming: UpcomingBookingType): ListedBookingType {
  return {
    bookingId: upcoming.bookingId,
    leadId: upcoming.leadId,
    customerName: upcoming.customerName,
    serviceName: upcoming.serviceName,
    personName: upcoming.personName,
    startsAt: upcoming.startsAt.toISOString(),
    endsAt: upcoming.endsAt.toISOString(),
  };
}
