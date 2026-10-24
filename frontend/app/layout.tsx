// Frontend: the root layout wrapping every page. Loads the fonts (as CSS variables) and the global styles,
// and holds the dashboard's language (feature 12j).

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { DashboardWordsProvider } from "@/lib/dashboard-words/dashboard-words-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Booking CRM",
  description: "Leads, bookings and hours for the business behind the site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <DashboardWordsProvider>{children}</DashboardWordsProvider>
      </body>
    </html>
  );
}
