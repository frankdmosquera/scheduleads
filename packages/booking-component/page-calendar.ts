// Booking component, for a site's server code: a service's open days for a calendar on the site's
// own page (feature 13c). Its own entry, never "use client", so a server component can call it.
//
// In a Next site, a server component reads them once a day, so the month is built into the page
// (fast, and Google reads the dates), and hands them to <PageCalendar> from the main entry, which
// sits inside the site's BookingProvider and reads a tapped day's times live:
//
//   import { fetchPageCalendar } from "@frankdmosquera/booking-component/page-calendar";
//
//   const calendar = await fetchPageCalendar(apiUrl, slug, { init: { next: { revalidate: 86400 } } });
//   return calendar ? <PageCalendar calendar={calendar} title="Pick a day" /> : <TheSitesOwnCard />;
//
// `service` names which service by its booking link slug; left out, the business's only one. With
// none to show, or the API unreachable, it answers null and the site keeps its own card.

export {
  fetchPageCalendar,
  type PageCalendarDataType,
  type PageCalendarOptionsType,
} from "./page-calendar/fetch-page-calendar.js";
