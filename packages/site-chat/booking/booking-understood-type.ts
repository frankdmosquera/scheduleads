import type { ChatTraceType, ChatTurnType } from "../agent/chat-event-type.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import type { DayPartType } from "./asked-day.js";

/** What the booking AI understood from one reply: every field is checked by the chat before it is used. */
export interface BookingUnderstoodType {
  /** The listed service chosen, counted from 1. */
  service: number | null;
  /** The listed time chosen, counted from 1. */
  time: number | null;
  /** Another day asked for, YYYY-MM-DD. */
  day: string | null;
  part: DayPartType | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  /** The project box's answer, in the visitor's words. */
  details: string | null;
  /** Answers to the business's own questions, by question id. */
  answers: { id: string; answer: string }[];
  /** Declined the question just asked, which the form does not require. */
  skip: boolean;
  /** A yes to the read-back, changing nothing. */
  book: boolean;
  cancel: boolean;
  /** Not about the booking: the chat answers it as any question. */
  other: boolean;
  /** What the chat says when the reply moved nothing on (a time not free, a question about the booking). */
  reply: string;
}

/** One field of the business's form as the booking AI sees it, with what was given so far. */
export interface BookingAskFieldType {
  /** "name", "email", "phone", "contact", "address", "details" or "answer:<question id>". */
  key: string;
  label: string;
  required: boolean;
  value: string | null;
}

/** What the chat sends the booking route with each reply during a booking. */
export interface BookingAskBodyType {
  lang: ChatLanguageType;
  business: string;
  /** The service being booked; null while the visitor picks one. */
  service: string | null;
  /** The services on screen as buttons, while the visitor picks one. */
  services: string[];
  today: string;
  todayIso: string;
  /** The day the times on screen are on. */
  day: string;
  times: string[];
  picked: string | null;
  fields: BookingAskFieldType[];
  /** What the chat last asked for: "service", "time", a field's key, or "confirm" for the read-back. */
  asking: string;
  aiSpent?: boolean;
  messages: ChatTurnType[];
}

/** The booking route's answer: the fields it understood, or why there are none. */
export interface BookingAskAnswerType {
  understood?: BookingUnderstoodType;
  trace?: ChatTraceType;
  error?: "invalid" | "limit" | "unavailable";
}
