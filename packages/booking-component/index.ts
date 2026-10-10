// Booking component: what a host site imports. Everything else in the package is its own.
//
// A site in any repo installs it from GitHub Packages, where it is private to the account. Beside
// the site's package.json, an .npmrc (it holds no secret, so it is committed):
//
//   @frankdmosquera:registry=https://npm.pkg.github.com
//   //npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
//
// NODE_AUTH_TOKEN is a GitHub personal access token (classic) with read:packages, the only kind
// GitHub's npm registry takes: set in the shell for an install, and in the host's build settings
// (Vercel's environment variables), never in a file. Then
// `npm install @frankdmosquera/booking-component`, which needs react and react-dom 19 in the site.
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
// The look comes from the host: import "@frankdmosquera/booking-component/booking-component.css"
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
