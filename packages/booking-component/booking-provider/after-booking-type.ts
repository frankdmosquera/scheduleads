// Booking component: what a host site hears when a booking is made, and where the visitor goes
// next (feature 12i). Nothing about the customer is ever handed to the site.

export type BookedType = {
  bookingId: string;
  serviceName: string;
  startsAt: string; // ISO 8601 instant
  timeZone: string; // the business's IANA zone
};

// "stay": the window's own confirmation. redirectTo: the site's page, or a function that builds
// its address from the booking (a thank-you page with the time in its address, say).
export type AfterBookingType = "stay" | { redirectTo: string | ((booked: BookedType) => string) };
