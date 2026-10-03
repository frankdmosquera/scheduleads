// Backend: removes a cancelled booking's Google event without making the customer wait for it
// (decision 5), in the shape of the event writes. A failure keeps the cancel and logs one line;
// feature 8 removes it again. The removals still running can be awaited, so a test (or later a
// shutdown) knows when Google is done.

import { removeBookingEvent } from "../calendar/remove-booking-event.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingEventRemovals = {
  start(organizationId: string, bookingId: string): void {
    const removal: Promise<void> = removeBookingEvent(organizationId, bookingId)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          `[booking] the Google event of cancelled booking ${bookingId} is still there: ${safeErrorReason(error)}`
        );
      })
      .finally(() => running.delete(removal));
    running.add(removal);
  },
  // Every removal started so far has finished, removed or failed.
  async settled(): Promise<void> {
    await Promise.all(running);
  },
};
