// Backend: sends a saved booking's emails without making the customer wait for them (decision 1,
// as the Google event). A failure keeps the booking and logs one line; feature 8 retries. The sends
// still running can be awaited, so a test (or later a shutdown) knows when they are done.

import { sendBookingEmails } from "../email/send-booking-emails.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

const running = new Set<Promise<void>>();

export const bookingConfirmationEmails = {
  start(organizationId: string, bookingId: string): void {
    const send: Promise<void> = sendBookingEmails(organizationId, bookingId)
      .then(() => undefined)
      .catch((error: unknown) => {
        console.warn(`[email] no emails for booking ${bookingId}: ${safeErrorReason(error)}`);
      })
      .finally(() => running.delete(send));
    running.add(send);
  },
  // Every send started so far has finished, sent or failed.
  async settled(): Promise<void> {
    await Promise.all(running);
  },
};
