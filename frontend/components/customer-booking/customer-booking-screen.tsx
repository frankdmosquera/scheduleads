// Frontend: the customer's booking page. Their booking under the business's name, logo and colour,
// "Change the time" (feature 7b) and a Cancel button that asks once more (feature 7a). Every state
// has its own plain words: not found, already cancelled, already started, moved, and a failure
// that keeps the button usable. Nothing here names the product (decision 9) or shows the
// customer's own details (decision 3).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { textColorOn } from "@scheduleads-app/shared/text-color-on";
import { telHref } from "@scheduleads-app/shared/tel-href";

import { cancelBookingPage } from "@/lib/api-client/customer-booking/cancel-booking-page";
import {
  fetchBookingPage,
  type BookingPageResultType,
  type BookingPageType,
} from "@/lib/api-client/customer-booking/fetch-booking-page";

import { ChangeTimePanel, type CannotMoveType } from "./change-time-panel";

// What the Cancel area is doing: showing the button, asking once more, or sending.
export type CancelButtonStepType = "button" | "confirm" | "sending";

export function CustomerBookingScreen({ token }: { token: string }) {
  const [result, setResult] = useState<BookingPageResultType | null>(null);
  const [reloads, setReloads] = useState(0);
  const retried = useRef(false); // after "Try again", focus goes to the next screen's heading
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let live = true; // a late answer never updates a page the customer already left
    fetchBookingPage(token).then((next) => {
      if (live) setResult(next);
    });
    return () => {
      live = false;
    };
  }, [token, reloads]);

  useEffect(() => {
    if (result && retried.current) heading.current?.focus(); // runs once the new screen is drawn
  }, [result]);

  if (!result) {
    return (
      <CustomerBookingFrame>
        <p role="status" className="text-sm text-slate-500">
          One moment…
        </p>
      </CustomerBookingFrame>
    );
  }
  if (result.state === "not-found") {
    return (
      <CustomerBookingFrame>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 outline-none"
        >
          This link doesn&apos;t work
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Please call the business that sent it.
        </p>
      </CustomerBookingFrame>
    );
  }
  if (result.state === "unreachable") {
    return (
      <CustomerBookingFrame>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 outline-none"
        >
          Your booking can&apos;t load right now
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Please try again in a moment.</p>
        <button
          type="button"
          onClick={() => {
            retried.current = true;
            setResult(null); // "One moment…" while it tries again
            setReloads((n) => n + 1);
          }}
          className="mt-6 w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Try again
        </button>
      </CustomerBookingFrame>
    );
  }
  return <CustomerBookingDetails token={token} initial={result.booking} headingRef={heading} />;
}

