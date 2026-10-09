// Backend: books one time for a service, the one path every booking takes. A form already booked
// answers that booking; the time is checked again; then the contact, a new lead in the first stage,
// the booking, its held time, the timeline entry and the jobs for its Google event and its emails
// land in one transaction, or nothing does; the answer waits for neither. A customer gets only the
// free times they are offered; the owner any time nobody is busy (decision 11).

import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import {
  booking,
  bookingLink,
  contact as contactTable, // "contact" is the row the booking saves
  lead,
  member,
} from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";
import { textablePhoneNumber } from "@scheduleads-app/shared/textable-phone-number";
import {
  contactValidationSchema,
  type ContactInputType,
} from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { findFirstPipelineStage } from "../crm/find-first-pipeline-stage.js";
import { findOrCreateContact } from "../crm/find-or-create-contact.js";
import { recordActivity } from "../crm/record-activity.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { enqueueBookingEmails } from "../jobs/enqueue-booking-emails.js";
import { enqueueBookingEventJob } from "../jobs/enqueue-booking-event-job.js";
import { enqueueBookingTexts } from "../jobs/enqueue-booking-texts.js";
import { enqueueWorkerText } from "../jobs/enqueue-worker-text.js";
import { jobNames } from "../jobs/job-names.js";
import { appointmentSpan } from "../scheduling/appointment-span.js";
import { findServiceResources } from "../scheduling/find-service-resources.js";
import { checkAnswers } from "./check-answers.js";
import { findBookingChoices } from "./find-booking-choices.js";
import { findBookingQuestions } from "./find-booking-questions.js";
import { findLaterTextsYesWords } from "./find-later-texts-yes-words.js";
import { holdFirstFreeChoice } from "./hold-first-free-choice.js";

export type BookTimeInputType = {
  organizationId: string; // from the business being booked, never from the request
  bookingLinkId: string;
  personId: string | null; // null = "any available"
  startsAt: Date; // the appointment's own start, one of the free times offered
  requestKey: string | null; // one per booking form (decision 7); null when the owner books
  customer: ContactInputType;
  location: string; // the customer's address
  details: string | null; // what they wrote
  answers?: { questionId: string; answer: string }[]; // to the business's own questions (feature 9)
  // The customer's tick for later texts (decision 13); the booking's own texts go either way.
  laterTextsYes?: boolean;
  source: "widget" | "hosted" | "manual";
  actorUserId: string | null; // the owner's login when source is manual, checked here
  now: Date;
  // The public route's contact limit: asked once the form is known not to have booked already, so
  // a form sent again after a lost answer still gets its booking. False refuses this booking.
  admitNewBooking?: () => boolean;
};

export type BookedType = {
  id: string;
  leadId: string;
  contactId: string;
  bookingLinkId: string;
  personId: string;
  placeId: string | null;
  startsAt: Date;
  endsAt: Date; // the appointment's end, without the buffer after
  timezone: string; // the business's IANA zone
};

export type BookTimeResultType =
  | { booked: true; booking: BookedType; alreadyBooked: boolean }
  | {
      booked: false;
      reason:
        | "not_found"
        | "time_taken"
        | "unavailable"
        | "request_key_used"
        | "in_the_past"
        | "person_not_taken"
        | "unknown_question"
        | "answered_twice"
        | "too_many_tries";
    }
  | { booked: false; reason: "answer_needed"; question: string }; // the question's words

const MINUTE_MS = 60_000;
const NOT_FOUND = { booked: false, reason: "not_found" } as const;
const TIME_TAKEN = { booked: false, reason: "time_taken" } as const;
const UNAVAILABLE = { booked: false, reason: "unavailable" } as const;
const REQUEST_KEY_USED = { booked: false, reason: "request_key_used" } as const;
const IN_THE_PAST = { booked: false, reason: "in_the_past" } as const;
const PERSON_NOT_TAKEN = { booked: false, reason: "person_not_taken" } as const;
const TOO_MANY_TRIES = { booked: false, reason: "too_many_tries" } as const;

// The same form: the same service and start, and the same person when one was picked.
const isSameRequest = (existing: BookedType, input: BookTimeInputType) =>
  existing.bookingLinkId === input.bookingLinkId &&
  existing.startsAt.getTime() === input.startsAt.getTime() &&
  (input.personId === null || existing.personId === input.personId);

// Thrown inside the transaction when every choice was taken, so all of it is undone.
class EveryChoiceTakenError extends Error {}

const constraintOf = (error: unknown) =>
  (error as { cause?: { constraint_name?: unknown } }).cause?.constraint_name;

