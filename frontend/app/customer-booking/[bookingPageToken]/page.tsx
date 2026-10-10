// Frontend page /customer-booking/<bookingPageToken>: the customer's own booking, opened by the
// private link in their email and texts, which reads /b/<bookingPageToken> to stay short
// (next.config.ts rewrites it here). No login: the link is the key (feature 7a, decision 1).

"use client";

import { use } from "react";

import { CustomerBookingScreen } from "@/components/customer-booking/customer-booking-screen";

export default function CustomerBookingPage({
  params,
}: PageProps<"/customer-booking/[bookingPageToken]">) {
  const { bookingPageToken } = use(params);
  return <CustomerBookingScreen token={bookingPageToken} />;
}
