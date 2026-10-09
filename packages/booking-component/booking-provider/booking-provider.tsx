// Booking component: wraps a host site's page, so any Book now inside it can open the booking
// window. The children pass through untouched, so a Next host's server components stay server
// components.

"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { createBookingApiClient } from "../api-client/create-booking-api-client.js";
import { BookingModal } from "../booking-modal/booking-modal.js";
import { BookingContext, type BookingContextType } from "./booking-context.js";

export type BookingProviderPropsType = {
  apiUrl: string; // the API's address, e.g. "https://api.example.com"
  slug: string; // the business's slug: whose services the window books
  children: ReactNode;
};

type OpenWindowType = { bookingId: string | undefined; opener: HTMLElement | null };

export function BookingProvider({ apiUrl, slug, children }: BookingProviderPropsType) {
  const apiClient = useMemo(() => createBookingApiClient(apiUrl), [apiUrl]);
  const [openWindow, setOpenWindow] = useState<OpenWindowType | null>(null);

  const openFrom = useCallback<BookingContextType["openFrom"]>((bookingId, opener) => {
    setOpenWindow((current) => current ?? { bookingId, opener });
  }, []);
  const booking = useMemo(() => ({ openFrom }), [openFrom]);

  const closed = useCallback(() => {
    // Back on the control that opened it, if the host has not removed it meanwhile.
    if (openWindow?.opener?.isConnected) openWindow.opener.focus();
    setOpenWindow(null);
  }, [openWindow]);

  return (
    <BookingContext value={booking}>
      {children}
      {/* Mounted only while open: closing and opening again always starts fresh. */}
      {openWindow && (
        <BookingModal
          apiClient={apiClient}
          slug={slug}
          bookingId={openWindow.bookingId}
          onClosed={closed}
        />
      )}
    </BookingContext>
  );
}
