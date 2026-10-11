// Shared Zod schema: the business's own booking questions as the owner saves them on Settings
// (feature 12f), the whole list in order. A question with an id is one already saved; one without
// is new. A setup file's questions keep the same rules.

import { z } from "zod";

export const BOOKING_QUESTIONS_MAX = 20;

const questionLabelValidationSchema = z
  .string("Write the question.")
  .trim()
  .min(1, "Write the question.")
  .max(200, "Keep the question to 200 characters.");
const questionRequiredValidationSchema = z.boolean("Pick whether it must be answered.");

// A list of questions as the business keeps it: at most 20, no two with the same words.
function questionListValidationSchema<ItemType extends z.ZodType<{ label: string; id?: string }>>(
  item: ItemType
) {
  return z
    .array(item, "That is not a list of questions.")
    .max(BOOKING_QUESTIONS_MAX, `Ask at most ${BOOKING_QUESTIONS_MAX} questions.`)
    .superRefine((questions, context) => {
      // The customer could not tell two of the same apart; the first repeat is the one marked.
      const seen = new Set<string>();
      questions.forEach((question, index) => {
        const words = question.label.toLowerCase();
        if (seen.has(words))
          context.addIssue({
            code: "custom",
            message: "This question is already on the list.",
            path: [index, "label"],
          });
        seen.add(words);
      });
      const ids = questions.flatMap((question) => (question.id ? [question.id] : []));
      if (new Set(ids).size !== ids.length)
        context.addIssue({ code: "custom", message: "A question is listed twice." });
    });
}

// A setup file's questions: new ones only, so no ids.
export const setupQuestionsValidationSchema = questionListValidationSchema(
  z
    .object({ label: questionLabelValidationSchema, required: questionRequiredValidationSchema })
    .strict()
);

export const bookingQuestionsValidationSchema = z
  .object({
    questions: questionListValidationSchema(
      z
        .object({
          id: z
            .string("That is not a question id.")
            .regex(/^[A-Za-z0-9_-]{1,64}$/, "That is not a question id.")
            .optional(),
          label: questionLabelValidationSchema,
          required: questionRequiredValidationSchema,
        })
        .strict()
    ),
  })
  .strict();

export type BookingQuestionsInputType = z.input<typeof bookingQuestionsValidationSchema>;
export type BookingQuestionsType = z.output<typeof bookingQuestionsValidationSchema>;
