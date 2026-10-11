// Shared Zod schema: which way to reach the customer a business's booking form requires (feature
// 12f). The check itself is helpers/missing-contact.ts.

import { z } from "zod";

export const contactRuleValidationSchema = z.enum(["email", "phone", "either"], {
  error: "Pick what a customer must leave.",
});

export type ContactRuleType = z.output<typeof contactRuleValidationSchema>;
