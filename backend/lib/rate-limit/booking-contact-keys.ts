// Backend: the keys a booking counts against, its email and its phone, each inside one business,
// so Primo's bookings never count against Face and Body's.

import { textablePhoneNumber } from "@scheduleads-app/shared/textable-phone-number";

export function bookingContactKeys(
  organizationId: string,
  customer: { email?: string; phone?: string }
): string[] {
  const keys: string[] = [];

  // The form's schema has already trimmed and lowercased it; done again so the key never depends on it.
  const email = customer.email?.trim().toLowerCase();
  if (email) keys.push(`${organizationId}:email:${email}`);

  // "+1 403 555 0100" and "403-555-0100" are one phone; any other number counts by its digits.
  const phone = customer.phone
    ? (textablePhoneNumber(customer.phone) ?? customer.phone.replace(/\D/g, ""))
    : "";
  if (phone) keys.push(`${organizationId}:phone:${phone}`);

  return keys;
}
