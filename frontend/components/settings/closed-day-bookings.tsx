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
const MOST_AT_ONCE = 100; // the API's cap on one request; Cancel all sends a longer list in parts
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
    const [cancelled, alreadyCancelled, alreadyStarted]: string[][] = [[], [], []];
    let refusal: string | null = null;
    for (let start = 0; start < bookingIds.length && !refusal; start += MOST_AT_ONCE) {
      const result = await cancelBookings(bookingIds.slice(start, start + MOST_AT_ONCE));
      if (result.state !== "ok") refusal = result.message;
      else {
        cancelled.push(...result.answer.cancelled);
        alreadyCancelled.push(...result.answer.alreadyCancelled);
        alreadyStarted.push(...result.answer.alreadyStarted);
      }
    }
    setBusy(false);
    setAsking(null);
    document.getElementById(HEADING_ID)?.focus(); // the button pressed is gone with its question
    const gone = new Set([...cancelled, ...alreadyCancelled]);
    const started = bookings.filter((booking) => alreadyStarted.includes(booking.bookingId));
    setBookings((current) => current.filter((booking) => !gone.has(booking.bookingId)));
    const count = gone.size;
    if (count) onCancelled();
    setNotice({
      tone: started.length || refusal ? "error" : "info",
      text: [
        count ? `Cancelled ${count === 1 ? "one booking" : `${count} bookings`}.` : "",
        refusal ?? "",
        ...started.map(
          (booking) =>
            `${booking.customerName}'s booking has already started, so it was not cancelled.`
        ),
      ]
        .filter(Boolean)
        .join(" "),
    });
  }

  // Who a cancel reaches: the email goes only to a customer who left one.
  const toldOne = (name: string, hasEmail: boolean) =>
    hasEmail
      ? `${name} gets the cancellation email.`
      : `${name} left no email, so is not told: call them from their lead.`;
  const notTold = bookings.filter((booking) => !booking.customerHasEmail).length;

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
          Still booked. Keep them, or cancel them: a customer who left an email is told.
        </p>
      ) : null}
      {asking === ALL
        ? question(
            `Cancel all ${bookings.length} bookings? Each customer with an email gets the cancellation email.${
              notTold
                ? ` ${notTold === 1 ? "One left" : `${notTold} left`} no email and ${notTold === 1 ? "is" : "are"} not told.`
                : ""
            }`,
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
                  `Cancel ${booking.customerName}'s booking? ${toldOne(booking.customerName, booking.customerHasEmail)}`,
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
