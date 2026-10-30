import type { ChatAnswersType } from "../answers/chat-answers-type.js";
import { englishBriefWords, type ChatBriefWordsType } from "./english-brief-words.js";

/** The brief's parts, each from the site's own data: the AI answers only from these. */
export interface ChatBriefPartsType {
  business: {
    name: string;
    /** What it does, as a phrase after its name: "a painting company in Calgary that paints home interiors". */
    about: string;
    /** Where it works. */
    area: string;
    phone?: string;
    email?: string;
    hours?: string;
    address?: string;
  };
  /** Decided facts no page says yet. A fact missing here and from the pages gets "someone can confirm" instead of a guess. */
  facts: readonly string[];
  /** The site's words, a section per page, a sentence a line. */
  pages: readonly { title: string; lines: readonly string[] }[];
}

export interface ChatBriefType {
  /** The whole system text, typed and spoken. Fixed text with no dates, so the provider caches it between questions. */
  typed: string;
  spoken: string;
  /** Jev's likeliest stored answers, added after the fixed brief so the brief stays cached. */
  headStart: (likely: readonly number[]) => string;
}

const fill = (text: string, values: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);

/**
 * The brief the AI gets with every question: the instructions, then the business, the extra knowledge, the
 * numbered stored answers and every page's words. Built once per server instance from the site's own data, never
 * from pasted copy, so it can never disagree with the site.
 */
export function buildChatBrief(
  parts: ChatBriefPartsType,
  answers: ChatAnswersType,
  words: ChatBriefWordsType = englishBriefWords
): ChatBriefType {
  const { business } = parts;
  const names = { name: business.name, about: business.about, area: business.area };
  const contact = [
    business.phone && fill(words.phone, { phone: business.phone }),
    business.email && fill(words.email, { email: business.email }),
    business.hours && fill(words.hours, { hours: business.hours }),
    business.address && fill(words.address, { address: business.address }),
  ].filter(Boolean);
  const facts = [words.business, fill(words.businessLine, names), ...contact].join("\n");
  const extra = parts.facts.length
    ? [words.extraKnowledge, ...parts.facts.map((fact) => `- ${fact}`)].join("\n")
    : "";
  const stored = [
    words.storedAnswers,
    ...answers.stored.map((q, i) => `[${i}] Q: ${q.question}\nA: ${q.answer}`),
  ].join("\n");
  const pages = [
    words.pages,
    ...parts.pages.map((page) =>
      [`## ${page.title}`, ...page.lines.map((line) => `- ${line}`)].join("\n")
    ),
  ].join("\n\n");
  const typed = [fill(words.instructions, names), words.brief, facts, extra, stored, pages]
    .filter(Boolean)
    .join("\n\n");
  return {
    typed,
    spoken: [typed, words.spoken].join("\n\n"),
    headStart: (likely) =>
      likely.length ? fill(words.headStart, { list: likely.map((i) => `[${i}]`).join(", ") }) : "",
  };
}
