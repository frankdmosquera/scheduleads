// Booking component: wraps a host site's page, so any Book now inside it can open the booking
// window. The children pass through untouched, so a Next host's server components stay server
// components.

"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

import { createBookingApiClient } from "../api-client/create-booking-api-client.js";
import { BookingWindow } from "../booking-window/booking-window.js";
import { wordsOf } from "../words/booking-words-context.js";
import type { AfterBookingType, BookedType } from "./after-booking-type.js";
import { BookingContext, type BookingContextType, type PickedTimeType } from "./booking-context.js";
import { reportBooked } from "./report-booked.js";

export type BookingProviderPropsType = {
  apiUrl: string; // the API's address, e.g. "https://api.example.com"
  slug: string; // the business's slug: whose services the window books
  language?: "en" | "es"; // the window's language, and its booking's; left out = English
  afterBooking?: AfterBookingType; // left out = "stay", the window's own confirmation
  onBooked?: (booked: BookedType) => void; // once per booking made; never the customer's details
  children: ReactNode;
};

// asked counts the opens: one that finds the window open asks it to make sure it is showing.
type OpenWindowType = {
  bookingId: string | undefined;
  opener: HTMLElement | null;
  chosen: PickedTimeType | undefined;
  asked: number;
};

export function BookingProvider({
  apiUrl,
  slug,
  language = "en",
  afterBooking = "stay",
  onBooked,
  children,
}: BookingProviderPropsType) {
  const apiClient = useMemo(() => createBookingApiClient(apiUrl), [apiUrl]);
  const [openWindow, setOpenWindow] = useState<OpenWindowType | null>(null);

  const openFrom = useCallback<BookingContextType["openFrom"]>((bookingId, opener, chosen) => {
    setOpenWindow((current) =>
      current ? { ...current, asked: current.asked + 1 } : { bookingId, opener, chosen, asked: 0 }
    );
  }, []);
  const booking = useMemo<BookingContextType>(
    () => ({
      openFrom,
      apiClient,
      slug,
      language,
      booked: (made) =>
        reportBooked(made, {
          afterBooking,
          onBooked,
          goTo: (address) => window.location.assign(address),
        }),
    }),
    [openFrom, apiClient, slug, language, afterBooking, onBooked]
  );

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
        <BookingWindow
          apiClient={apiClient}
          slug={slug}
          bookingId={openWindow.bookingId}
          chosenAtOpen={openWindow.chosen}
          asked={openWindow.asked}
          words={wordsOf[language]}
          afterBooking={afterBooking}
          onBooked={onBooked}
          goTo={(address) => window.location.assign(address)}
          onClosed={closed}
        />
      )}
    </BookingContext>
  );
}
