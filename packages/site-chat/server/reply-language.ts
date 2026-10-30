import type { ChatLanguageType } from "../words/chat-words-type.js";

/** What the reply language is decided from. */
export interface ReplyLanguageInputType {
  /** The site the visitor is on. */
  site: ChatLanguageType;
  /** The language the chat last answered in, when it has answered. */
  replyLang?: ChatLanguageType;
  /** Jev's read: how clearly the latest message is English, and Spanish (the probability of yes); absent when Jev did not answer. */
  english?: number;
  spanish?: number;
  /** How sure Jev must be. */
  yes: number;
}

/**
 * Which language a reply is in: a clearly English message gets English, a clearly Spanish one Spanish, and anything
 * unclear ("ok", a name) the language the chat last answered in, the site's own at the start. Never a mixed reply.
 */
export function replyLanguage({
  site,
  replyLang,
  english,
  spanish,
  yes,
}: ReplyLanguageInputType): ChatLanguageType {
  if (english !== undefined && english >= yes && (spanish === undefined || english >= spanish))
    return "en";
  if (spanish !== undefined && spanish >= yes) return "es";
  return replyLang ?? site;
}
