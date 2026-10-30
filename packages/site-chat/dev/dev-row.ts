import type { ChatReplyType } from "../agent/ask-chat.js";
import type { ChatTraceType, JevTraceType } from "../agent/chat-event-type.js";

/** What the chat hands the inspector after each question, laptop only. */
export interface ChatDevFactsType {
  question: string;
  /** How long the visitor waited, in milliseconds. */
  ms: number;
  /** A tapped button answered from the site's own answers, with no server. */
  chip: boolean;
  /** The server's reply, when the question went there. */
  reply: ChatReplyType | null;
}

/** One inspector row: which step of the ladder answered a question, and how long the visitor waited. */
export interface ChatDevRowType {
  question: string;
  who: "button" | "jev" | "ai" | "handOver";
  detail: string;
  ms: number;
}

const sure = (confidence: number | undefined) =>
  confidence === undefined ? "" : ` ${Math.round(confidence * 100)}%`;

/** What Jev decided, in a few words. */
function jevDetail(jev: JevTraceType | undefined): string {
  if (!jev) return "Jev not asked";
  const time = `, Jev ${jev.ms} ms`;
  switch (jev.kind) {
    case "person":
      return `wants a person: ${jev.path}${sure(jev.confidence)}${time}`;
    case "greeting":
      return `greeting${sure(jev.confidence)}: friendly reply${time}`;
    case "offTopic":
      return `off topic${sure(jev.confidence)}: polite reply${time}`;
    case "stored":
      return `picked "${jev.pick}"${sure(jev.confidence)}${time}`;
    case "suggest":
      return `fairly sure${sure(jev.confidence)}: did you mean "${jev.questions?.join('" or "')}"${time}`;
    case "unsure":
      return `Jev unsure: "${jev.pick}"${sure(jev.confidence)}${time}`;
    case "skipped":
      return `Jev skipped (${jev.reason}${jev.status ? ` ${jev.status}` : ""})${time}`;
  }
}

/** How the server reached its answer, after Jev: the LLM writing or picking, when it was asked. */
function serverDetail(trace: ChatTraceType | undefined): string {
  const jev = jevDetail(trace?.jev);
  if (trace?.llmPicked) return `LLM picked "${trace.llmPicked}" (our exact words); ${jev}`;
  return jev;
}

/** One row: which step of the ladder answered, from what the chat decided and the server replied. */
export function devRow({ question, ms, chip, reply }: ChatDevFactsType): ChatDevRowType {
  const row = (who: ChatDevRowType["who"], detail: string) => ({
    question,
    ms: Math.round(ms),
    who,
    detail,
  });
  if (chip)
    return row("button", "tapped, not typed: a stored answer from the site's own words, no server");
  if (!reply) return row("handOver", "the chat's code did not load: a person takes it");
  const trace = reply.trace;
  if (reply.error)
    return row(
      "handOver",
      `${reply.error === "limit" ? "AI limit reached" : "LLM unavailable"}; ${serverDetail(trace)}`
    );
  if (trace?.llmPicked) return row("ai", serverDetail(trace));
  if (reply.stored || reply.person || reply.suggest) return row("jev", serverDetail(trace));
  return row("ai", serverDetail(trace));
}