async function findBookedByRequestKey(
  organizationId: string,
  requestKey: string,
  timezone: string
): Promise<BookedType | null> {
  const [row] = await db
    .select({
      id: booking.id,
      leadId: booking.leadId,
      contactId: lead.contactId,
      bookingLinkId: booking.bookingLinkId,
      personId: booking.personId,
      placeId: booking.placeId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
    })
    .from(booking)
    .innerJoin(
      lead,
      and(eq(lead.organizationId, booking.organizationId), eq(lead.id, booking.leadId))
    )
    .where(and(eq(booking.organizationId, organizationId), eq(booking.requestKey, requestKey)))
    .limit(1);
  return row ? { ...row, timezone } : null;
}

export async function bookTime(input: BookTimeInputType): Promise<BookTimeResultType> {
  const { organizationId, bookingLinkId, personId, startsAt, requestKey, source, now } = input;
  if (Number.isNaN(startsAt.getTime())) throw new Error("Booking failed: the start is not a time.");

  // The owner's login must belong to this business; nothing else may book as the owner.
  if (source === "manual") {
    const [membership] = input.actorUserId
      ? await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(eq(member.organizationId, organizationId), eq(member.userId, input.actorUserId))
          )
          .limit(1)
      : [];
    if (!membership)
      throw new Error("Booking failed: that login does not belong to this business.");
  }

  const hours = await resolveBookableHours(organizationId, null, now);
  if (!hours) return NOT_FOUND;
  const { timezone } = hours;

  // Decision 7: a form already booked (a second request after a lost answer) gets that booking.
  // Asked first, and again before any refusal: a copy whose check ran after the first copy was
  // saved sees that copy's own time as taken.
  const bookedByThisForm = async (): Promise<BookTimeResultType | null> => {
    if (!requestKey) return null;
    const existing = await findBookedByRequestKey(organizationId, requestKey, timezone);
    if (!existing) return null;
    return isSameRequest(existing, input)
      ? { booked: true, booking: existing, alreadyBooked: true }
      : REQUEST_KEY_USED;
  };
  const refuseUnlessBooked = async (refusal: BookTimeResultType) =>
    (await bookedByThisForm()) ?? refusal;
  const earlier = await bookedByThisForm();
  if (earlier) return earlier;
  if (input.admitNewBooking && !input.admitNewBooking()) return TOO_MANY_TRIES;

  const [service] = await db
    .select({
      durationMinutes: bookingLink.durationMinutes,
      bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
      bufferAfterMinutes: bookingLink.bufferAfterMinutes,
      personChoice: bookingLink.personChoice,
    })
    .from(bookingLink)
    .where(
      and(
        eq(bookingLink.organizationId, organizationId),
        eq(bookingLink.id, bookingLinkId),
        eq(bookingLink.active, true)
      )
    )
    .limit(1);
  if (!service) return NOT_FOUND;
  // A customer never picks who does a service the business assigns (feature 9, decision 3); the
  // owner may. Asked after the form's own booking, so a retry of a booked form still gets it.
  if (source !== "manual" && service.personChoice === "business_assigns" && personId !== null)
    return PERSON_NOT_TAKEN;
  // The business's own questions (feature 9, decision 5): a customer answers the required ones; the
  // owner, booking from a phone call, need not.
  const checkedAnswers = checkAnswers(
    await findBookingQuestions(organizationId),
    input.answers ?? [],
    { requireAnswers: source !== "manual" }
  );
  if (!checkedAnswers.ok) {
    return checkedAnswers.reason === "answer_needed"
      ? { booked: false, reason: "answer_needed", question: checkedAnswers.question }
      : { booked: false, reason: checkedAnswers.reason };
  }
  const offered = await findServiceResources(organizationId, bookingLinkId);
  if (!offered) return NOT_FOUND;
  if (personId !== null && !offered.peopleIds.includes(personId)) return NOT_FOUND;

  const date = localDate(startsAt, timezone);
  // The owner may enter a walk-in already under way, never an earlier day (decision 13).
  if (source === "manual" && date < localDate(now, timezone)) return IN_THE_PAST;
  const { spanStart, spanEnd } = appointmentSpan(startsAt.getTime(), service);
  const span = { startsAt: new Date(spanStart), endsAt: new Date(spanEnd) };
  const endsAt = new Date(startsAt.getTime() + service.durationMinutes * MINUTE_MS);

  // Checked again: who and which room can take it, in the order to try them.
  const checked = await findBookingChoices({
    organizationId,
    bookingLinkId,
    offered,
    personId,
    startsAt,
    date,
    timezone,
    span: { spanStart, spanEnd },
    now,
    byOwner: source === "manual",
  });
  if (!checked.found) {
    return refuseUnlessBooked(checked.reason === "unavailable" ? UNAVAILABLE : TIME_TAKEN);
  }
  const { choices } = checked;

  // A tick counts only where the business asks, and only with a number that can get texts.
  const laterTextsYesPhone = input.laterTextsYes ? textablePhoneNumber(input.customer.phone) : null;
  const laterTextsYesWords = laterTextsYesPhone
    ? await findLaterTextsYesWords(organizationId)
    : null;

  const stage = await findFirstPipelineStage(organizationId);
  if (!stage) throw new Error("Booking failed: the business has no pipeline stage.");

  const bookingId = randomUUID();
  const leadId = randomUUID();
  try {
    const written = await db.transaction(async (tx) => {
      const { contact } = await findOrCreateContact(organizationId, input.customer, tx);
      await tx.insert(lead).values({
        id: leadId,
        organizationId,
        contactId: contact.id,
        stageId: stage.id,
        source,
        details: input.details,
        answers: checkedAnswers.answers,
        // The phone given with this request, kept with it for its event (decision 15).
        phone: contactValidationSchema.parse(input.customer).phone ?? null,
      });
      const [first] = choices;
      await tx.insert(booking).values({
        id: bookingId,
        organizationId,
        leadId,
        bookingLinkId,
        personId: first.personId,
        placeId: first.placeId,
        startsAt,
        endsAt,
        location: input.location,
        requestKey,
      });
      const held = await holdFirstFreeChoice(organizationId, choices, span, bookingId, tx);
      if (!held) throw new EveryChoiceTakenError();
      if (held !== first) {
        await tx
          .update(booking)
          .set({ personId: held.personId, placeId: held.placeId })
          .where(and(eq(booking.organizationId, organizationId), eq(booking.id, bookingId)));
      }
      await recordActivity(
        organizationId,
        {
          contactId: contact.id,
          type: "booking_created",
          payload: { leadId, bookingId, bookingLinkId, startsAt: startsAt.toISOString() },
          actorUserId: source === "manual" ? input.actorUserId : null,
        },
        tx
      );
      // Her yes to later texts: the latest one and its number on the contact, and the words she
      // saw on her timeline. No tick leaves an earlier yes as it was.
      if (laterTextsYesPhone && laterTextsYesWords) {
        await tx
          .update(contactTable)
          .set({ laterTextsYesAt: now, laterTextsYesPhone })
          .where(
            and(eq(contactTable.organizationId, organizationId), eq(contactTable.id, contact.id))
          );
        await recordActivity(
          organizationId,
          {
            contactId: contact.id,
            type: "later_texts_yes",
            payload: { bookingId, phone: laterTextsYesPhone, words: laterTextsYesWords },
            occurredAt: now,
          },
          tx
        );
      }
      // The two emails and the booked person's Google event, as jobs saved with the booking
      // (decision 1 of the background runner): the answer never waits for them.
      await enqueueBookingEmails(
        tx,
        organizationId,
        bookingId,
        ["booking_confirmation", "booking_notification"],
        0
      );
      await enqueueBookingEventJob(tx, {
        name: jobNames.bookingEventWrite,
        payload: { organizationId, bookingId, sequence: 0 },
      });
      // The customer's texts (feature 8b): the confirmation and the business's reminders.
      await enqueueBookingTexts(tx, {
        organizationId,
        bookingId,
        sequence: 0,
        startsAt,
        now,
        confirmation: true,
      });
      // The booked person's own text (feature 8c), from the form or the owner alike (decision 3).
      await enqueueWorkerText(tx, {
        organizationId,
        bookingId,
        personId: held.personId,
        sequence: 0,
        changedAt: now.toISOString(),
        kind: "added",
        startsAt: null,
      });
      return { contactId: contact.id, ...held };
    });
    return {
      booked: true,
      alreadyBooked: false,
      booking: { id: bookingId, leadId, bookingLinkId, startsAt, endsAt, timezone, ...written },
    };
  } catch (error) {
    if (error instanceof EveryChoiceTakenError) return refuseUnlessBooked(TIME_TAKEN);
    // Two copies of one form at the same instant: the database let the other one in; that is the answer.
    if (requestKey && constraintOf(error) === "booking_request_key_unique") {
      const other = await bookedByThisForm();
      if (other) return other;
    }
    // Never the database's own error: its message carries the customer's details.
    throw new Error(`Booking failed: ${safeErrorReason(error)}`);
  }
}
