import type { ChatBookWordsType } from "../words/chat-book-words-type.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import { fillWords } from "../words/fill-words.js";
import { PART_HOURS, type AskedTimeType } from "./asked-day.js";
import type { BookingServiceType } from "./booking-api.js";
import type { BookingSourceType } from "./booking-source.js";
import { dayName, isoDay, todayIn, utcDate, wallClock } from "./business-clock.js";

/*
 * The free times a chat offers when a visitor asks for one: Booking CRM's real ones, on the business's clock as the
 * booking window shows them, on the day and part of day asked for, else the next ones. The chat shows them as
 * buttons and reads them out.
 */

/** How many times one answer offers: a row of buttons, never a wall. */
const MAX_TIMES = 6;

export interface ChatTimeType {
  /** The time alone, as the CRM writes it ("9:00 a.m."). */
  label: string;
  startsAt: string;
  /** YYYY-MM-DD on the business's clock. */
  date: string;
  /** Its day written out ("Saturday, October 31"), for the lines that name it. */
  day: string;
  /** Minutes into its day on the business's clock, for matching a time the visitor says ("2", "half past ten"). */
  minutes: number;
}

export interface ChatTimesFoundType {
  /** The line over the buttons: the day they are on, or why there are none. */
  text: string;
  times: ChatTimeType[];
  /** The business's zone, once the times were read. */
  timeZone: string | null;
  /** The calendar could not be read. */
  down?: boolean;
}

/**
 * The free times for what was asked, with the line that says which day they are on. `askedIn` reads what was asked
 * once today on the business's clock is known, so "tomorrow" is the business's tomorrow even near midnight.
 */
export async function chatTimes(
  source: BookingSourceType,
  service: BookingServiceType,
  askedIn: (today: Date) => AskedTimeType,
  lang: ChatLanguageType,
  words: ChatBookWordsType,
  now = new Date()
): Promise<ChatTimesFoundType> {
  // From yesterday in UTC, so the business's today is always inside.
  const from = utcDate(now, -1);
  let read;
  let asked: AskedTimeType;
  try {
    read = await source.times(service.id, from, lang);
    asked = askedIn(todayIn(read.timeZone, now));
    // A day past the first read: its own 31 dates.
    const askedIso = asked.day && isoDay(asked.day);
    if (askedIso && askedIso > utcDate(now, 29))
      read = await source.times(service.id, askedIso, lang);
  } catch {
    return { text: words.down, times: [], timeZone: null, down: true };
  }
  const zone = read.timeZone;
  const [first, last] = asked.part ? PART_HOURS[asked.part] : [0, 24];
  const free = read.times
    .map((t) => ({ ...t, minutes: wallClock(new Date(t.startsAt), zone).minutes }))
    .filter((t) => t.minutes >= first * 60 && t.minutes < last * 60);
  const timesOn = (date: string): ChatTimeType[] =>
    free
      .filter((t) => t.date === date)
      .slice(0, MAX_TIMES)
      .map((t) => ({
        label: t.time,
        startsAt: t.startsAt,
        date: t.date,
        day: dayName(t.date, words.dateLocale),
        minutes: t.minutes,
      }));
  const named = { service: service.name };

  const askedIso = asked.day && isoDay(asked.day);
  if (askedIso) {
    const onDay = timesOn(askedIso);
    if (onDay.length)
      return {
        text: fillWords(words.on, { ...named, day: dayName(askedIso, words.dateLocale) }),
        times: onDay,
        timeZone: zone,
      };
  }
  // None that day (or none asked): the first day after it with a free time in the part asked for.
  const after = askedIso ? free.find((t) => t.date > askedIso) : free[0];
  if (!after) return { text: words.none, times: [], timeZone: zone };
  const next = dayName(after.date, words.dateLocale);
  const text = askedIso
    ? fillWords(words.full, { ...named, day: dayName(askedIso, words.dateLocale), next })
    : fillWords(words.next, { ...named, day: next });
  return { text, times: timesOn(after.date), timeZone: zone };
}
