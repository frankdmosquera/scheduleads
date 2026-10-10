// Backend: the upcoming bookings a save of hours left outside them, as the Hours card lists them.

import {
  applyOutsideHoursRules,
  type HoursRowsType,
} from "../bookable-hours/apply-outside-hours-rules.js";
import type { OutsideHoursBookingType } from "./outside-hours-booking-type.js";
import type { UpcomingBookingType } from "./find-upcoming-bookings.js";

export function outsideHoursOf(
  before: HoursRowsType | null,
  after: HoursRowsType,
  upcoming: UpcomingBookingType[],
  now: Date
): OutsideHoursBookingType[] {
  return applyOutsideHoursRules(before, after, upcoming, now).map((outside) => ({
    bookingId: outside.bookingId,
    leadId: outside.leadId,
    customerName: outside.customerName,
    serviceName: outside.serviceName,
    personName: outside.personName,
    startsAt: outside.startsAt.toISOString(),
    endsAt: outside.endsAt.toISOString(),
  }));
}
