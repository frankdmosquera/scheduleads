import type { ChatTileType } from "../answers/chat-answers-type.js";
import type { ChatBookingType } from "../booking/chat-booking.js";
import type { PersonPathType } from "../words/chat-words-type.js";

/** One bubble of the conversation, and what is under it. */
export interface BubbleType {
  id: number;
  from: "me" | "them";
  text: string;
  typing?: boolean;
  /** The visitor asked for a way to a person: its button, carrying the question. `toWindow`: the site's own booking. */
  go?: { path: PersonPathType; message: string; toWindow?: boolean };
  /** A booking at its time or service step: the free times, or the services, as buttons. */
  booking?: ChatBookingType;
  /** The booking under this bubble is no longer the open one: its buttons are shown, but cannot be tapped. */
  stale?: boolean;
  /** "Did you mean...?": stored questions the visitor can tap for their answer. */
  choices?: string[];
  /** Other questions from the same group as the stored question just answered, as buttons. */
  related?: string[];
  /** Nobody could answer: every way to a person, each carrying this question. */
  ways?: string;
  /** An answer that is a list, drawn as tiles under its words. */
  tiles?: readonly ChatTileType[];
}

/**
 * The list with bubble `id` now showing `bubble`. Only the booking still open (`open`) keeps tappable buttons: an
 * older bubble's times carry an older booking and its key, and tapping one could book a second time.
 */
export function showBubble(
  list: readonly BubbleType[],
  id: number,
  bubble: Omit<BubbleType, "id">,
  open: ChatBookingType | null
): BubbleType[] {
  return list.map((b) => {
    const shown = b.id === id ? { ...bubble, id } : b;
    return shown.booking && shown.booking !== open && !shown.stale
      ? { ...shown, stale: true }
      : shown;
  });
}
