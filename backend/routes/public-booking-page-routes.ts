// Backend: the customer's own booking, opened by the private link in their email (features 7a
// and 7b). No login: the signed token is the key, and it opens that one booking only. Every bad
// link gets the same answer, so a link cannot be used to learn whether a booking exists (7a's
// decision 2).

import { Hono } from "hono";
import { validator } from "hono/validator";

import { freeTimesQueryValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { cancelBooking } from "../lib/booking/cancel-booking.js";
import { findBookingMoveTimes } from "../lib/booking/find-booking-move-times.js";
import { findBookingPage } from "../lib/booking/find-booking-page.js";
import { readBookingPageToken } from "../lib/booking/booking-page-token.js";
import { CalendarUnavailableError } from "../lib/calendar/calendar-unavailable-error.js";
import { refuse } from "../lib/errors/refuse.js";

const linkNotFound = refuse("not_found", "This link does not open a booking.");
const alreadyStarted = refuse(
  "already_started",
  "This booking has already started. Call the business to change it."
);
const alreadyCancelled = refuse("already_cancelled", "This booking was cancelled.");

export const publicBookingPageRoutes = new Hono()
  // What the booking's page shows. Never cached: the booking can change, and the link is private.
  .get("/bookings/:token", async (c) => {
    c.header("Cache-Control", "no-store");
    const bookingId = readBookingPageToken(c.req.param("token"));
    const booking = bookingId ? await findBookingPage(bookingId, new Date()) : null;
    if (!booking) return c.json(linkNotFound, 404);
    return c.json({ booking }, 200);
  })
  // The times it could move to (feature 7b): the booking form's own question and answer, the
  // booking's own time never in its way. Until the appointment starts (decision 12).
  .get(
    "/bookings/:token/times",
    validator("query", (value, c) => {
      const parsed = freeTimesQueryValidationSchema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "That is not a valid question.";
        return c.json(refuse("bad_request", message), 400);
      }
      return parsed.data;
    }),
    async (c) => {
      c.header("Cache-Control", "no-store");
      const bookingId = readBookingPageToken(c.req.param("token"));
      if (!bookingId) return c.json(linkNotFound, 404);
      const query = c.req.valid("query");

      try {
        const result = await findBookingMoveTimes({
          bookingId,
          personId: query.person ?? null,
          fromDate: query.from,
          toDate: query.to,
          now: new Date(),
        });
        if (result.state === "already_started") return c.json(alreadyStarted, 409);
        if (result.state === "already_cancelled") return c.json(alreadyCancelled, 409);
        if (result.state === "not_found") return c.json(linkNotFound, 404);
        return c.json(result.times, 200);
      } catch (error) {
        if (!(error instanceof CalendarUnavailableError)) throw error;
        return c.json(
          refuse("unavailable", "Times cannot be read right now. Try again shortly."),
          503
        );
      }
    }
  )
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
