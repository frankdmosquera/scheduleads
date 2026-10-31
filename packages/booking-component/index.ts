// Booking component: what a host site imports. Everything else in the package is its own.
//
// A site in any repo installs it from a packed file committed in its own vendor/ folder, so no
// registry, no token and nothing public. From this repo's root, put this version into a site:
//
//   npm run pack:site --workspace=@frankdmosquera/booking-component -- ../face-and-body
//
// It needs react and react-dom 19 in the site. A new window for a site is a new version here
// first: the command refuses a different build under a version the site already has.
//
// Wrap the page (or the layout) once, with the API's address and the business's slug:
//
//   <BookingProvider apiUrl="https://api.example.com" slug="primo-painters">
//     {children}
//   </BookingProvider>
//
// It speaks English unless the site says otherwise: language="es" puts the window, its dates and
// its booking's emails in Spanish (feature 12i). After a booking the window shows its own
// confirmation; a site that has a thank-you page names it, and can hear of each booking made
// (its id, service, time and zone, never the customer's details):
//
//   <BookingProvider apiUrl="..." slug="..." language="es"
//     afterBooking={{ redirectTo: "/gracias" }} onBooked={(booked) => countIt(booked)}>
//
// redirectTo may also be a function of the booking, to put its time in the page's address.
// onBooked runs just before the browser leaves for that page: anything it sends must go at once
// (navigator.sendBeacon), since a fetch it starts may be cut off. If it throws, the visitor still
// goes to the page.
//
// Then any number of buttons inside it. With no bookingId the window opens on the business's
// services; with a service's bookingId it opens straight on that service:
//
//   <BookNowTrigger className="btn">Book now</BookNowTrigger>
//   <BookNowTrigger bookingId={service.bookingId} className="btn">Book now</BookNowTrigger>
//
// A host's own control, inside a client component, opens it the same way:
//
//   const { open } = useBooking();
//   open(); // or open(bookingId)
//
// A calendar on the site's own page (feature 13c): a server component reads the open days from the
// "./page-calendar" entry, once a day, and hands them to <PageCalendar> inside the provider. A
// tapped day's times load live; a picked time opens the window on its form with that time chosen.
//
//   <PageCalendar calendar={calendar} title="Pick a day" bookLabel="Book now" />
//
// The look comes from the host: import "@frankdmosquera/booking-component/booking-component.css"
// and define the --sa-* tokens (colours, fonts, radius) in the host's own stylesheet. Each has a
// neutral fallback. --sa-action-ink must be set with --sa-action; it is never assumed white.

export {
  BookingProvider,
  type BookingProviderPropsType,
} from "./booking-provider/booking-provider.js";
export { useBooking, type UseBookingType } from "./booking-provider/use-booking.js";
export type { AfterBookingType, BookedType } from "./booking-provider/after-booking-type.js";
export {
  BookNowTrigger,
  type BookNowTriggerPropsType,
} from "./book-now-trigger/book-now-trigger.js";
export type { PickedTimeType } from "./booking-provider/booking-context.js";
export { PageCalendar, type PageCalendarPropsType } from "./page-calendar/page-calendar.js";
export type { PageCalendarDataType } from "./page-calendar/fetch-page-calendar.js";
