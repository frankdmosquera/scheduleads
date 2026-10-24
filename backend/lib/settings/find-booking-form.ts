// Backend: what the owner's Booking form page shows (feature 12f): the business's own questions in
// order, the ready-made sets to start from, and what the form requires.

import { asc, eq } from "drizzle-orm";

import { bookingQuestion, organization, textSettings } from "@scheduleads-app/shared/db";
import type { ContactRuleType } from "@scheduleads-app/shared/zod-validation";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { bookingQuestionSets, type BookingQuestionSetType } from "./booking-question-sets.js";

export type BookingFormSettingsType = {
  questions: { id: string; label: string; required: boolean }[];
  presets: BookingQuestionSetType[];
  contactRule: ContactRuleType;
  askLaterTextsYes: boolean | null; // null: no text settings yet, so the form cannot ask
  language: "en" | "es"; // its owner's emails, and a booking that came with none (feature 12i)
};

export async function findBookingForm(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<BookingFormSettingsType> {
  const [questions, [rules]] = await Promise.all([
    executor
      .select({
        id: bookingQuestion.id,
        label: bookingQuestion.label,
        required: bookingQuestion.required,
      })
      .from(bookingQuestion)
      .where(eq(bookingQuestion.organizationId, organizationId))
      .orderBy(asc(bookingQuestion.position), asc(bookingQuestion.id)),
    executor
      .select({
        contactRule: organization.contactRule,
        askLaterTextsYes: textSettings.askLaterTextsYes,
        language: organization.language,
      })
      .from(organization)
      .leftJoin(textSettings, eq(textSettings.organizationId, organization.id))
      .where(eq(organization.id, organizationId))
      .limit(1),
  ]);
  if (!rules) throw new Error(`Business ${organizationId} was not found.`);
  return { questions, presets: bookingQuestionSets, ...rules };
}
