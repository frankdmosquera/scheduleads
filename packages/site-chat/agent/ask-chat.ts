import { CHAT_SETTINGS } from "./chat-settings.js";
import type { ChatEventType, ChatTraceType, ChatTurnType } from "./chat-event-type.js";
import type { ChatLanguageType, PersonPathType } from "../words/chat-words-type.js";

/** The server's finished answer: its words, or the fixed line it picked, or why there is none. */
export interface ChatReplyType {
  text: string;
  /** One of the site's fixed lines: `text` is a stored answer or a fixed reply, never the AI's words. */
  stored?: boolean;
  /** The stored question `text` answers, when it is one. */
  question?: string;
  /** Every way to a person opens under the answer. */
  ways?: boolean;
  /** The visitor asked for a person: the chat offers this way, with no text of its own. */
  person?: PersonPathType;
  /** Jev is fairly sure: "Did you mean...?" with these stored questions. */
  suggest?: string[];
  /** The language the answer was in: the chat sends it back with its next question. */
  lang?: ChatLanguageType;
  /** Laptop only: how the server reached its answer, for the inspector. */
  trace?: ChatTraceType;
  error?: "invalid" | "unavailable" | "limit";
}

const ANSWERS_KEY = "site-chat-answers";

/** AI answers this tab has had; a soft limit, so it fails open when storage is blocked. */
function answersSoFar(): number {
  try {
    return Number(sessionStorage.getItem(ANSWERS_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function countAnswer() {
  try {
    sessionStorage.setItem(ANSWERS_KEY, String(answersSoFar() + 1));
  } catch {
    // Storage blocked: the server's limits still apply.
  }
}

/**
 * The conversation's last turns, starting with the visitor, within every server limit (turns, question and answer
 * lengths), so one long message can never make the server refuse the rest of a chat.
 */
export function recentTurns(turns: readonly ChatTurnType[]): ChatTurnType[] {
  const recent = turns
    .map((t) => ({
      role: t.role,
      text: t.text
        .trim()
        .slice(
          0,
          t.role === "user" ? CHAT_SETTINGS.maxQuestionChars : CHAT_SETTINGS.maxAnswerChars
        ),
    }))
    .filter((t) => t.text)
    .slice(-CHAT_SETTINGS.maxTurns);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}

/**
 * Asks the site's server a typed question (Jev first, then the AI) and reads its answer as it streams: `onText`
 * gets the AI's words so far each time more arrive. With `spoken`, the question was asked out loud: the answer
 * comes back short, and `onSentence` gets each sentence as it is ready, with its sound when Google made it. Never
 * throws; a failure comes back as an error the chat turns into its hand-over.
 */
export async function askChat(
  request: {
    url: string;
    lang: ChatLanguageType;
    replyLang?: ChatLanguageType;
    turns: readonly ChatTurnType[];
    spoken?: {
      voice: string;
      onSentence: (text: string, audio?: string, lang?: ChatLanguageType) => void;
    };
  },
  onText: (soFar: string) => void,
  signal?: AbortSignal
): Promise<ChatReplyType> {
  const reply: ChatReplyType = { text: "" };
  try {
    const res = await fetch(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lang: request.lang,
        ...(request.replyLang && { replyLang: request.replyLang }),
        // The visit's AI limit only stops the AI: Jev and the fixed lines still answer.
        ...(answersSoFar() >= CHAT_SETTINGS.answersPerVisit && { aiSpent: true }),
        messages: recentTurns(request.turns),
        ...(request.spoken && { spoken: true, voice: request.spoken.voice }),
      }),
      signal,
    });
    if (!res.body) return { text: "", error: "unavailable" };
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffered = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffered += decoder.decode(value, { stream: true });
      let end: number;
      while ((end = buffered.indexOf("\n")) >= 0) {
        const event = JSON.parse(buffered.slice(0, end)) as ChatEventType;
        buffered = buffered.slice(end + 1);
        read(event, reply, request, onText);
      }
    }
  } catch {
    return { text: reply.text, error: "unavailable" };
  }
  // Only the AI's own answers count toward the visit's limit: Jev's picks cost next to nothing.
  if (reply.error || reply.person || reply.stored || reply.suggest) return reply;
  if (reply.text) countAnswer();
  else reply.error = "unavailable";
  return reply;
}

function read(
  event: ChatEventType,
  reply: ChatReplyType,
  request: Parameters<typeof askChat>[0],
  onText: (soFar: string) => void
) {
  switch (event.type) {
    case "text":
      reply.text += event.delta;
      onText(reply.text);
      return;
    case "speak":
      request.spoken?.onSentence(event.text, event.audio, event.lang);
      return;
    case "ways":
      reply.ways = true;
      return;
    case "stored":
      reply.text = event.text;
      reply.stored = true;
      reply.question = event.question;
      reply.ways = event.ways;
      return;
    case "fixed":
      reply.text = event.text;
      reply.stored = true;
      return;
    case "person":
      reply.person = event.path;
      return;
    case "suggest":
      reply.suggest = event.questions;
      return;
    case "trace":
      reply.trace = { ...reply.trace, ...event.trace };
      return;
    case "error":
      reply.error = event.code;
      if (event.lang) reply.lang = event.lang;
      return;
    case "done":
      if (event.lang) reply.lang = event.lang;
  }
}
