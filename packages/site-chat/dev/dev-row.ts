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
  /** A booking answered: from the calendar, a tapped button, the booking AI, or the word lists without it. */
  booking?: "calendar" | "button" | "ai" | "words";
}

/** One inspector row: which step of the ladder answered a question, and how long the visitor waited. */
export interface ChatDevRowType {
  question: string;
  who: "button" | "jev" | "ai" | "handOver" | "booking";
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
/** What answered a booking turn, in a few words. */
const BOOKING_DETAIL: Record<NonNullable<ChatDevFactsType["booking"]>, string> = {
  calendar: "the business's free times from Booking CRM, no AI",
  button: "tapped: the booking moved on in our own words, no AI",
  ai: "the booking AI read the reply into fields; our code checked each one and wrote the line",
  words: "no booking AI (limit or offline): the word lists read the reply",
};

export function devRow({ question, ms, chip, reply, booking }: ChatDevFactsType): ChatDevRowType {
  const row = (who: ChatDevRowType["who"], detail: string) => ({
    question,
    ms: Math.round(ms),
    who,
    detail,
  });
  if (booking) return row("booking", BOOKING_DETAIL[booking]);
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
