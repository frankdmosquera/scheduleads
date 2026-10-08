// Backend: a booking's answers checked against the business's own questions (feature 9, decision
// 5), and the snapshot the lead keeps: each answer with the question's words as asked, in the
// business's order, a blank optional one left out. No database.

import type { LeadAnswerType } from "@scheduleads-app/shared/db";

export type BookingQuestionType = { id: string; label: string; required: boolean };

export type CheckedAnswersType =
  | { ok: true; answers: LeadAnswerType[] | null } // null: the business asks nothing
  | { ok: false; reason: "unknown_question" | "answered_twice" }
  | { ok: false; reason: "answer_needed"; question: string };

export function checkAnswers(
  questions: BookingQuestionType[], // the business's, in its order
  given: { questionId: string; answer: string }[], // already trimmed
  { requireAnswers }: { requireAnswers: boolean } // a customer must answer the required ones
): CheckedAnswersType {
  const byId = new Map(given.map((answer) => [answer.questionId, answer.answer]));
  if (byId.size < given.length) return { ok: false, reason: "answered_twice" };
  const known = new Set(questions.map((question) => question.id));
  if (given.some((answer) => !known.has(answer.questionId))) {
    return { ok: false, reason: "unknown_question" };
  }

  if (requireAnswers) {
    const unanswered = questions.find((question) => question.required && !byId.get(question.id));
    if (unanswered) return { ok: false, reason: "answer_needed", question: unanswered.label };
  }

  if (questions.length === 0) return { ok: true, answers: null };
  return {
    ok: true,
    answers: questions.flatMap((question) => {
      const answer = byId.get(question.id);
      return answer ? [{ questionId: question.id, question: question.label, answer }] : [];
    }),
  };
}
