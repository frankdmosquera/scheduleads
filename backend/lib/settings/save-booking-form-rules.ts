// Backend: saves what the business's booking form requires, from the owner's Booking form page
// (feature 12f): its contact rule, whether the form asks the customer's yes to later texts, and its
// language (feature 12i).

import { eq } from "drizzle-orm";

import { organization, textSettings } from "@scheduleads-app/shared/db";
import type { BookingFormRulesType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findBookingForm, type BookingFormSettingsType } from "./find-booking-form.js";

export type SaveBookingFormRulesResultType =
  | {
      ok: true;
      rules: Pick<BookingFormSettingsType, "contactRule" | "askLaterTextsYes" | "language">;
    }
  | { ok: false; reason: "no_text_settings" };

export async function saveBookingFormRules(
  organizationId: string,
  { contactRule, askLaterTextsYes, language }: BookingFormRulesType
): Promise<SaveBookingFormRulesResultType> {
  return db.transaction(async (tx) => {
    // Left as it is when the page did not show the choice. A business with no text settings sends
    // no texts, so its form cannot ask for the yes.
    if (askLaterTextsYes !== undefined) {
      const saved = await tx
        .update(textSettings)
        .set({ askLaterTextsYes })
        .where(eq(textSettings.organizationId, organizationId))
        .returning({ organizationId: textSettings.organizationId });
      if (!saved.length && askLaterTextsYes)
        return { ok: false, reason: "no_text_settings" } as const;
    }

    await tx
      .update(organization)
      .set({ contactRule, ...(language ? { language } : {}) })
      .where(eq(organization.id, organizationId));
    const saved = await findBookingForm(tx, organizationId);
    const rules = {
      contactRule: saved.contactRule,
      askLaterTextsYes: saved.askLaterTextsYes,
      language: saved.language,
    };
    return { ok: true, rules } as const;
  });
}
