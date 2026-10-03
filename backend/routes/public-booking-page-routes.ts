// Backend: the customer's own booking, opened by the private link in their email (feature 7a). No
// login: the signed token is the key, and it opens that one booking only. Every bad link gets the
// same answer, so a link cannot be used to learn whether a booking exists (decision 2).

import { Hono } from "hono";

import { cancelBooking } from "../lib/booking/cancel-booking.js";
import { findBookingPage } from "../lib/booking/find-booking-page.js";
import { readBookingPageToken } from "../lib/booking/booking-page-token.js";
import { refuse } from "../lib/errors/refuse.js";

const linkNotFound = refuse("not_found", "This link does not open a booking.");
const alreadyStarted = refuse(
  "already_started",
  "This booking has already started. Call the business to change it."
);

export const publicBookingPageRoutes = new Hono()
  // What the booking's page shows. Never cached: the booking can change, and the link is private.
  .get("/bookings/:token", async (c) => {
    c.header("Cache-Control", "no-store");
    const bookingId = readBookingPageToken(c.req.param("token"));
    const booking = bookingId ? await findBookingPage(bookingId, new Date()) : null;
    if (!booking) return c.json(linkNotFound, 404);
    return c.json({ booking }, 200);
  })
  // Cancel, until the appointment starts (decision 11). Pressed twice, it answers the same.
  .post("/bookings/:token/cancel", async (c) => {
    c.header("Cache-Control", "no-store");
    const bookingId = readBookingPageToken(c.req.param("token"));
    if (!bookingId) return c.json(linkNotFound, 404);

    const result = await cancelBooking(bookingId, new Date());
    if (!result.cancelled) {
      return result.reason === "already_started"
        ? c.json(alreadyStarted, 409)
        : c.json(linkNotFound, 404);
    }
    const booking = await findBookingPage(bookingId, new Date());
    if (!booking) return c.json(linkNotFound, 404);
    return c.json({ booking }, 200);
  });
