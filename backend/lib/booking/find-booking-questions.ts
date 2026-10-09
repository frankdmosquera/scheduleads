// Backend: a business's own booking questions, in its order (feature 9, decision 5), read inside
// that business only. The public service list shows them; booking a time checks answers against them.

import { asc, eq } from "drizzle-orm";

import { bookingQuestion } from "@scheduleads-app/shared/db";

import { db } from "../../database.js";

export type BookingQuestionType = { id: string; label: string; required: boolean };

export async function findBookingQuestions(organizationId: string): Promise<BookingQuestionType[]> {
  return db
    .select({
      id: bookingQuestion.id,
      label: bookingQuestion.label,
      required: bookingQuestion.required,
    })
    .from(bookingQuestion)
    .where(eq(bookingQuestion.organizationId, organizationId))
    .orderBy(asc(bookingQuestion.position), asc(bookingQuestion.id));
}
