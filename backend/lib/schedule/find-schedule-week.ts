// Backend: one person's or place's week for the Calendar page (feature 12b): each day's bookable
// hours or closed, the bookings with their customer, time off, and a person's Google busy times
// shown apart. Read from what the booking window already reads; nothing here decides who is free.

import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { addDays } from "@scheduleads-app/shared/add-days";
import {
  booking,
  bookingLink,
  calendarConnection,
  contact,
  lead,
  resource,
} from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";
import type { TimeWindowType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { resolveBookableHours } from "../bookable-hours/resolve-bookable-hours.js";
import { windowsOnDate } from "../bookable-hours/windows-on-date.js";
import type { BusyBlockType } from "../calendar/calendar-provider.js";
import { getBusyTimes } from "../calendar/get-busy-times.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";
import { findCommitments } from "../scheduling/find-commitments.js";
import { findStandbyDates } from "../scheduling/find-standby-dates.js";

export type ScheduleBookingType = {
  id: string;
  leadId: string;
  customerName: string;
  serviceName: string;
  personName: string;
  placeName: string | null;
};

export type ScheduleItemType =
  | { kind: "booking"; startsAt: Date; endsAt: Date; booking: ScheduleBookingType }
  | { kind: "time_off"; id: string; startsAt: Date; endsAt: Date }
  | { kind: "google_busy"; startsAt: Date; endsAt: Date };

export type ScheduleDayType = {
  date: string; // YYYY-MM-DD in the business's zone
  closed: boolean; // a closed day or a picked holiday (12e), not opened for this one
  standby: boolean; // on standby (5b): at work, hidden from customers, so no bookable hours
  hours: TimeWindowType[]; // when customers can book; [] on a closed day
  items: ScheduleItemType[]; // every item touching this day, in start order
};

export type ScheduleWeekType = {
  weekOf: string; // the Monday
  days: ScheduleDayType[];
  google: "read" | "not_connected" | "unreadable";
};

const DAY_MS = 86_400_000;

export async function findScheduleWeek({
  organizationId, // from the session, never from the request
  resource: shown, // one of the business's own, checked by the caller
  timezone,
  weekOf,
}: {
  organizationId: string;
  resource: { id: string; kind: string };
  timezone: string;
  weekOf: string; // the Monday, YYYY-MM-DD in the business's zone
}): Promise<ScheduleWeekType> {
  const dates = Array.from({ length: 7 }, (_, n) => addDays(weekOf, n));
  const [year, month, day] = weekOf.split("-").map(Number);
  // A day either side covers every zone; items are then placed by their own local dates.
  const from = new Date(Date.UTC(year, month - 1, day) - DAY_MS);
  const to = new Date(Date.UTC(year, month - 1, day) + 8 * DAY_MS);

  // The hours as on the Hours page, whatever the customers' horizon: the owner sees the whole week.
  const weekStart = new Date(Date.UTC(year, month - 1, day));
  const [hours, held, standby] = await Promise.all([
    resolveBookableHours(organizationId, shown.id, weekStart, { coverDays: 8 }),
    findCommitments(organizationId, [shown.id], from, to),
    findStandbyDates(organizationId, [shown.id], dates[0], dates[6]),
  ]);
  const closed = new Set(hours?.closedDates ?? []);
  const onStandby = new Set(standby.map((row) => row.date));

  const bookingIds = held.flatMap((row) =>
    row.kind === "booking" && row.bookingId ? [row.bookingId] : []
  );
  const person = alias(resource, "person");
  const place = alias(resource, "place");
  const bookings =
    bookingIds.length === 0
      ? []
      : await db
          .select({
            id: booking.id,
            leadId: booking.leadId,
            startsAt: booking.startsAt,
            endsAt: booking.endsAt,
            customerName: contact.name,
            serviceName: bookingLink.name,
            personName: person.name,
            placeName: place.name,
          })
          .from(booking)
          .innerJoin(
            lead,
            and(eq(lead.organizationId, organizationId), eq(lead.id, booking.leadId))
          )
          .innerJoin(
            contact,
            and(eq(contact.organizationId, organizationId), eq(contact.id, lead.contactId))
          )
          .innerJoin(
            bookingLink,
            and(
              eq(bookingLink.organizationId, organizationId),
              eq(bookingLink.id, booking.bookingLinkId)
            )
          )
          .innerJoin(
            person,
            and(eq(person.organizationId, organizationId), eq(person.id, booking.personId))
          )
          .leftJoin(
            place,
            and(eq(place.organizationId, organizationId), eq(place.id, booking.placeId))
          )
          .where(and(eq(booking.organizationId, organizationId), inArray(booking.id, bookingIds)));

  const items: ScheduleItemType[] = [
    // The booking's own times, as the customer was told them, never the buffers it holds.
    ...bookings.map(({ startsAt, endsAt, ...details }) => ({
      kind: "booking" as const,
      startsAt,
      endsAt,
      booking: details,
    })),
    ...held
      .filter((row) => row.kind === "time_off")
      .map((row) => ({
        kind: "time_off" as const,
        id: row.id,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
      })),
  ];

  let google: ScheduleWeekType["google"] = "not_connected";
  if (shown.kind === "person") {
    const [connection] = await db
      .select({ id: calendarConnection.id })
      .from(calendarConnection)
      .where(
        and(
          eq(calendarConnection.organizationId, organizationId),
          eq(calendarConnection.resourceId, shown.id)
        )
      )
      .limit(1);
    if (connection) {
      try {
        // The app's own bookings are in the main calendar too: crossed off there, shown once.
        const busy: BusyBlockType[] = await getBusyTimes({
          organizationId,
          resourceId: shown.id,
          from,
          to,
          crossOffOnMain: bookings.map((row) => ({ start: row.startsAt, end: row.endsAt })),
        });
        items.push(
          ...busy.map((block) => ({
            kind: "google_busy" as const,
            startsAt: block.start,
            endsAt: block.end,
          }))
        );
        google = "read";
      } catch (error) {
        // The rest of the week still shows; the page says Google could not be read.
        console.warn(
          `[calendar] a week's Google busy times could not be read: ${safeErrorReason(error)}`
        );
        google = "unreadable";
      }
    }
  }

  // An item belongs to every local day it touches: its start's date through its last moment's.
  const touches = (item: ScheduleItemType, date: string) =>
    localDate(item.startsAt, timezone) <= date &&
    localDate(new Date(item.endsAt.getTime() - 1), timezone) >= date;
  const inOrder = [...items].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return {
    weekOf,
    google,
    days: dates.map((date) => ({
      date,
      closed: closed.has(date),
      standby: onStandby.has(date),
      // As the booking window reads it: no customer is offered a closed or a standby day.
      hours: !hours || closed.has(date) || onStandby.has(date) ? [] : windowsOnDate(hours, date),
      items: inOrder.filter((item) => touches(item, date)),
    })),
  };
}
