// Backend: the times two lists of windows on one date share (feature 12k): a person's bookable hours
// narrowed by when a service runs. Neither list is ever widened; a window with no length is left out.

import type { TimeWindowType } from "@scheduleads-app/shared/zod-validation";

export function overlapWindows(a: TimeWindowType[], b: TimeWindowType[]): TimeWindowType[] {
  const shared: TimeWindowType[] = [];
  for (const one of a) {
    for (const other of b) {
      const startMinute = Math.max(one.startMinute, other.startMinute);
      const endMinute = Math.min(one.endMinute, other.endMinute);
      if (startMinute < endMinute) shared.push({ startMinute, endMinute });
    }
  }
  return shared.sort((x, y) => x.startMinute - y.startMinute);
}
