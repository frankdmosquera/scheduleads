// Shared: whether a booking leaves the way to reach the customer its business requires (feature
// 12f). The one check the booking route and the booking window both run, so the two always ask
// the same. Returns the field to mark and what to say, or null when the customer left enough.

import type { ContactRuleType } from "../zod-validation/crm-validation-schemas/contact-rule-validation-schema.js";

export function missingContact(
  rule: ContactRuleType,
  customer: { email?: string; phone?: string } // trimmed; an empty box is left out
): { field: "email" | "phone"; message: string } | null {
  if (rule === "email")
    return customer.email ? null : { field: "email", message: "Enter an email." };
  if (rule === "phone")
    return customer.phone ? null : { field: "phone", message: "Enter a phone number." };
  return customer.email || customer.phone
    ? null
    : { field: "email", message: "Enter an email or a phone number. At least one is required." };
}
