// Frontend: the frame of a customer's booking page, opened by the private link in their email
// (feature 7a). It replaces the app's own title, so the tab never names the product (decision 9),
// keeps the page out of search engines, and never tells another site the link it came from.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your booking",
  description: "Your booking, from the business you booked with.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function BookingPageLayout({ children }: LayoutProps<"/b">) {
  return children;
}
