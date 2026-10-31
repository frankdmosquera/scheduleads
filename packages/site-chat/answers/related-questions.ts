import type { ChatAnswersType } from "./chat-answers-type.js";

/**
 * Up to `count` other questions from the same group as the stored `question` just answered (a button only when
 * it relates to the conversation), never one already `asked`. A question in no group has none.
 */
export function relatedQuestions(
  answers: ChatAnswersType,
  question: string,
  asked: ReadonlySet<string>,
  count = 2
): string[] {
  const group = answers.groups?.find((g) => g.includes(question));
  if (!group) return [];
  return group.filter((q) => q !== question && !asked.has(q)).slice(0, count);
}
