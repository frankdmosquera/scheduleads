import { describe, expect, it } from "vitest";

import { testAnswers } from "../test-site.js";
import { chatAnswersProblems, MAX_STORED_ANSWERS } from "./chat-answers-problems.js";
import { relatedQuestions } from "./related-questions.js";

describe("chatAnswersProblems", () => {
  it("passes a bank Jev can read", () => {
    expect(chatAnswersProblems(testAnswers)).toEqual([]);
  });

  it("names a wording, a group or tiles under a question that is not stored, so a rename is never silent", () => {
    const renamed = {
      ...testAnswers,
      alsoAsked: { "What do you offer?": ["What do you paint?"] },
      groups: [["What do you offer?"]],
      tiles: [{ question: "What do you offer?", tiles: [] }],
    };
    const problems = chatAnswersProblems(renamed);
    expect(problems).toHaveLength(3);
    expect(problems.every((p) => p.includes('"What do you offer?"'))).toBe(true);
  });

  it("refuses an empty bank, a question asked twice, an empty answer and more than Jev can choose from", () => {
    expect(chatAnswersProblems({ stored: [] })).toContain("there are no stored answers");
    const twice = { stored: [testAnswers.stored[0], testAnswers.stored[0]] };
    expect(chatAnswersProblems(twice)[0]).toMatch(/asked twice/);
    expect(chatAnswersProblems({ stored: [{ question: "Why?", answer: " " }] })[0]).toMatch(
      /empty/
    );
    const many = Array.from({ length: MAX_STORED_ANSWERS + 1 }, (_, i) => ({
      question: `Q${i}?`,
      answer: "A.",
    }));
    expect(chatAnswersProblems({ stored: many })[0]).toMatch(/more than 254/);
  });
});

describe("relatedQuestions", () => {
  it("offers the next questions of the same group, never one already answered", () => {
    const asked = new Set(["What services do you offer?"]);
    expect(relatedQuestions(testAnswers, "What services do you offer?", asked)).toEqual([
      "How long does a project take?",
      "Can I talk to someone?",
    ]);
    asked.add("How long does a project take?");
    expect(relatedQuestions(testAnswers, "How long does a project take?", asked)).toEqual([
      "Can I talk to someone?",
    ]);
  });

  it("offers none for a question in no group", () => {
    expect(
      relatedQuestions({ stored: testAnswers.stored }, "What services do you offer?", new Set())
    ).toEqual([]);
  });
});
