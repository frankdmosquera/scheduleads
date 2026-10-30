import { allSentences } from "../agent/sentences.js";
import { personPaths, type ChatLanguageType } from "../words/chat-words-type.js";
import { voiceLineId } from "../voice/voice-line-id.js";
import type { ChatSiteType } from "./chat-site-type.js";

/** One sentence the voice address may speak, and its language. */
export interface VoiceLineType {
  text: string;
  lang: ChatLanguageType;
}

/**
 * Every fixed line one language of the site may say: the greeting, the hand-over, limit, off-topic, hello and
 * "Did you mean" lines, the ways' replies, every stored answer and every stored question ("Did you mean...?"
 * reads them).
 */
function fixedLines({ words, answers }: Pick<ChatSiteType, "words" | "answers">): string[] {
  return [
    words.float.greeting,
    words.handOver,
    words.limit,
    words.offTopic,
    words.greeting,
    words.suggest,
    ...personPaths.map((path) => words.paths[path]),
    ...answers.stored.map((s) => s.answer),
    ...answers.stored.map((s) => s.question),
  ];
}

/**
 * Every sentence of every fixed line, by id. Built from the same data Jev answers from, so a new stored answer is a
 * new line. Each sentence is its own sound, so a long line starts at once and the rest is made while the first
 * plays. The voice address speaks only these, never text someone sends.
 */
export async function buildVoiceLines(
  sites: readonly Pick<ChatSiteType, "lang" | "words" | "answers">[]
): Promise<Map<string, VoiceLineType>> {
  const entries = sites.flatMap((site) =>
    fixedLines(site)
      .flatMap(allSentences)
      .map((text) => ({ text, lang: site.lang }))
  );
  return new Map(
    await Promise.all(
      entries.map(async (line) => [await voiceLineId(line.text, line.lang), line] as const)
    )
  );
}
