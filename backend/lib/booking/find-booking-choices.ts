// Backend: who and which room can take a start, checked again just before a booking is saved or
// moved, in the order to try them. The one check a new booking and a move share (decision 10 of
// the move: changing the time is booking again). A customer gets only the free times they are
// offered; the owner any time nobody is busy (decision 11). A booking a customer moves never stands
// in its own way; the owner's check does not take one yet (the owner's move, features 11 and 12b).

import { CalendarUnavailableError } from "../calendar/calendar-unavailable-error.js";
import { getBusyTimes } from "../calendar/get-busy-times.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import type { AppointmentSpanType } from "../scheduling/appointment-span.js";
import { countBookingsThatDay } from "../scheduling/count-bookings-that-day.js";
import { findCommitments } from "../scheduling/find-commitments.js";
import { findFreeTimes, type FindFreeTimesInputType } from "../scheduling/find-free-times.js";
import { findResourceNames } from "../scheduling/find-resource-names.js";
import type { ServiceResourcesType } from "../scheduling/find-service-resources.js";
import { findStandbyDates } from "../scheduling/find-standby-dates.js";
import { isRoomFree } from "../scheduling/is-room-free.js";
import {
  orderAnyAvailable,
  type AnyAvailableChoiceType,
} from "../scheduling/order-any-available.js";
import { overlapsAny } from "../scheduling/overlaps-any.js";

const DAY_MS = 86_400_000;

export type BookingChoicesInputType = {
  organizationId: string;
  bookingLinkId: string;
  offered: ServiceResourcesType; // who and which rooms the service uses
  personId: string | null; // null = "any available"
  startsAt: Date;
  date: string; // the start's YYYY-MM-DD in the business's zone
  timezone: string;
  span: AppointmentSpanType; // the start with its buffers
  now: Date;
} & (
  | { byOwner: true; movingBooking?: never } // any time nobody is busy, rooms on standby included
  | { byOwner: false; movingBooking?: FindFreeTimesInputType["ignoreBooking"] } // its own time is not busy
);

export type BookingChoicesType =
  | { found: true; choices: AnyAvailableChoiceType[] }
  | { found: false; reason: "time_taken" | "unavailable" };

export async function findBookingChoices(
  input: BookingChoicesInputType
): Promise<BookingChoicesType> {
  const { organizationId, bookingLinkId, offered, personId, startsAt, date, timezone, now } = input;
  const { spanStart, spanEnd } = input.span;
  const from = new Date(spanStart);
  const to = new Date(spanEnd);
  const movingId = input.movingBooking?.id;
  const notTheMovingBooking = (row: { bookingId: string | null }) => row.bookingId !== movingId;

  // A customer: the start must still be one of the free times. The owner: only real busy time
  // counts, bookings, time off and the person's own Google (Google wins).
  const isFree = async (id: string): Promise<"free" | "busy" | "unreadable"> => {
    if (!input.byOwner) {
      try {
        const answer = await findFreeTimes({
          organizationId,
          bookingLinkId,
          personId: id,
          fromDate: date,
          toDate: date,
          now,
          ignoreBooking: input.movingBooking,
        });
        return answer?.startTimes.includes(startsAt.toISOString()) ? "free" : "busy";
      } catch (error) {
        if (error instanceof CalendarUnavailableError) return "unreadable"; // the reason is logged there
        throw error;
      }
    }
    if ((await findCommitments(organizationId, [id], from, to)).length > 0) return "busy";
    try {
      const google = await getBusyTimes({ organizationId, resourceId: id, from, to });
      return overlapsAny(google, spanStart, spanEnd) ? "busy" : "free";
    } catch (error) {
      console.warn(`[booking] cannot read the calendar of ${id}: ${safeErrorReason(error)}`);
      return "unreadable";
    }
  };
  const candidates = personId === null ? offered.peopleIds : [personId];
  const states = await Promise.all(candidates.map(isFree)); // side by side, as the free times read them
  if (personId !== null && states[0] === "unreadable")
    return { found: false, reason: "unavailable" };
  const freePeople = candidates.filter((_, i) => states[i] === "free");
  // Nobody free: "try again" if a calendar could not be read (one of them may be free), else taken.
  if (freePeople.length === 0) {
    return { found: false, reason: states.includes("unreadable") ? "unavailable" : "time_taken" };
  }

  // The rooms: the one room rule over the whole span; the owner may use a room on standby.
  let freeRooms: { resourceId: string; name: string }[] | null = null;
  if (offered.placeIds !== null) {
    const [taken, standby, rooms] = await Promise.all([
      findCommitments(organizationId, offered.placeIds, from, to),
      input.byOwner ? [] : findStandbyDates(organizationId, offered.placeIds, date, date),
      findResourceNames(organizationId, offered.placeIds),
    ]);
    freeRooms = rooms.filter((room) =>
      isRoomFree(
        {
          busy: taken
            .filter((row) => row.resourceId === room.resourceId && notTheMovingBooking(row))
            .map((row) => ({ start: row.startsAt, end: row.endsAt })),
          standbyDates: standby
            .filter((row) => row.resourceId === room.resourceId)
            .map((row) => row.date),
        },
        date,
        spanStart,
        spanEnd
      )
    );
    if (freeRooms.length === 0) return { found: false, reason: "time_taken" };
  }

  // The order to try: fewest bookings that day (the moving booking not counted), then name, then
  // id, each person with the free rooms by name. A move with nobody picked tries its own person
  // first, so changing only the time never changes who comes while they are free (7b decision 14,
  // F-263).
  const dayRows = (
    await findCommitments(
      organizationId,
      freePeople,
      new Date(startsAt.getTime() - DAY_MS),
      new Date(startsAt.getTime() + DAY_MS)
    )
  ).filter(notTheMovingBooking);
  const counts = countBookingsThatDay(dayRows, date, timezone);
  const people = (await findResourceNames(organizationId, freePeople)).map((person) => ({
    ...person,
    bookingsThatDay: counts.get(person.resourceId) ?? 0,
  }));
  const choices = orderAnyAvailable(people, freeRooms);
  const ownPerson = personId === null ? input.movingBooking?.personId : undefined;
  if (!ownPerson) return { found: true, choices };
  return {
    found: true,
    choices: [
      ...choices.filter((choice) => choice.personId === ownPerson),
      ...choices.filter((choice) => choice.personId !== ownPerson),
    ],
  };
}
