import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatTurnType } from "../agent/chat-event-type.js";
import type { BookingAskBodyType } from "./booking-understood-type.js";
import { fieldLimits } from "./contact-checks.js";

/**
 * How much one booking AI call may carry, the same in the chat and on the route: a few short turns and the form's
 * fields, so a call stays near 6,000 characters and the route is never a way to reach the AI with anything else.
 */
export const BOOKING_ASK_LIMITS = {
  turns: 8,
  userChars: CHAT_SETTINGS.maxQuestionChars,
  // The chat's own lines are short; a long AI answer from earlier in the chat is cut to its start.
  assistantChars: 600,
  services: 12,
  times: 6,
  fields: 16,
  labelChars: 200,
  totalChars: 6000,
} as const;

/** The longest value a field may carry: its booking route limit. */
export function fieldValueLimit(key: string): number {
  if (key === "details") return fieldLimits.details;
  if (key.startsWith("answer:")) return fieldLimits.answer;
  if (key === "name") return fieldLimits.name;
  if (key === "phone") return fieldLimits.phone;
  if (key === "address") return fieldLimits.address;
  return fieldLimits.email;
}

/** Every character a call carries in its words: what the total limit counts. */
export function askChars(body: BookingAskBodyType): number {
  const words = [
    body.business,
    body.service ?? "",
    ...body.services,
    body.day,
    ...body.times,
    body.picked ?? "",
    ...body.fields.flatMap((f) => [f.label, f.value ?? ""]),
    ...body.messages.map((m) => m.text),
  ];
  return words.reduce((sum, w) => sum + w.length, 0);
}

/** The conversation's last turns, starting with the visitor, each within its limit. */
export function bookingTurns(turns: readonly ChatTurnType[]): ChatTurnType[] {
  const recent = turns
    .map((t) => ({
      role: t.role,
      text: t.text
        .trim()
        .slice(
          0,
          t.role === "user" ? BOOKING_ASK_LIMITS.userChars : BOOKING_ASK_LIMITS.assistantChars
        ),
    }))
    .filter((t) => t.text)
    .slice(-BOOKING_ASK_LIMITS.turns);
  while (recent.length && recent[0].role !== "user") recent.shift();
  return recent;
}

/** The body within every limit: the oldest turns dropped until the whole call fits, the visitor's latest kept. */
export function withinAskLimits(body: BookingAskBodyType): BookingAskBodyType {
  const fitted = { ...body, messages: bookingTurns(body.messages) };
  while (askChars(fitted) > BOOKING_ASK_LIMITS.totalChars && fitted.messages.length > 1) {
    fitted.messages = fitted.messages.slice(1);
    while (fitted.messages.length > 1 && fitted.messages[0].role !== "user")
      fitted.messages = fitted.messages.slice(1);
  }
  return fitted;
}
