// Backend: sends a cancelled booking's emails without making the customer wait for them (decision
// 5), in the shape of the confirmation emails. A failure keeps the cancel and logs one line;
// feature 8 retries. The sends still running can be awaited, so a test (or later a shutdown)
// knows when they are done.

import { sendCancellationEmails } from "../email/send-cancellation-emails.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingCancellationEmails = {
  start(organizationId: string, bookingId: string): void {
    const send: Promise<void> = sendCancellationEmails(organizationId, bookingId)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(
          `[email] no cancellation emails for booking ${bookingId}: ${safeErrorReason(error)}`
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
