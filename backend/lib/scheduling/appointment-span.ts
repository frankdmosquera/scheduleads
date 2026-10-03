// Backend: the time an appointment keeps busy: the buffer before, the appointment, the buffer
// after. One copy, so the free times check exactly the span a booking then holds.

const MINUTE_MS = 60_000;

export type AppointmentSpanType = { spanStart: number; spanEnd: number }; // ms, half-open

export function appointmentSpan(
  start: number, // ms; the appointment's own start
  service: { durationMinutes: number; bufferBeforeMinutes: number; bufferAfterMinutes: number }
): AppointmentSpanType {
  return {
    spanStart: start - service.bufferBeforeMinutes * MINUTE_MS,
    spanEnd: start + (service.durationMinutes + service.bufferAfterMinutes) * MINUTE_MS,
  };
}
