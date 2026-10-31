import type { ChatAnswersType } from "./chat-answers-type.js";

/** One Jev choice may hold 255 options; one of ours is "none". */
export const MAX_STORED_ANSWERS = 254;

/**
 * What is wrong with a site's answers, as Jev and the chat would meet it: a renamed question would silently lose
 * its other wordings, its tiles or its group, so every key must be a stored question. Empty when all is well.
 */
export function chatAnswersProblems(answers: ChatAnswersType): string[] {
  const problems: string[] = [];
  const questions = answers.stored.map((s) => s.question);
  const known = new Set(questions);
  if (!questions.length) problems.push("there are no stored answers");
  if (questions.length > MAX_STORED_ANSWERS)
    problems.push(`more than ${MAX_STORED_ANSWERS} stored answers`);
  if (known.size !== questions.length) {
    const twice = questions.filter((q, i) => questions.indexOf(q) !== i);
    problems.push(`asked twice: ${[...new Set(twice)].join(" | ")}`);
  }
  for (const stored of answers.stored) {
    if (!stored.question.trim() || !stored.answer.trim())
      problems.push(`an empty question or answer: "${stored.question}"`);
  }
  const unknown = (where: string, question: string) => {
    if (!known.has(question))
      problems.push(`${where} names a question that is not stored: "${question}"`);
  };
  for (const question of Object.keys(answers.alsoAsked ?? {})) unknown("alsoAsked", question);
  for (const group of answers.groups ?? [])
    for (const question of group) unknown("a group", question);
  for (const list of answers.tiles ?? []) unknown("tiles", list.question);
  return problems;
}
