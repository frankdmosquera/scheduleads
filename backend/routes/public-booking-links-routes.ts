// Backend: the public booking routes a stranger can call. Read-only, no login, and one
// identical "not here" answer, so nobody can probe which businesses or services exist.

import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import { bookingLink, organization } from "@scheduleads-app/shared/db";
import {
  bookingLinkIdValidationSchema,
  freeTimesQueryValidationSchema,
  organizationSlugValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import { resolveBookableHours } from "../lib/bookable-hours/resolve-bookable-hours.js";
import { findBookableOrganizationId } from "../lib/booking/find-bookable-organization-id.js";
import { findBookingQuestions } from "../lib/booking/find-booking-questions.js";
import { findLaterTextsYesWords } from "../lib/booking/find-later-texts-yes-words.js";
import { findPersonChoice } from "../lib/booking/find-person-choice.js";
import { publicPriceOf } from "../lib/booking/public-price-of.js";
import { publicThemeOf } from "../lib/booking/public-theme-of.js";
import { CalendarUnavailableError } from "../lib/calendar/calendar-unavailable-error.js";
import { notBookableHere } from "../lib/errors/not-bookable-here.js";
import { personNotTaken } from "../lib/errors/person-not-taken.js";
import { refuse } from "../lib/errors/refuse.js";
import { findFreeTimes } from "../lib/scheduling/find-free-times.js";
import { localStartTimes } from "../lib/scheduling/local-start-times.js";

// What a stranger may see of a service. Never organizationId, never anything about people.
const publicBookingLinkColumns = {
  id: bookingLink.id,
  slug: bookingLink.slug,
  name: bookingLink.name,
  description: bookingLink.description,
  durationMinutes: bookingLink.durationMinutes,
  bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
  bufferAfterMinutes: bookingLink.bufferAfterMinutes,
  addressMode: bookingLink.addressMode, // the window's address field: required, optional or none
  priceCents: bookingLink.priceCents, // answered as one price with the currency (feature 25d)
  priceFrom: bookingLink.priceFrom,
  imageUrl: bookingLink.imageUrl, // its photo (feature 25e), a public ImageKit address
};

// Each service's price joined to the business's currency, as the window gets it.
const withPrice =
  (currency: string | null) =>
  <LinkType extends { priceCents: number | null; priceFrom: boolean }>({
    priceCents,
    priceFrom,
    ...link
  }: LinkType) => ({ ...link, price: publicPriceOf(priceCents, priceFrom, currency) });

// What a stranger may see of the business itself: what its own site shows anyway (feature 9).
const publicBusinessColumns = {
  name: organization.name,
  logo: organization.logo,
  phone: organization.phone,
  contactRule: organization.contactRule, // which of email and phone the form marks required
  currency: organization.currency, // read for the prices, answered inside each one
  // Its colours, answered as one theme (feature 25e).
  brandColor: organization.brandColor,
  backgroundColor: organization.backgroundColor,
  textColor: organization.textColor,
  coloursOn: organization.coloursOn,
};

export const publicBookingLinksRoutes = new Hono()
  // The business's face, its own questions and the yes-to-later-texts box's sentence (null: no box)
  // for the booking modal, and its active services, by name.
  .get("/:slug/booking-links", async (c) => {
    const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
    if (!slug.success) return c.json(refuse("bad_request", "That is not a business address."), 400);

    const organizationId = await findBookableOrganizationId(slug.data);
    if (!organizationId) return c.json(notBookableHere, 404);

    const [[business], questions, laterTextsYesWords, bookingLinks] = await Promise.all([
      db
        .select(publicBusinessColumns)
        .from(organization)
        .where(eq(organization.id, organizationId))
        .limit(1),
      findBookingQuestions(organizationId),
      findLaterTextsYesWords(organizationId),
      db
        .select(publicBookingLinkColumns)
        .from(bookingLink)
        .where(and(eq(bookingLink.organizationId, organizationId), eq(bookingLink.active, true)))
        .orderBy(asc(bookingLink.name)),
    ]);
    if (!business) return c.json(notBookableHere, 404); // the business went between the two reads

    const { currency, brandColor, backgroundColor, textColor, coloursOn, ...face } = business;
    return c.json(
      {
        business: {
          ...face,
          questions,
          laterTextsYesWords,
          theme: publicThemeOf(coloursOn, brandColor, backgroundColor, textColor),
        },
        bookingLinks: bookingLinks.map(withPrice(currency)),
      },
      200
    );
  })
  // One service, how its modal looks and who picks the person, and the business's bookable hours.
  // The people come with the times.
  .get("/:slug/booking-links/:bookingLinkId", async (c) => {
    const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
    const bookingLinkId = bookingLinkIdValidationSchema.safeParse(c.req.param("bookingLinkId"));
    if (!slug.success || !bookingLinkId.success) {
      return c.json(refuse("bad_request", "That is not a valid booking address."), 400);
    }

    const organizationId = await findBookableOrganizationId(slug.data);
    if (!organizationId) return c.json(notBookableHere, 404);

    // Found only inside this business, never by id alone.
    const [publicBookingLink] = await db
      .select({
        ...publicBookingLinkColumns,
        layout: bookingLink.layout,
        personChoice: bookingLink.personChoice,
        currency: organization.currency,
      })
      .from(bookingLink)
      .innerJoin(organization, eq(organization.id, bookingLink.organizationId))
      .where(
        and(
          eq(bookingLink.organizationId, organizationId),
          eq(bookingLink.id, bookingLinkId.data),
          eq(bookingLink.active, true)
        )
      )
      .limit(1);
    if (!publicBookingLink) return c.json(notBookableHere, 404);

    const hours = await resolveBookableHours(organizationId, null, new Date());
    if (!hours) return c.json(notBookableHere, 404); // the hours row went between the two reads

    // `source` stays out: it says whose week answered, which is about people.
    const { source: _source, ...availability } = hours;
    const { currency, ...link } = publicBookingLink;
    return c.json({ bookingLink: withPrice(currency)(link), availability }, 200);
  })
  // The start times a customer can book for a service, with one person or "any available". The
  // people to pick from only when the customer picks (decision 3). Each time also comes with its
  // date and clock time on the business's clock, so the booking window never works them out with
  // the browser's own time-zone rules.
  .get(
    "/:slug/booking-links/:bookingLinkId/times",
    validator("query", (value, c) => {
      const parsed = freeTimesQueryValidationSchema.safeParse(value);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "That is not a valid question.";
        return c.json(refuse("bad_request", message), 400);
      }
      return parsed.data;
    }),
    async (c) => {
      const slug = organizationSlugValidationSchema.safeParse(c.req.param("slug"));
      const bookingLinkId = bookingLinkIdValidationSchema.safeParse(c.req.param("bookingLinkId"));
      if (!slug.success || !bookingLinkId.success) {
        return c.json(refuse("bad_request", "That is not a valid booking address."), 400);
      }
      const query = c.req.valid("query");

      const organizationId = await findBookableOrganizationId(slug.data);
      if (!organizationId) return c.json(notBookableHere, 404);
      const personChoice = await findPersonChoice(organizationId, bookingLinkId.data);
      if (!personChoice) return c.json(notBookableHere, 404);
      if (personChoice === "business_assigns" && query.person) return c.json(personNotTaken, 400);

      // The dates go in as asked: findFreeTimes cuts them to today through the horizon.
      try {
        const freeTimes = await findFreeTimes({
          organizationId,
          bookingLinkId: bookingLinkId.data,
          personId: query.person ?? null,
          fromDate: query.from,
          toDate: query.to,
          now: new Date(),
        });
        if (!freeTimes) return c.json(notBookableHere, 404);
        const people = personChoice === "customer_picks" ? freeTimes.people : [];
        const local = localStartTimes(freeTimes.startTimes, freeTimes.timezone, query.language);
        return c.json({ ...freeTimes, people, localStartTimes: local }, 200);
      } catch (error) {
        // Only unreadable calendars are expected (the picked person's, or everyone's with "any
        // available", decision 9); anything else is a real fault.
        if (!(error instanceof CalendarUnavailableError)) throw error;
        return c.json(
          refuse("unavailable", "Times cannot be read right now. Try again shortly."),
          503
        );
      }
    }
  );
