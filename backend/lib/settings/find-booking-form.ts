// Backend: what the owner's Booking form page shows (feature 12f): the business's own questions in
// order, and the ready-made sets to start from.

import { asc, eq } from "drizzle-orm";

import { bookingQuestion } from "@scheduleads-app/shared/db";

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { bookingQuestionSets, type BookingQuestionSetType } from "./booking-question-sets.js";

export type BookingFormSettingsType = {
  questions: { id: string; label: string; required: boolean }[];
  presets: BookingQuestionSetType[];
};

export async function findBookingForm(
  executor: DatabaseExecutorType,
  organizationId: string
): Promise<BookingFormSettingsType> {
  const questions = await executor
    .select({
      id: bookingQuestion.id,
      label: bookingQuestion.label,
      required: bookingQuestion.required,
    })
    .from(bookingQuestion)
    .where(eq(bookingQuestion.organizationId, organizationId))
    .orderBy(asc(bookingQuestion.position), asc(bookingQuestion.id));
  return { questions, presets: bookingQuestionSets };
}
