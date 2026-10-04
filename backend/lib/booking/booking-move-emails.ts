// Backend: sends a moved booking's emails without making the customer wait for them (decision 5),
// in the shape of the cancellation emails. A failure keeps the move and logs one line; feature 8
// retries. The sends still running can be awaited, so a test (or later a shutdown) knows when they
// are done.

import { sendMoveEmails } from "../email/send-move-emails.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingMoveEmails = {
  start(organizationId: string, bookingId: string, sequence: number): void {
    const send: Promise<void> = sendMoveEmails(organizationId, bookingId, sequence)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          `[email] no move emails for booking ${bookingId} (move ${sequence}): ${safeErrorReason(error)}`
        );
      })
      .finally(() => running.delete(send));
    running.add(send);
  },
  // Every send started so far has finished, sent or failed.
  async settled(): Promise<void> {
    await Promise.all(running);
  },
};
