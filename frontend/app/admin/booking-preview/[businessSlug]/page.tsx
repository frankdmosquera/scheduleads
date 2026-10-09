// Frontend page /admin/booking-preview/<businessSlug>: a stand-in client site hosting the booking
// component, for the platform admin to try it before any real site has it (feature 9). Anyone
// else gets the same not-found as a wrong address.

import type { Metadata } from "next";

import "@scheduleads-app/booking-component/booking-component.css";

import { BookingPreviewScreen } from "@/components/booking-preview/booking-preview-screen";

import "./booking-preview-looks.css";

export const metadata: Metadata = {
  title: "Booking preview",
  robots: { index: false, follow: false },
};

export default async function BookingPreviewPage({
  params,
}: PageProps<"/admin/booking-preview/[businessSlug]">) {
  const { businessSlug } = await params;
  return <BookingPreviewScreen businessSlug={businessSlug} />;
}
