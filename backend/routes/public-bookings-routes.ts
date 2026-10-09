// Backend: the public route a booking form sends to when the customer presses Book. No login; the
// business comes only from the address. The answer never carries the customer's details back.

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";

import { bookingLink, resource } from "@scheduleads-app/shared/db";
import {
  createBookingValidationSchema,
  organizationSlugValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import { bookTime } from "../lib/booking/book-time.js";
import { findBookableOrganizationId } from "../lib/booking/find-bookable-organization-id.js";
import { notBookableHere } from "../lib/errors/not-bookable-here.js";
import { personNotTaken } from "../lib/errors/person-not-taken.js";
import { refuse } from "../lib/errors/refuse.js";
import { tooManyTries } from "../lib/errors/too-many-tries.js";
import { bookingContactKeys } from "../lib/rate-limit/booking-contact-keys.js";
import type { RateLimitTakenType } from "../lib/rate-limit/create-rate-limiter.js";
import { publicRateLimiters } from "../lib/rate-limit/public-rate-limiters.js";

// Decision 10: a form with every field full is far below this, 20 full answers in any script
// included (feature 9).
const MOST_BYTES = 64 * 1024;

const notValid = refuse("bad_request", "That is not a valid booking.");

export const publicBookingsRoutes = new Hono()
  // Hono's validator throws on a body that is not JSON; it gets the same refusal shape as the rest.
  .onError((error, c) => {
    if (error instanceof HTTPException && error.status === 400) return c.json(notValid, 400);
    throw error;
  })
  .post(
    "/:slug/bookings",
    bodyLimit({
      maxSize: MOST_BYTES,
      onError: (c) => c.json(refuse("bad_request", "That booking is too large."), 413),
    }),
    validator("json", (value, c) => {
      const parsed = createBookingValidationSchema.safeParse(value);
      if (!parsed.success) {
        return c.json(
          refuse("bad_request", parsed.error.issues[0]?.message ?? notValid.error.message),
          400
        );
      }
      return parsed.data;
    }),
    async (c) => {
      const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
      if (!slug.success)
        return c.json(refuse("bad_request", "That is not a business address."), 400);
      const body = c.req.valid("json");

      const organizationId = await findBookableOrganizationId(slug.data);
      if (!organizationId) return c.json(notBookableHere, 404);

      // The contact's limit, counted inside bookTime just before a new booking is saved, so thirty
      // sent at once cannot all pass, and handed back below when none is made.
      const contactKeys = bookingContactKeys(organizationId, body.customer);
      let taken: RateLimitTakenType | null = null;
      let retryAfterSeconds = 0;
      const admitNewBooking = () => {
        const counted = publicRateLimiters.bookingContacts.take(contactKeys);
        if (!counted.allowed) retryAfterSeconds = counted.retryAfterSeconds;
        else taken = counted.taken;
        return counted.allowed;
      };
      const handBack = () => {
        if (taken) publicRateLimiters.bookingContacts.giveBack(taken);
      };

      const result = await bookTime({
        organizationId,
        bookingLinkId: body.bookingLinkId,
        personId: body.personId ?? null,
        startsAt: new Date(body.startsAt),
        requestKey: body.requestKey ?? null,
        customer: body.customer,
        location: body.location,
        details: body.details || null, // an empty box is no words
        answers: body.answers,
        source: "widget",
        actorUserId: null,
        now: new Date(),
        admitNewBooking,
      }).catch((error: unknown) => {
        handBack(); // a crash made no booking either
        throw error;
      });

      // Only a booking made counts: not a refusal, and not a form's booking answered again.
      if (!result.booked || result.alreadyBooked) handBack();

      if (!result.booked) {
        switch (result.reason) {
          case "not_found":
            return c.json(notBookableHere, 404);
          case "person_not_taken":
            return c.json(personNotTaken, 400);
          case "unknown_question":
            return c.json(
              refuse("bad_request", "That is not one of this business's questions."),
              400
            );
          case "answered_twice":
            return c.json(refuse("bad_request", "Each question takes one answer."), 400);
          case "too_many_tries":
            c.header("Retry-After", String(retryAfterSeconds));
            return c.json(tooManyTries, 429);
          case "answer_needed":
            return c.json(refuse("bad_request", `Answer: ${result.question}`), 400);
          case "time_taken":
            return c.json(
              refuse(
                "time_taken",
                "Sorry, that time was taken while you were booking. Please pick another one."
              ),
              409
            );
          case "request_key_used":
            return c.json(
              refuse(
                "request_key_used",
                "This booking form was already used. Please reload the page and book again."
              ),
              409
            );
          case "unavailable":
            return c.json(
              refuse("unavailable", "Times cannot be read right now. Try again shortly."),
              503
            );
          case "in_the_past": // only the owner's own bookings are refused this way (decision 13)
            throw new Error("Booking failed: a customer's booking was refused as in the past.");
        }
      }

      // The names the confirmation shows, read inside this business only.
      const { booking } = result;
      const [[service], [person]] = await Promise.all([
        db
          .select({ id: bookingLink.id, name: bookingLink.name })
          .from(bookingLink)
          .where(
            and(
              eq(bookingLink.organizationId, organizationId),
              eq(bookingLink.id, booking.bookingLinkId)
            )
          )
          .limit(1),
        db
          .select({ id: resource.id, name: resource.name })
          .from(resource)
          .where(
            and(eq(resource.organizationId, organizationId), eq(resource.id, booking.personId))
          )
          .limit(1),
      ]);
      if (!service || !person)
        throw new Error(`Booking ${booking.id} was saved without its names.`);

      return c.json(
        {
          booking: {
            id: booking.id,
            startsAt: booking.startsAt.toISOString(),
            endsAt: booking.endsAt.toISOString(),
            timezone: booking.timezone,
            service,
            person,
          },
        },
        201
      );
    }
  );
