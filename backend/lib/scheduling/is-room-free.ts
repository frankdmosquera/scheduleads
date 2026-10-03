// Backend: the one room rule. A room can take an appointment when it is not on standby that date
// and nothing it holds touches the appointment plus both buffers. The free times and the booking
// both ask this, so they can never disagree about which room is free.

import type { BusyBlockType } from "../calendar/calendar-provider.js";
import { overlapsAny } from "./overlaps-any.js";

// A room's taken time and the dates it is hidden from customers. Callers may carry more (its id).
export type RoomScheduleType = { busy: BusyBlockType[]; standbyDates: string[] };

export function isRoomFree(
  room: RoomScheduleType,
  date: string, // YYYY-MM-DD in the business's zone
  spanStart: number, // ms; the appointment's start minus the buffer before
  spanEnd: number // ms; the appointment's end plus the buffer after
): boolean {
  return !room.standbyDates.includes(date) && !overlapsAny(room.busy, spanStart, spanEnd);
}
