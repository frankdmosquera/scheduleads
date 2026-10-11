// Frontend component: the bookings left on a day just closed (feature 12e), still booked, each
// with Cancel, and Cancel all. A cancel reaches the customer, so each asks first, in place.

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatBookingTime } from "@scheduleads-app/shared/booking-time";

import type { ListedBookingsType } from "@/components/settings/listed-bookings";
import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { cancelBookings } from "@/lib/api-client/bookings/cancel-bookings";

const ALL = "all"; // never a booking's id, which is a UUID
const HEADING_ID = "closed-day-bookings-title";

export function ClosedDayBookings({
  list,
  onCancelled,
}: {
  list: ListedBookingsType;
  onCancelled: () => void; // the page's own "N bookings stay" is out of date once one goes
}) {
  const [bookings, setBookings] = useState(list.bookings);
  const [asking, setAsking] = useState<string | null>(null); // a booking's id, or ALL
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  // An irreversible question starts on its safe answer, so Enter never cancels by surprise.
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (asking) keepRef.current?.focus();
  }, [asking]);

  if (bookings.length === 0 && !notice) return null;

  async function cancel(bookingIds: string[]) {
    setBusy(true);
    const result = await cancelBookings(bookingIds);
    setBusy(false);
    setAsking(null);
    if (result.state !== "ok") {
      setNotice({ tone: "error", text: result.message });
      return;
    }
    const { cancelled, alreadyCancelled, alreadyStarted } = result.answer;
    const gone = new Set([...cancelled, ...alreadyCancelled]);
    const started = bookings.filter((booking) => alreadyStarted.includes(booking.bookingId));
    setBookings((current) => current.filter((booking) => !gone.has(booking.bookingId)));
    const count = gone.size;
    if (count) onCancelled();
    setNotice({
      tone: started.length ? "error" : "info",
      text: [
        count ? `Cancelled ${count === 1 ? "one booking" : `${count} bookings`}.` : "",
        ...started.map(
          (booking) =>
            `${booking.customerName}'s booking has already started, so it was not cancelled.`
        ),
      ]
        .filter(Boolean)
        .join(" "),
    });
    document.getElementById(HEADING_ID)?.focus(); // the button pressed may be gone
  }

  const question = (text: string, yes: string, bookingIds: string[]) => (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-card p-3">
      <p className="text-sm text-foreground">{text}</p>
      <Button size="sm" variant="destructive" disabled={busy} onClick={() => cancel(bookingIds)}>
        {busy ? "Cancelling…" : yes}
      </Button>
      <Button
        ref={keepRef}
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setAsking(null)}
      >
        Keep
      </Button>
    </div>
  );

  return (
    <div className="mt-4 rounded-lg border border-[var(--wait)] bg-[var(--wait-soft)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          id={HEADING_ID}
          tabIndex={-1}
          className="text-sm font-semibold text-foreground outline-none"
        >
          Bookings on the day you closed
        </h3>
        {bookings.length > 1 && asking !== ALL ? (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setAsking(ALL)}>
            Cancel all
          </Button>
        ) : null}
      </div>
      {bookings.length ? (
        <p className="mt-1 text-sm text-muted-foreground">
          Still booked. Keep them, or cancel them: each customer is told as if they had cancelled.
        </p>
      ) : null}
      {asking === ALL
        ? question(
            `Cancel all ${bookings.length} bookings? Each customer gets the cancellation email.`,
            "Cancel all",
            bookings.map((booking) => booking.bookingId)
          )
        : null}
      <SaveNotice notice={notice} />
      <ul className="mt-3 flex flex-col gap-2">
        {bookings.map((booking) => (
          <li key={booking.bookingId} className="text-sm">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={`/leads/${booking.leadId}`}
                className="font-medium text-foreground underline underline-offset-2"
              >
                {booking.customerName}
              </Link>
              <span className="text-muted-foreground">
                &middot; {booking.serviceName} with {booking.personName} &middot;{" "}
                {formatBookingTime(new Date(booking.startsAt), list.timezone)}
              </span>
              {asking !== booking.bookingId ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  aria-label={`Cancel ${booking.customerName}'s booking`}
                  onClick={() => setAsking(booking.bookingId)}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
            {asking === booking.bookingId
              ? question(
                  `Cancel ${booking.customerName}'s booking? ${booking.customerName} gets the cancellation email.`,
                  "Cancel the booking",
                  [booking.bookingId]
                )
              : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
