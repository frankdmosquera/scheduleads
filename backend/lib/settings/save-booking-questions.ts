// Backend: saves the business's own booking questions from the owner's Booking form page (feature
// 12f), the whole list at once and in its order: a kept question is changed in place, a missing one
// removed, a new one added. A lead's answers keep their own copy of each question's words, so a
// change or a removal here never touches them.

import { randomUUID } from "node:crypto";

import { and, eq, inArray, notInArray } from "drizzle-orm";

import { bookingQuestion } from "@scheduleads-app/shared/db";
import type { BookingQuestionsType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { findBookingForm, type BookingFormSettingsType } from "./find-booking-form.js";
import { lockBusinessResources } from "./lock-business-resources.js";

export type SaveBookingQuestionsResultType =
  | { ok: true; questions: BookingFormSettingsType["questions"] }
  | { ok: false; reason: "not_found" };

export async function saveBookingQuestions(
  organizationId: string,
  { questions }: BookingQuestionsType
): Promise<SaveBookingQuestionsResultType> {
  return db.transaction(async (tx) => {
    // Two saves of the list run one after the other and the last one wins; bookings still go in.
    await lockBusinessResources(tx, organizationId);

    // Every id sent must be one of this business's questions.
    const keptIds = questions.flatMap((question) => (question.id ? [question.id] : []));
    if (keptIds.length) {
      const found = await tx
        .select({ id: bookingQuestion.id })
        .from(bookingQuestion)
        .where(
          and(
            eq(bookingQuestion.organizationId, organizationId),
            inArray(bookingQuestion.id, keptIds)
          )
        );
      if (found.length !== keptIds.length) return { ok: false, reason: "not_found" } as const;
    }

    await tx
      .delete(bookingQuestion)
      .where(
        and(
          eq(bookingQuestion.organizationId, organizationId),
          keptIds.length ? notInArray(bookingQuestion.id, keptIds) : undefined
        )
      );
    for (const [position, question] of questions.entries()) {
      const fields = { position, label: question.label, required: question.required };
      if (question.id)
        await tx
          .update(bookingQuestion)
          .set(fields)
          .where(
            and(
              eq(bookingQuestion.organizationId, organizationId),
              eq(bookingQuestion.id, question.id)
            )
          );
      else await tx.insert(bookingQuestion).values({ id: randomUUID(), organizationId, ...fields });
    }

    return { ok: true, questions: (await findBookingForm(tx, organizationId)).questions } as const;
  });
}
