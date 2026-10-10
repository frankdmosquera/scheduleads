// Booking component: what a host site imports. Everything else in the package is its own.
//
// Wrap the page (or the layout) once, with the API's address and the business's slug:
//
//   <BookingProvider apiUrl="https://api.example.com" slug="primo-painters">
//     {children}
//   </BookingProvider>
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
// The look comes from the host: import "@scheduleads-app/booking-component/booking-component.css"
// and define the --sa-* tokens (colours, fonts, radius) in the host's own stylesheet. Each has a
// neutral fallback. --sa-action-ink must be set with --sa-action; it is never assumed white.

export {
  BookingProvider,
  type BookingProviderPropsType,
} from "./booking-provider/booking-provider.js";
export { useBooking, type UseBookingType } from "./booking-provider/use-booking.js";
export {
  BookNowTrigger,
  type BookNowTriggerPropsType,
} from "./book-now-trigger/book-now-trigger.js";
