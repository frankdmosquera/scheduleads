// Backend: the start times a customer can book for a service, with one picked person or "any
// available", over a range of the business's dates. Gathers who can do it and who is on standby,
// each person's bookable hours, bookings, time off and Google busy time, and the rooms, then puts
// each person through apply-free-times-rules.ts. Worked out on every request, never stored.

import { and, asc, eq, inArray } from "drizzle-orm";

import { bookingLink, resource } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { CalendarUnavailableError } from "../calendar/calendar-unavailable-error.js";
import type { BusyBlockType } from "../calendar/calendar-provider.js";
import { getBusyTimes } from "../calendar/get-busy-times.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { addDays } from "../local-time/add-days.js";
import { localDate } from "../local-time/local-date.js";
import { applyFreeTimesRules } from "./apply-free-times-rules.js";
import { findCommitments } from "./find-commitments.js";
import { findServiceResources } from "./find-service-resources.js";
import { findStandbyDates } from "./find-standby-dates.js";

export type FreeTimesType = {
  timezone: string; // the business's IANA zone
  people: { id: string; name: string }[]; // who the customer can pick, by name
  startTimes: string[]; // ISO 8601 instants in UTC, ascending, unique
};

export type FindFreeTimesInputType = {
  organizationId: string; // from the business being booked, never from the request
  bookingLinkId: string;
  personId: string | null; // null = "any available"
  fromDate: string; // YYYY-MM-DD in the business's zone, included
  toDate: string; // YYYY-MM-DD in the business's zone, included
  now: Date;
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

// null when the service is missing, inactive or another business's, the business has no hours,
// or the picked person is not offered for the service. Throws CalendarUnavailableError when the
// picked person's calendar cannot be read; with "any available" that person is left out instead,
// unless no calendar could be read at all (decision 9): an empty week would read as fully booked.
export async function findFreeTimes(input: FindFreeTimesInputType): Promise<FreeTimesType | null> {
  const { organizationId, bookingLinkId, personId, now } = input;

  const [service] = await db
    .select({
      durationMinutes: bookingLink.durationMinutes,
      bufferBeforeMinutes: bookingLink.bufferBeforeMinutes,
      bufferAfterMinutes: bookingLink.bufferAfterMinutes,
      slotIntervalMinutes: bookingLink.slotIntervalMinutes,
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
  if (!service) return null;

  const offered = await findServiceResources(organizationId, bookingLinkId);
  const businessHours = await resolveBookableHours(organizationId, null, now);
  if (!offered || !businessHours) return null;
  if (personId !== null && !offered.peopleIds.includes(personId)) return null;

  const people = offered.peopleIds.length
    ? await db
        .select({ id: resource.id, name: resource.name })
        .from(resource)
        .where(
          and(eq(resource.organizationId, organizationId), inArray(resource.id, offered.peopleIds))
        )
        .orderBy(asc(resource.name), asc(resource.id))
    : [];
  const timezone = businessHours.timezone;
  // Only today through the horizon can be booked, so nothing outside it is read. A range left the
  // wrong way round, by the clamp or by the caller, has nothing to offer.
  const today = localDate(now, timezone);
  const horizonEnd = addDays(today, businessHours.horizonDays);
  const fromDate = input.fromDate > today ? input.fromDate : today; // YYYY-MM-DD sorts as text
  const toDate = input.toDate < horizonEnd ? input.toDate : horizonEnd;
  if (fromDate > toDate) return { timezone, people, startTimes: [] };
  const candidates = personId === null ? offered.peopleIds : [personId];
  const placeIds = offered.placeIds ?? [];

  // Taken time is read a day wider than the range on each side, plus the buffers, so a buffer
  // reaching past the range, or a clock a day ahead of UTC, still sees what it touches.
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  const from = new Date(
    Date.UTC(fromYear, fromMonth - 1, fromDay) - DAY_MS - service.bufferBeforeMinutes * MINUTE_MS
  );
  const to = new Date(
    Date.UTC(toYear, toMonth - 1, toDay) + 2 * DAY_MS + service.bufferAfterMinutes * MINUTE_MS
  );

  const watched = [...candidates, ...placeIds];
  const [commitments, standby] = await Promise.all([
    findCommitments(organizationId, watched, from, to),
    findStandbyDates(organizationId, watched, fromDate, toDate),
  ]);
  const busyOf = (id: string): BusyBlockType[] =>
    commitments
      .filter((row) => row.resourceId === id)
      .map((row) => ({ start: row.startsAt, end: row.endsAt }));
  const standbyOf = (id: string) =>
    standby.filter((row) => row.resourceId === id).map((row) => row.date);
  const rooms =
    offered.placeIds === null
      ? null
      : placeIds.map((id) => ({ busy: busyOf(id), standbyDates: standbyOf(id) }));

  // Each person's own start times. People are read side by side, so six Google calendars cost
  // about one call's wait, not six.
  let readable = 0;
  let unreadable = 0;
  const timesOf = async (id: string): Promise<Date[]> => {
    const hours = await resolveBookableHours(organizationId, id, now);
    if (!hours) return [];

    let googleBusy: BusyBlockType[];
    try {
      googleBusy = await getBusyTimes({ organizationId, resourceId: id, from, to });
    } catch (error) {
      // Never read as free: a picked person's times cannot be known, and with "any available"
      // the person is left out. Either way the reason is logged, so the answer can be explained.
      const reason = safeErrorReason(error);
      if (personId !== null) {
        console.warn(
          `[free times] cannot answer for ${id}, whose calendar cannot be read: ${reason}`
        );
        throw new CalendarUnavailableError(undefined, { cause: error });
      }
      console.warn(`[free times] left out ${id}, whose calendar cannot be read: ${reason}`);
      unreadable += 1;
      return [];
    }
    readable += 1;

    return applyFreeTimesRules({
      hours,
      service,
      busy: [...busyOf(id), ...googleBusy],
      standbyDates: standbyOf(id),
      rooms,
      fromDate,
      toDate,
      now,
    });
  };

  const everyonesTimes = await Promise.all(candidates.map(timesOf));
  // One readable calendar is enough to answer; none, with one that failed, is "try again".
  if (readable === 0 && unreadable > 0) throw new CalendarUnavailableError();
  const starts = new Set<number>();
  for (const times of everyonesTimes) {
    for (const time of times) starts.add(time.getTime());
  }

  return {
    timezone,
    people,
    startTimes: [...starts].sort((a, b) => a - b).map((time) => new Date(time).toISOString()),
  };
}
