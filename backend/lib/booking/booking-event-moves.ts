// Backend: makes a moved booking's Google event follow it without making the customer wait
// (decision 5), in the shape of the event writes and removals. A failure keeps the move and logs
// one line; feature 8 tries again. The moves still running can be awaited, so a test (or later a
// shutdown) knows when Google is done.

import { moveBookingEvent } from "../calendar/move-booking-event.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingEventMoves = {
  start(organizationId: string, bookingId: string, fromPersonId: string): void {
    const move: Promise<void> = moveBookingEvent(organizationId, bookingId, fromPersonId)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          `[booking] the Google event of moved booking ${bookingId} did not follow: ${safeErrorReason(error)}`
        );
      })
      .finally(() => running.delete(move));
    running.add(move);
  },
  // Every move started so far has finished, moved or failed.
  async settled(): Promise<void> {
    await Promise.all(running);
  },
};
