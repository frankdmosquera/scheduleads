// Backend: the lane a booking's worker texts run in (feature 8c), as its calendar jobs have theirs
// (8a, decision 5). One of 256, named by the last two characters of the booking's id: two of its
// worker texts never run at once and run in the order they were added, so "already told" and
// "knew of it" (decision 5) read every text an earlier change sent.

export function workerTextLaneOf(bookingId: string): string {
  return `worker-text-${bookingId.slice(-2).toLowerCase()}`;
}
