import { describe, expect, test } from "vitest";

import { checkAnswers } from "./check-answers.js";

// The clinic's two questions, the first required.
const questions = [
  { id: "allergies", label: "Any allergies or skin conditions?", required: true },
  { id: "first", label: "Is this your first visit?", required: false },
];
const customer = { requireAnswers: true };
// What the form sends: each question it showed, with its words as shown.
const shown = (questionId: string, answer: string, words?: string) => ({
  questionId,
  question: words ?? questions.find((question) => question.id === questionId)?.label ?? "Gone?",
  answer,
});

describe("the business's own questions", () => {
  test("answers are kept with the question's words, in the business's order", () => {
    expect(
      checkAnswers(questions, [shown("first", "Yes"), shown("allergies", "Latex")], customer)
    ).toEqual({
      ok: true,
      answers: [
        { questionId: "allergies", question: "Any allergies or skin conditions?", answer: "Latex" },
        { questionId: "first", question: "Is this your first visit?", answer: "Yes" },
      ],
    });
  });

  test("an optional question left blank or out is left out", () => {
    const answers = [shown("allergies", "None")];
    const blank = [...answers, shown("first", "")];

    expect(checkAnswers(questions, answers, customer)).toEqual({
      ok: true,
      answers: [
        { questionId: "allergies", question: "Any allergies or skin conditions?", answer: "None" },
      ],
    });
    expect(checkAnswers(questions, blank, customer)).toEqual(
      checkAnswers(questions, answers, customer)
    );
  });

  test("a required question the form showed and left blank is refused, naming it", () => {
    expect(checkAnswers(questions, [shown("allergies", "")], customer)).toEqual({
      ok: false,
      reason: "answer_needed",
      question: "Any allergies or skin conditions?",
    });
  });

  // The form was opened before the owner changed the questions.
  test("a required question the form never showed is left blank, not refused", () => {
    expect(checkAnswers(questions, [shown("first", "Yes")], customer)).toEqual({
      ok: true,
      answers: [{ questionId: "first", question: "Is this your first visit?", answer: "Yes" }],
    });
  });

  test("an answer to a question removed meanwhile is kept under the words shown, after the business's", () => {
    expect(
      checkAnswers(
        questions,
        [shown("gone", "A dog", "Any pets at home?"), shown("allergies", "None")],
        customer
      )
    ).toEqual({
      ok: true,
      answers: [
        { questionId: "allergies", question: "Any allergies or skin conditions?", answer: "None" },
        { questionId: "gone", question: "Any pets at home?", answer: "A dog" },
      ],
    });
  });

  test("a question reworded meanwhile keeps the words the customer read", () => {
    expect(
      checkAnswers(questions, [shown("allergies", "Latex", "Any allergies?")], customer)
    ).toEqual({
      ok: true,
      answers: [{ questionId: "allergies", question: "Any allergies?", answer: "Latex" }],
    });
  });

  test("two answers to one question are refused", () => {
    expect(
      checkAnswers(questions, [shown("allergies", "None"), shown("allergies", "Latex")], customer)
    ).toEqual({ ok: false, reason: "answered_twice" });
  });

  test("a business that asks nothing keeps no answers, and keeps those of a form opened before", () => {
    expect(checkAnswers([], [], customer)).toEqual({ ok: true, answers: null });
    expect(checkAnswers([], [shown("allergies", "", "Any allergies?")], customer)).toEqual({
      ok: true,
      answers: null,
    });
    expect(checkAnswers([], [shown("allergies", "None", "Any allergies?")], customer)).toEqual({
      ok: true,
      answers: [{ questionId: "allergies", question: "Any allergies?", answer: "None" }],
    });
  });

  test("the owner need not answer a required question", () => {
    expect(checkAnswers(questions, [shown("allergies", "")], { requireAnswers: false })).toEqual({
      ok: true,
      answers: [],
    });
  });
});
