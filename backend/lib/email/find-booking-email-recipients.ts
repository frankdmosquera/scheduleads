// Backend: who hears about a booking by email, decided in this one place. The customer, when they
// gave an email; the business's notification address, unless the owner made the booking
// themselves (decision 10); never the booked worker (decision 11). A person's own work email
// (feature 12) joins here.

export type BookingEmailRecipientsInputType = {
  source: string; // the lead's: "widget", "hosted" or "manual" (the owner)
  customerEmail: string | null;
  notifyEmail: string;
};

export type BookingEmailRecipientsType = {
  customer: string | null; // the confirmation's address, or null: none is sent
  business: string | null; // the notification's address, or null: none is sent
};

export function findBookingEmailRecipients(
  input: BookingEmailRecipientsInputType
): BookingEmailRecipientsType {
  return {
    customer: input.customerEmail,
    business: input.source === "manual" ? null : input.notifyEmail,
  };
}
