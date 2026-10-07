// Backend: the one plain line when a booking's text is not sent: ids, which text and why, never a
// number or the words.

export function logTextNotSent(bookingId: string, kind: string, reason: string): void {
  console.log(`[text] booking ${bookingId}: ${kind} not sent, ${reason}`);
}
