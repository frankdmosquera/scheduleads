// Backend: writes a saved booking's Google event without making the customer wait for it (decision
// 6, review F-93). A failure keeps the booking and logs one line; feature 8 writes it again. The
// writes still running can be awaited, so a test (or later a shutdown) knows when Google is done.

import { writeBookingEvent } from "../calendar/write-booking-event.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingEventWrites = {
  start(organizationId: string, bookingId: string): void {
    const write: Promise<void> = writeBookingEvent(organizationId, bookingId)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          `[booking] no Google event yet for booking ${bookingId}: ${safeErrorReason(error)}`
        );
      })
      .finally(() => running.delete(write));
    running.add(write);
  },
  // Every write started so far has finished, written or failed.
  async settled(): Promise<void> {
    await Promise.all(running);
  },
};
