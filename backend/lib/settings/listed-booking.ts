// Backend: one upcoming booking as a Settings answer lists it, still booked: one a save of hours
// left outside them (12a), one held by a person or place just turned off (12d), or one on a day just
// closed (12e).

import type { UpcomingBookingType } from "./find-upcoming-bookings.js";

export type ListedBookingType = {
  bookingId: string;
  leadId: string;
  customerName: string;
  customerHasEmail: boolean; // whether a cancel can reach them by email; never the address itself
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
    customerHasEmail: upcoming.customerEmail !== null,
    serviceName: upcoming.serviceName,
    personName: upcoming.personName,
    startsAt: upcoming.startsAt.toISOString(),
    endsAt: upcoming.endsAt.toISOString(),
  };
}
