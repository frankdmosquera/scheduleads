// Backend: busy blocks with one span taken out of them. A booking being moved is crossed off its
// person's Google busy time (feature 7b, decision 11): Google's free/busy does not say which event
// is which, so the booking's own start to end is removed, and a block reaching past it keeps the
// part outside. Half-open, like every other time rule here.

import type { BusyBlockType } from "../calendar/calendar-provider.js";

export function crossOffSpan(busy: BusyBlockType[], span: BusyBlockType): BusyBlockType[] {
  return busy.flatMap((block) => {
    if (block.end <= span.start || block.start >= span.end) return [block]; // does not touch it
    const parts: BusyBlockType[] = [];
    if (block.start < span.start) parts.push({ start: block.start, end: span.start });
    if (block.end > span.end) parts.push({ start: span.end, end: block.end });
    return parts;
  });
}