function CustomerBookingDetails({
  token,
  initial,
  headingRef,
}: {
  token: string;
  initial: BookingPageType;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const [booking, setBooking] = useState(initial);
  const [step, setStep] = useState<CancelButtonStepType>("button");
  const [problem, setProblem] = useState<string | null>(null);
  const [changing, setChanging] = useState(false); // the "Change the time" panel is open
  const [moved, setMoved] = useState(false);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const { business } = booking;
  // The business's own colour is data, not a class, so its buttons are styled inline; the text on
  // it is white or dark ink, whichever stays readable.
  const brand = business.brandColor ?? "#0f172a";
  const onBrand = textColorOn(brand);
  const keepRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const yesCancelRef = useRef<HTMLButtonElement>(null);
  const { when } = booking; // written by the API, never with the browser's time-zone rules

  useEffect(() => {
    document.title = `Your booking with ${business.name}`;
  }, [business.name]);

  // Stable, so the panel does not ask for its times again each time this page draws.
  const showMoved = useCallback((next: BookingPageType) => {
    setBooking(next);
    setChanging(false);
    setMoved(true);
    requestAnimationFrame(() => resultHeading.current?.focus()); // the heading has just changed
  }, []);
  const showCannotMove = useCallback((reason: CannotMoveType) => {
    setBooking((current) =>
      reason === "already-cancelled"
        ? { ...current, status: "cancelled", canCancel: false, canMove: false }
        : { ...current, canCancel: false, canMove: false }
    );
    setChanging(false);
    requestAnimationFrame(() => resultHeading.current?.focus());
  }, []);
  const closeChangeTime = useCallback(() => {
    setChanging(false);
    requestAnimationFrame(() => changeRef.current?.focus()); // back where they were
  }, []);

  async function cancelCustomerBooking() {
    setStep("sending");
    setProblem(null);
    const answer = await cancelBookingPage(token);
    if (answer.state === "ok") {
      setBooking(answer.booking);
      setStep("button");
      requestAnimationFrame(() => resultHeading.current?.focus()); // the heading has just changed
      return;
    }
    if (answer.state === "already-started") {
      setBooking({ ...booking, canCancel: false });
      setStep("button");
      requestAnimationFrame(() => resultHeading.current?.focus());
      return;
    }
    setStep("confirm"); // the button stays usable: pressing again is safe
    requestAnimationFrame(() => yesCancelRef.current?.focus()); // it was locked while sending
    setProblem(
      answer.state === "not-found"
        ? "This link no longer opens a booking. Please call the business."
        : "The cancel didn't go through. Please try again, or call the business."
    );
  }

  const cancelled = booking.status === "cancelled";
  const started = !cancelled && !booking.canCancel;

  return (
    <CustomerBookingFrame
      footer={
        business.website ? (
          <a href={business.website} className="text-slate-500 hover:text-slate-700">
            {business.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </a>
        ) : null
      }
    >
      {business.logo ? (
        // A plain img: the logo lives on the business's own image host, outside Next's optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={business.logo} alt={business.name} className="mb-5 h-12 w-auto object-contain" />
      ) : (
        <p className="mb-5 text-lg font-semibold text-slate-900">{business.name}</p>
      )}

      {/* Read out whenever it changes: the cancel's result lands here. */}
      <div aria-live="polite">
        <h1
          ref={(element) => {
            resultHeading.current = element;
            headingRef.current = element; // the page's own retry focuses it too
          }}
          tabIndex={-1}
          className="text-xl font-semibold text-slate-900 outline-none"
        >
          {cancelled
            ? "Your booking is cancelled"
            : moved
              ? "Your booking has moved"
              : "Your booking"}
        </h1>
        {moved && !cancelled ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">{`It's now ${when}.`}</p>
        ) : null}
        {started ? (
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This booking has already started.
            {business.phone ? ` To change it, call ${business.name}.` : null}
          </p>
        ) : null}
      </div>

      <dl className="mt-5 space-y-3">
        <CustomerBookingDetailRow label="What" value={booking.service} />
        <CustomerBookingDetailRow label={cancelled ? "When it was" : "When"} value={when} />
        <CustomerBookingDetailRow label="With" value={booking.person} />
      </dl>

      {!cancelled && !started && changing ? (
        <div className="mt-6">
          <ChangeTimePanel
            token={token}
            booking={booking}
            brand={brand}
            onBrand={onBrand}
            onMoved={showMoved}
            onCannotMove={showCannotMove}
            onClose={closeChangeTime}
          />
        </div>
      ) : null}

      {!cancelled && !started && !changing ? (
        <div className="mt-6 space-y-3">
          {booking.canMove && step === "button" ? (
            <button
              type="button"
              ref={changeRef}
              onClick={() => {
                setProblem(null);
                setChanging(true);
              }}
              style={{ backgroundColor: brand, color: onBrand }}
              className="w-full rounded-lg px-4 py-3 text-sm font-semibold"
            >
              Change the time
            </button>
          ) : null}
          {step === "button" ? (
            <button
              type="button"
              ref={cancelRef}
              onClick={() => {
                setStep("confirm");
                requestAnimationFrame(() => keepRef.current?.focus()); // the button just pressed is gone
              }}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Cancel this booking
            </button>
          ) : (
            <div role="group" aria-labelledby="confirm-cancel">
              <p id="confirm-cancel" role="status" className="text-sm font-medium text-slate-900">
                Cancel this booking?
              </p>
              <div className="mt-3 flex gap-3">
                <button
                  ref={yesCancelRef}
                  type="button"
                  onClick={cancelCustomerBooking}
                  disabled={step === "sending"}
                  style={{ backgroundColor: brand, color: onBrand }}
                  className="flex-1 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {step === "sending" ? "Cancelling…" : "Yes, cancel it"}
                </button>
                <button
                  ref={keepRef}
                  type="button"
                  onClick={() => {
                    setStep("button");
                    setProblem(null);
                    requestAnimationFrame(() => cancelRef.current?.focus()); // back where they were
                  }}
                  disabled={step === "sending"}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
                >
                  Keep it
                </button>
              </div>
              {problem ? (
                <p role="alert" className="mt-3 text-sm text-red-700">
                  {problem}
                </p>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {(cancelled || started) && business.phone ? (
        <a
          href={telHref(business.phone)}
          style={{ backgroundColor: brand, color: onBrand }}
          className="mt-6 block w-full rounded-lg px-4 py-3 text-center text-sm font-semibold"
        >
          {`Call ${business.name}`}
        </a>
      ) : null}
    </CustomerBookingFrame>
  );
}

function CustomerBookingDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="text-base text-slate-900">{value}</dd>
    </div>
  );
}

// The page's one card, in plain colours of its own: the business's brand sits inside it, the
// product's theme never does.
function CustomerBookingFrame({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">{children}</div>
        {footer ? <div className="mt-4 text-center text-xs">{footer}</div> : null}
      </div>
    </main>
  );
}
