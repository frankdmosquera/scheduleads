// Backend: the upcoming bookings a save of hours left outside them, as the Hours card lists them.

import {
  applyOutsideHoursRules,
  type HoursRowsType,
} from "../bookable-hours/apply-outside-hours-rules.js";
import type { UpcomingBookingType } from "./find-upcoming-bookings.js";
import { listedBookingOf, type ListedBookingType } from "./listed-booking.js";

export function outsideHoursOf(
  before: HoursRowsType | null,
  after: HoursRowsType,
  upcoming: UpcomingBookingType[],
  now: Date
): ListedBookingType[] {
  return applyOutsideHoursRules(before, after, upcoming, now).map(listedBookingOf);
}
