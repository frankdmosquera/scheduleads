// Shared Zod schema: which way to reach the customer a business's booking form requires (feature
// 12f), and the one check of it the booking route and the booking window both run, so the two
// always ask the same.

import { z } from "zod";

export const contactRuleValidationSchema = z.enum(["email", "phone", "either"], {
  error: "Pick what a customer must leave.",
});

export type ContactRuleType = z.output<typeof contactRuleValidationSchema>;

// The field to mark and what to say, or null when the customer left what the rule asks.
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
