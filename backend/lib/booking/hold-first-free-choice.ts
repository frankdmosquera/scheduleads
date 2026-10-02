// Backend: holds the first choice, in order, whose person (and room) the database still lets in.
// Each refusal is undone alone inside the caller's transaction, so a choice taken a moment ago
// passes to the next one. Answers the choice that holds, or null when every one was taken.

import type { DatabaseExecutorType } from "../../database-executor-type.js";
import { holdTime } from "../scheduling/hold-time.js";

export type BookingChoiceType = { personId: string; placeId: string | null };

export async function holdFirstFreeChoice(
  organizationId: string,
  choices: BookingChoiceType[], // already in order: the first is tried first
  span: { startsAt: Date; endsAt: Date }, // the appointment plus both buffers
  bookingId: string,
  executor: DatabaseExecutorType
): Promise<BookingChoiceType | null> {
  for (const choice of choices) {
    const held = await holdTime(
      organizationId,
      {
        resourceIds: choice.placeId ? [choice.personId, choice.placeId] : [choice.personId],
        startsAt: span.startsAt,
        endsAt: span.endsAt,
        kind: "booking",
        bookingId,
      },
      executor
    );
    if (held.held) return choice;
  }
  return null;
}
