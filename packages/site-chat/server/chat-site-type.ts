import type { ChatAnswersType } from "../answers/chat-answers-type.js";
import type { ChatLanguageType, ChatWordsType } from "../words/chat-words-type.js";
import type { ChatBriefPartsType } from "./chat-brief.js";
import type { ChatBriefWordsType } from "./english-brief-words.js";

/** Everything the chat answers from in one language of one site. */
export interface ChatSiteType {
  lang: ChatLanguageType;
  answers: ChatAnswersType;
  words: ChatWordsType;
  brief: ChatBriefPartsType;
  /**
   * Words naming what the brief has its own details for (each service, each group): a question naming one goes to
   * the AI, unless the answer Jev picked names it too. None given, Jev answers as on ialaorden.com.
   */
  detailWords?: readonly string[];
  /** The brief's own instructions and headings; English unless given. */
  briefWords?: ChatBriefWordsType;
}
