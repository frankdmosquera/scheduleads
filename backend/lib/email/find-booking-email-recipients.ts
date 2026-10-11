// Backend: who hears about a booking by email, decided in this one place. The customer, when they
// gave an email; the business's notification address, unless the owner made the booking
// themselves (decision 10); the booked person only at their work email (12d.4, which replaces
// feature 6's decision 11 for a person who has one), whoever made the booking.

export type BookingEmailRecipientsInputType = {
  source: string; // the lead's: "widget", "hosted" or "manual" (the owner)
  customerEmail: string | null;
  notifyEmail: string;
  personWorkEmail: string | null; // the booked person's, or null: they have none
};

export type BookingEmailRecipientsType = {
  customer: string | null; // the confirmation's address, or null: none is sent
  business: string | null; // the notification's address, or null: none is sent
  customerReplyTo: string | null; // where the customer's Reply goes; null: the sending address
  person: string | null; // the booked person's own notification, or null: none is sent
};

export function findBookingEmailRecipients(
  input: BookingEmailRecipientsInputType
): BookingEmailRecipientsType {
  const workEmail = input.personWorkEmail;
  // A work email that is the business's own address gets only what the business gets, never twice.
  const sameAsBusiness = workEmail?.toLowerCase() === input.notifyEmail.toLowerCase();
  return {
    customer: input.customerEmail,
    business: input.source === "manual" ? null : input.notifyEmail,
    customerReplyTo: workEmail,
    person: workEmail && !sameAsBusiness ? workEmail : null,
  };
}
