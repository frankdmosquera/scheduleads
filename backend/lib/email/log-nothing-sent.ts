// Backend: the one plain line when a business cannot send a booking's emails yet (feature 6,
// decision 4: no sender, no email). Ids and what is missing only.

export function logNothingSent(bookingId: string, missing: string[]): void {
  console.log(
    `[email] booking ${bookingId}: nothing sent, the business has no ${missing.join(", ")}`
  );
}
