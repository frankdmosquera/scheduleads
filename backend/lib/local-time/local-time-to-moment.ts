// Backend: the moment a business's clock shows `minuteOfDay` on `date`. null when that time does
// not exist (the hour skipped in spring); the first of the two when it happens twice (the autumn hour).

import { clockAsUtc } from "./clock-as-utc.js";

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

export function localTimeToMoment(
  date: string,
  minuteOfDay: number,
  timezone: string
): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, day) + minuteOfDay * MINUTE_MS;

  // A zone changes its offset at most once a day, so the offsets a day either side are the only
  // two this clock time can have.
  const candidates = [wanted - DAY_MS, wanted + DAY_MS]
    .map((probe) => wanted - (clockAsUtc(probe, timezone) - probe))
    .filter((moment) => clockAsUtc(moment, timezone) === wanted)
    .sort((a, b) => a - b);

  return candidates.length ? new Date(candidates[0]) : null;
}
