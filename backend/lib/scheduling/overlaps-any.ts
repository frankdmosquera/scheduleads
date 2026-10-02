// Backend: does a span of time touch any busy block? Half-open, like the commitments rule: busy
// time ending at 10:00 leaves a 10:00 start free. Shared by the person and the room checks.

import type { BusyBlockType } from "../calendar/calendar-provider.js";

export function overlapsAny(busy: BusyBlockType[], spanStart: number, spanEnd: number): boolean {
  return busy.some((block) => block.start.getTime() < spanEnd && block.end.getTime() > spanStart);
}
