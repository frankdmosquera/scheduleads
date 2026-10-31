// Booking component: what the provider hands its buttons and a page calendar. `opener` is the
// element focus goes back to when the window closes; `chosen`, a time picked on the page (13c).

"use client";

import { createContext } from "react";

import type { BookingApiClientType, BookingMadeType } from "../api-client/booking-api-types.js";

// A free time picked outside the window, as the times route gave it.
export type PickedTimeType = { startsAt: string; date: string; time: string };

export type BookingContextType = {
  openFrom(
    bookingId: string | undefined,
    opener: HTMLElement | null,
    chosen?: PickedTimeType
  ): void;
  // For a page calendar inside the provider: the same API, business and language as the window.
  apiClient: BookingApiClientType;
  slug: string;
  language: "en" | "es";
  // A page calendar that booked on the spot (13c.3): the site hears of it, and the visitor goes on,
  // as after the window's booking.
  booked(booking: BookingMadeType): void;
};

export const BookingContext = createContext<BookingContextType | null>(null);
