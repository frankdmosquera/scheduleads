// Booking component: one service's open days for a site's own page (feature 13c), read on the site's
// server so the month is built into the page. This month and the next, cut to the business's
// horizon, in its own zone. The site passes its own caching in init (Next: { next: { revalidate:
// 86400 } }, once a day). Never throws: any failure answers null, so the site keeps its own card.

import { localDate } from "@scheduleads-app/shared/local-date";

import type {
  BookingBusinessType,
  BookingServiceDetailsType,
} from "../api-client/booking-api-types.js";
import { createBookingApiClient } from "../api-client/create-booking-api-client.js";
import { bookableMonths } from "../booking-window/month-calendar/bookable-months.js";
import { datesToAsk } from "../booking-window/month-calendar/dates-to-ask.js";
import { shiftMonth } from "../booking-window/month-calendar/shift-month.js";

export type PageCalendarDataType = {
  timeZone: string;
  today: string; // YYYY-MM-DD on the business's clock when the page was built
  horizonDays: number; // how many days ahead the service books
  service: BookingServiceDetailsType;
  theme: BookingBusinessType["theme"]; // its Look colours, worn by the calendar as by the window
  months: string[]; // YYYY-MM read here; later months are read live in the browser
  openDays: string[]; // YYYY-MM-DD with at least one free time, in order
};

export type PageCalendarOptionsType = {
  service?: string; // its booking link slug; left out = the business's only service
  language?: "en" | "es";
  init?: RequestInit;
  now?: Date; // a test's clock
};

export async function fetchPageCalendar(
  apiUrl: string,
  slug: string,
  { service: serviceSlug, language = "en", init, now = new Date() }: PageCalendarOptionsType = {}
): Promise<PageCalendarDataType | null> {
  // Hono's client drops an empty segment, so a blank slug would ask another route.
  if (slug.trim() === "") return null;
  const links = createBookingApiClient(apiUrl).public[":slug"]["booking-links"];
  const param = { slug: encodeURIComponent(slug) };

  try {
    const list = await links.$get({ param }, { init });
    if (list.status !== 200) return null;
    const { business, bookingLinks } = await list.json();
    if (!business || !Array.isArray(bookingLinks)) return null;
    const picked = serviceSlug
      ? bookingLinks.find((link) => link.slug === serviceSlug)
      : bookingLinks.length === 1
        ? bookingLinks[0]
        : undefined;
    if (!picked) return null;

    const one = await links[":bookingLinkId"].$get(
      { param: { ...param, bookingLinkId: encodeURIComponent(picked.id) } },
      { init }
    );
    if (one.status !== 200) return null;
    const { bookingLink, availability } = await one.json();
    const timeZone = availability.timezone;
    const today = localDate(now, timeZone);
    const bounds = bookableMonths(today, availability.horizonDays);

    const months = [bounds.firstMonth, shiftMonth(bounds.firstMonth, 1)].filter(
      (month) => month <= bounds.lastMonth
    );
    const openDays = new Set<string>();
    for (const month of months) {
      const dates = datesToAsk(month, bounds);
      if (!dates) continue;
      const times = await links[":bookingLinkId"].times.$get(
        {
          param: { ...param, bookingLinkId: encodeURIComponent(picked.id) },
          // English is the API's own: asked only for another language, as the window asks.
          query: { from: dates.from, to: dates.to, ...(language === "en" ? {} : { language }) },
        },
        { init }
      );
      if (times.status !== 200) return null;
      const { localStartTimes } = await times.json();
      for (const time of localStartTimes) openDays.add(time.date);
    }

    // Nothing to book in both months: the site keeps its own card, never a dead calendar.
    if (openDays.size === 0) return null;
    return {
      timeZone,
      today,
      horizonDays: availability.horizonDays,
      service: bookingLink,
      theme: business.theme ?? null,
      months,
      openDays: [...openDays].sort(),
    };
  } catch {
    return null;
  }
}
