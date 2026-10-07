// Backend: the address of a booking's own page, as the customer's emails and texts link it.
// Signed, nothing stored, so the same booking always gives the same address and a retried email
// or text is the same one.

import { appOrigin } from "../auth/auth-server.js";
import { makeBookingPageToken } from "./booking-page-token.js";

export function bookingPageUrl(bookingId: string): string {
  return `${appOrigin}/b/${makeBookingPageToken(bookingId)}`;
}
