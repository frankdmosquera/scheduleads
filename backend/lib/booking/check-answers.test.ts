import { describe, expect, test } from "vitest";

import { checkAnswers } from "./check-answers.js";

// The clinic's two questions, the first required.
const questions = [
  { id: "allergies", label: "Any allergies or skin conditions?", required: true },
  { id: "first", label: "Is this your first visit?", required: false },
];
const customer = { requireAnswers: true };

describe("the business's own questions", () => {
  test("answers are kept with the question's words, in the business's order", () => {
    expect(
      checkAnswers(
        questions,
        [
          { questionId: "first", answer: "Yes" },
          { questionId: "allergies", answer: "Latex" },
        ],
        customer
      )
    ).toEqual({
      ok: true,
      answers: [
        { questionId: "allergies", question: "Any allergies or skin conditions?", answer: "Latex" },
        { questionId: "first", question: "Is this your first visit?", answer: "Yes" },
      ],
    });
  });

  test("an optional question left blank or out is left out", () => {
    const answers = [{ questionId: "allergies", answer: "None" }];
    const blank = [...answers, { questionId: "first", answer: "" }];

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

  test.each([
    ["left out", []],
    ["blank", [{ questionId: "allergies", answer: "" }]],
  ])("a required question %s is refused, naming it", (_name, given) => {
    expect(checkAnswers(questions, given, customer)).toEqual({
      ok: false,
      reason: "answer_needed",
      question: "Any allergies or skin conditions?",
    });
  });

  test("an answer to a question the business does not have is refused", () => {
    expect(
      checkAnswers(
        questions,
        [
          { questionId: "allergies", answer: "None" },
          { questionId: "someone-elses", answer: "Yes" },
        ],
        customer
      )
    ).toEqual({ ok: false, reason: "unknown_question" });
  });

  test("two answers to one question are refused", () => {
    expect(
      checkAnswers(
        questions,
        [
          { questionId: "allergies", answer: "None" },
          { questionId: "allergies", answer: "Latex" },
        ],
        customer
      )
    ).toEqual({ ok: false, reason: "answered_twice" });
  });

  test("a business that asks nothing keeps no answers, and refuses any sent", () => {
    expect(checkAnswers([], [], customer)).toEqual({ ok: true, answers: null });
    expect(checkAnswers([], [{ questionId: "allergies", answer: "None" }], customer)).toEqual({
      ok: false,
      reason: "unknown_question",
    });
  });

  test("the owner need not answer a required question", () => {
    expect(checkAnswers(questions, [], { requireAnswers: false })).toEqual({
      ok: true,
      answers: [],
    });
  });
});
