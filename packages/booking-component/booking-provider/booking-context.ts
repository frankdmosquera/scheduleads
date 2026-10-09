// Booking component: what the provider hands its buttons. `opener` is the element focus goes back to
// when the window closes.

"use client";

import { createContext } from "react";

export type BookingContextType = {
  openFrom(bookingId: string | undefined, opener: HTMLElement | null): void;
};

export const BookingContext = createContext<BookingContextType | null>(null);
