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
  /** The brief's own instructions and headings; English unless given. */
  briefWords?: ChatBriefWordsType;
}
