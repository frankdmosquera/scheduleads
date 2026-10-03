// Frontend page /b/<link>: the customer's own booking, opened by the private link in their email.
// No login: the link is the key (feature 7a, decision 1).

"use client";

import { use } from "react";

import { BookingPage } from "@/components/booking-page/booking-page";

export default function CustomerBookingPage({ params }: PageProps<"/b/[token]">) {
  const { token } = use(params);
  return <BookingPage token={token} />;
}
