import type { ChatLanguageType, PersonPathType } from "../words/chat-words-type.js";

/** One message of a chat as it travels to the server: plain text only. */
export interface ChatTurnType {
  role: "user" | "assistant";
  text: string;
}

/** What Jev decided for one question, as the inspector shows it: never the visitor's words. */
export interface JevTraceType {
  kind: "person" | "greeting" | "offTopic" | "stored" | "suggest" | "unsure" | "skipped";
  /** The stored question Jev picked ("none" when it picked none). */
  pick?: string;
  path?: PersonPathType;
  /** The stored questions offered as "Did you mean", or given to the AI as its head start. */
  questions?: string[];
  confidence?: number;
  reason?: string;
  status?: number;
  ms: number;
  /** What Jev weighed: its read of the intent and its likeliest stored questions. */
  seen?: {
    intent: string;
    intentConfidence: number;
    top: { question: string; confidence: number }[];
    oneThing?: number;
    clarity?: number;
  };
}

/** Laptop only: how the server reached its answer, for the inspector. */
export interface ChatTraceType {
  jev?: JevTraceType;
  /** The stored question the AI gave back in our exact words, instead of writing its own. */
  llmPicked?: string;
  /** Jev's read of the message's language, and the language the reply is in. */
  language?: { english?: number; spanish?: number; reply: ChatLanguageType };
  ai?: {
    model: string;
    spoken: boolean;
    firstWordMs?: number;
    totalMs: number;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
  };
}

/** One line of the server's answer stream (newline-separated JSON). */
export type ChatEventType =
  | { type: "text"; delta: string }
  /** The AI marked its answer as needing a person: every way to one opens under it. */
  | { type: "ways" }
  /** One of the site's stored answers, picked by Jev or the AI: shown whole, in the site's exact words. */
  | { type: "stored"; text: string; question: string; ways?: true }
  /** One of the chat's fixed lines (a greeting, off topic), never the AI's words. */
  | { type: "fixed"; text: string }
  /** The visitor asked for a person: the chat offers that way. */
  | { type: "person"; path: PersonPathType }
  /** Jev is fairly sure: "Did you mean...?" with these stored questions as buttons. */
  | { type: "suggest"; questions: string[] }
  | { type: "trace"; trace: ChatTraceType }
  /** A spoken answer's next sentence, with its sound as base64 MP3 when Google made it. */
  | { type: "speak"; text: string; audio?: string; lang?: ChatLanguageType }
  /** The answer is complete; `lang` is the language it was in, which the chat keeps for the next question. */
  | { type: "done"; lang?: ChatLanguageType }
  | { type: "error"; code: "invalid" | "unavailable" | "limit"; lang?: ChatLanguageType };
