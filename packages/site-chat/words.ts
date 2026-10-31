// Site chat, what both sides share: the chat's words, the shape of a site's answers and the check of that shape.
// Neither client nor server code, so a site's data file can import it from anywhere.

export { englishChatWords } from "./words/english-chat-words.js";
export {
  personPaths,
  type ChatLanguageType,
  type ChatWordsType,
  type PersonPathType,
} from "./words/chat-words-type.js";
export type {
  ChatAnswersType,
  ChatTileItemType,
  ChatTileListType,
  ChatTileType,
  StoredAnswerType,
} from "./answers/chat-answers-type.js";
export { chatAnswersProblems } from "./answers/chat-answers-problems.js";
export type { ChatBookWordsType } from "./words/chat-book-words-type.js";
