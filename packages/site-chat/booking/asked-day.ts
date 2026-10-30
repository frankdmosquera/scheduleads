import type { ChatLanguageType } from "../words/chat-words-type.js";

/*
 * What a visitor asking for a time said about when: "book me Saturday", "tomorrow afternoon", "¿tiene algo el sábado
 * en la tarde?". Plain word lists in both languages, read in the browser before anything is sent, so asking for
 * times costs nothing and never waits on the AI. Whatever it cannot read is left to the next free times.
 */

/** Part of a day a visitor named; the hours each covers are `PART_HOURS`. */
export type DayPartType = "morning" | "afternoon" | "evening";

/** Each part's hours on the business's clock, from the first hour up to the last (not included). */
export const PART_HOURS: Record<DayPartType, [number, number]> = {
  morning: [0, 12],
  afternoon: [12, 17],
  evening: [17, 24],
};

export interface AskedTimeType {
  /** The day named, at midnight as a plain calendar day; null when none was. */
  day: Date | null;
  part: DayPartType | null;
}

/** Sunday first, as `Date.getDay()` counts, each weekday's names without accents. */
const WEEKDAYS: Record<ChatLanguageType, readonly (readonly string[])[]> = {
  en: [
    ["sunday", "sun"],
    ["monday", "mon"],
    ["tuesday", "tue", "tues"],
    ["wednesday", "wed"],
    ["thursday", "thu", "thurs"],
    ["friday", "fri"],
    ["saturday", "sat"],
  ],
  es: [["domingo"], ["lunes"], ["martes"], ["miercoles"], ["jueves"], ["viernes"], ["sabado"]],
};

const WORDS = {
  en: {
    // A part of today, said as one: "this afternoon", "tonight".
    todayParts: {
      "this morning": "morning",
      "this afternoon": "afternoon",
      "this evening": "evening",
      tonight: "evening",
    },
    today: ["today"],
    tomorrow: ["tomorrow"],
    afterTomorrow: ["day after tomorrow"],
    parts: { morning: ["morning"], afternoon: ["afternoon"], evening: ["evening"] },
    // Asking for a time, said the ways people say it: phrases, so "appointment reminders" on another question
    // never reads as one.
    asks: [
      "book me",
      "book a",
      "book an",
      "book us",
      "book it",
      "book in",
      "can i book",
      "can we book",
      "could i book",
      "i want to book",
      "i d like to book",
      "schedule me",
      "schedule a",
      "schedule an",
      "set up a",
      "an appointment",
      "an estimate",
      "a visit",
      "a meeting",
      "a call",
      "do you have",
      "you have something",
      "you have anything",
      "anything",
      "something",
      "any time",
      "any times",
      "free time",
      "free times",
      "available",
      "availability",
      "a slot",
      "openings",
      "can we meet",
      "can you come",
      "come by",
      "come over",
    ],
    // A question about prices is answered as one, even with a day in it.
    notAsks: ["how much", "cost", "costs", "price", "prices", "pay"],
  },
  es: {
    todayParts: { "esta manana": "morning", "esta tarde": "afternoon", "esta noche": "evening" },
    today: ["hoy"],
    tomorrow: ["manana"],
    afterTomorrow: ["pasado manana"],
    // "En la mañana" or "la mañana del lunes" is a morning, so it is read first; "mañana" alone is tomorrow.
    parts: {
      morning: ["en la manana", "por la manana", "de la manana", "la manana"],
      afternoon: ["tarde"],
      evening: ["noche"],
    },
    asks: [
      "agendar",
      "agende",
      "agendeme",
      "agendarme",
      "me agenda",
      "me agendan",
      "reservar",
      "reserveme",
      "una cita",
      "una llamada",
      "una reunion",
      "una visita",
      "tiene algo",
      "tienen algo",
      "hay algo",
      "tiene espacio",
      "tienen espacio",
      "hay espacio",
      "tiene cupo",
      "tienen cupo",
      "hay cupo",
      "disponible",
      "disponibles",
      "disponibilidad",
      "hora libre",
      "horas libres",
      "pueden venir",
    ],
    notAsks: ["cuanto", "cuesta", "cuestan", "precio", "precios", "valor", "pagar"],
  },
} as const;

/** Lower case, accents off, punctuation as spaces, single spaces: "¿El Sábado?" is "el sabado". */
function plain(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

const has = (said: string, words: readonly string[]) => words.some((w) => said.includes(` ${w} `));

/** Midnight `days` after `today`. */
function dayAfter(today: Date, days: number): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
}

/** What `text` says about when, read in `lang`'s words. `today`: midnight of today on the business's clock. */
export function askedTime(text: string, lang: ChatLanguageType, today: Date): AskedTimeType {
  const w = WORDS[lang];
  let said = plain(text);
  let part: DayPartType | null = null;
  let day: Date | null = null;
  // "This afternoon", "esta mañana": today and its part, taken out so neither is read again.
  const todayPart = Object.entries(w.todayParts).find(([words]) => said.includes(` ${words} `));
  if (todayPart) {
    day = dayAfter(today, 0);
    part = todayPart[1] as DayPartType;
    said = said.replace(` ${todayPart[0]} `, " ");
  } else {
    for (const [id, words] of Object.entries(w.parts) as [DayPartType, readonly string[]][]) {
      const word = words.find((x) => said.includes(` ${x} `));
      if (!word) continue;
      part = id;
      // Taken out, so the morning's "mañana" is never read as tomorrow.
      said = said.replace(` ${word} `, " ");
      break;
    }
  }
  // A named weekday first: "mañana" in "el lunes por la mañana" is already gone, and a weekday is what was meant.
  const named = WEEKDAYS[lang].findIndex((names) => has(said, names));
  if (day) {
    // Today, already read.
  } else if (named >= 0) {
    // The next one after today; "next Monday" on a Monday is a week away, as is a plain "Monday".
    const ahead = (named - today.getDay() + 7) % 7 || 7;
    day = dayAfter(today, ahead);
  } else if (has(said, w.afterTomorrow)) day = dayAfter(today, 2);
  else if (has(said, w.tomorrow)) day = dayAfter(today, 1);
  else if (has(said, w.today)) day = dayAfter(today, 0);
  return { day, part };
}

/**
 * Whether `text` asks for a time ("can you book me Saturday?", "¿tiene algo el lunes en la tarde?"): a day, a way of
 * asking for a time, and no question about prices. Read before the question is sent, so the chat answers it from
 * the calendar at once; anything else goes to the server, where Jev still hears a wish to book.
 */
export function asksForTime(
  text: string,
  lang: ChatLanguageType,
  today: Date
): AskedTimeType | null {
  const asked = askedTime(text, lang, today);
  if (!asked.day) return null;
  const said = plain(text);
  return has(said, WORDS[lang].asks) && !has(said, WORDS[lang].notAsks) ? asked : null;
}
