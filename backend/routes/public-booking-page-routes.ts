// Backend: the customer's own booking, opened by the private link in their email (feature 7a). No
// login: the signed token is the key, and it opens that one booking only. Every bad link gets the
// same answer, so a link cannot be used to learn whether a booking exists (decision 2).

import { Hono } from "hono";

import { findBookingPage } from "../lib/booking/find-booking-page.js";
import { readBookingPageToken } from "../lib/booking/booking-page-token.js";
import { refuse } from "../lib/errors/refuse.js";

const linkNotFound = refuse("not_found", "This link does not open a booking.");

export const publicBookingPageRoutes = new Hono()
  // What the booking's page shows. Never cached: the booking can change, and the link is private.
  .get("/bookings/:token", async (c) => {
    c.header("Cache-Control", "no-store");
    const bookingId = readBookingPageToken(c.req.param("token"));
    const booking = bookingId ? await findBookingPage(bookingId) : null;
    if (!booking) return c.json(linkNotFound, 404);
    return c.json({ booking }, 200);
  });
