// Frontend component: the upcoming bookings a save of hours left outside them, under the card that
// saved. Nothing about them changed; each opens its lead, so the owner can call the customer.

import Link from "next/link";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import type { SavedBusinessHoursType } from "@/lib/api-client/settings/save-business-hours";

export type OutsideHoursListType = {
  bookings: SavedBusinessHoursType["outsideHours"];
  timezone: string; // the business's, so times read as the customer was told them
};

export function OutsideHoursList({
  list,
  Heading, // one level under the card's own title
}: {
  list: OutsideHoursListType | null;
  Heading: "h3" | "h4";
}) {
  if (!list || list.bookings.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-[var(--wait)] bg-[var(--wait-soft)] p-4">
      <Heading className="text-sm font-semibold text-foreground">
        These bookings now sit outside your hours
      </Heading>
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
