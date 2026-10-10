// Frontend component: upcoming bookings a Settings save lists under its form, still booked: ones a
// save of hours left outside them (12a), or ones held by a person or place just turned off (12d).
// Each opens its lead, so the owner can call the customer.

import Link from "next/link";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import type { SavedBusinessHoursType } from "@/lib/api-client/settings/save-business-hours";

export type ListedBookingsType = {
  bookings: SavedBusinessHoursType["outsideHours"];
  timezone: string; // the business's, so times read as the customer was told them
};

export function ListedBookings({
  list,
  title,
  Heading, // one level under the form's own title
}: {
  list: ListedBookingsType | null;
  title: string;
  Heading: "h3" | "h4" | "h5";
}) {
  if (!list || list.bookings.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--wait)] bg-[var(--wait-soft)] p-4">
      <Heading className="text-sm font-semibold text-foreground">{title}</Heading>
      <p className="mt-1 text-sm text-muted-foreground">
        Still booked. Open a booking to call the customer.
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {list.bookings.map((booking) => (
          <li key={booking.bookingId} className="text-sm">
            <Link
              href={`/leads/${booking.leadId}`}
              className="font-medium text-foreground underline underline-offset-2"
            >
              {booking.customerName}
            </Link>{" "}
            <span className="text-muted-foreground">
              &middot; {booking.serviceName} with {booking.personName} &middot;{" "}
              {formatBookingTime(new Date(booking.startsAt), list.timezone)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
