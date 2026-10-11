// Backend: a booking's answers checked against the business's own questions (feature 9, decision
// 5), and the snapshot the lead keeps: each answer with the question's words as the customer read
// them, in the business's order, a blank one left out. No database.
//
// The form sends every question it showed, blank or not. A form opened before the owner
// changed the questions is still taken: an answer to a question removed meanwhile is kept under the
// words shown, after the business's own, and a required question the form never showed is left
// blank. A required question the form did show must be answered.

import type { LeadAnswerType } from "@scheduleads-app/shared/db";

import type { BookingQuestionType } from "./find-booking-questions.js";

export type GivenAnswerType = { questionId: string; question: string; answer: string }; // trimmed

export type CheckedAnswersType =
  | { ok: true; answers: LeadAnswerType[] | null } // null: nothing asked and nothing answered
  | { ok: false; reason: "answered_twice" }
  | { ok: false; reason: "answer_needed"; question: string };

export function checkAnswers(
  questions: BookingQuestionType[], // the business's, in its order
  given: GivenAnswerType[],
  { requireAnswers }: { requireAnswers: boolean } // a customer must answer the required ones
): CheckedAnswersType {
  const byId = new Map(given.map((answer) => [answer.questionId, answer]));
  if (byId.size < given.length) return { ok: false, reason: "answered_twice" };

  if (requireAnswers) {
    const unanswered = questions.find(
      (question) => question.required && byId.has(question.id) && !byId.get(question.id)?.answer
    );
    if (unanswered) return { ok: false, reason: "answer_needed", question: unanswered.label };
  }

  const asked = new Set(questions.map((question) => question.id));
  const answers = [
    ...questions.flatMap((question) => byId.get(question.id) ?? []),
    ...given.filter((answer) => !asked.has(answer.questionId)), // removed since the form opened
  ]
    .filter(({ answer }) => answer)
    .map(({ questionId, question, answer }) => ({ questionId, question, answer }));
  if (questions.length === 0 && answers.length === 0) return { ok: true, answers: null };
  return { ok: true, answers };
}
