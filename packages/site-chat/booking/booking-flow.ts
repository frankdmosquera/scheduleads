import type { ChatBookWordsType } from "../words/chat-book-words-type.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import { fillWords } from "../words/fill-words.js";
import type { BookingBusinessType, BookingServiceType } from "./booking-api.js";
import type { ChatTimeType } from "./chat-times.js";
import { fieldLimits, fitsText, passesContactCheck } from "./contact-checks.js";

/*
 * Booking by talking: after the chat offers times, the visitor picks one, gives what the business's booking form
 * asks (the name, the email or phone its rule wants, the address when the service asks for one, the project box,
 * its own questions), hears it read back, and says yes. That yes is what books. Plain text in, plain text out, so
 * the chat shows and speaks it alike. The word lists here are only the fallback when the booking AI cannot answer.
 */

/** A field of the business's form: "contact" is its "email or phone" rule, `answer:<id>` one of its questions. */
export type BookingFieldKeyType =
  "name" | "email" | "phone" | "contact" | "address" | "details" | `answer:${string}`;

export interface BookingFieldType {
  key: BookingFieldKeyType;
  /** The business's own words for the project box and its questions; a plain name for the rest. */
  label: string;
  required: boolean;
}

export type BookingStepType = "service" | "time" | BookingFieldKeyType | "confirm";

/** What the visitor gave, by field: "name", "email", "phone", "address", "details", "answer:<id>". */
export type BookingValuesType = Partial<Record<Exclude<BookingFieldKeyType, "contact">, string>>;

export interface BookingFlowType {
  step: BookingStepType;
  /** The language the booking is spoken in. */
  lang: ChatLanguageType;
  services: BookingServiceType[];
  service?: BookingServiceType;
  times: ChatTimeType[];
  time?: ChatTimeType;
  /** What this business's form asks for this service, in the form's order. */
  fields: BookingFieldType[];
  values: BookingValuesType;
  /** Fields the form does not require that the visitor chose to skip. */
  skipped: BookingFieldKeyType[];
  /** The last answer at this step was not understood: one more goes to the server instead of asking a third time. */
  missed?: boolean;
}

export type BookingTurnType =
  /** Not about the booking: the chat answers it as any question, and the booking ends. */
  | { kind: "leave" }
  /** Not understood: the step's question is asked again, and the booking stays open. */
  | { kind: "ask" }
  /** A service named: the chat reads its times. */
  | { kind: "service"; service: BookingServiceType }
  /** A line to say; `flow` is the booking's next step, or null when it ended. */
  | { kind: "say"; text: string; flow: BookingFlowType | null }
  /** Everything is read back and confirmed: the chat books `flow` now. */
  | { kind: "book"; flow: BookingFlowType };

/** Plain names for the fields that have no words of the business's own; the AI and the read-back see them. */
const FIELD_NAMES = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  contact: "Email or phone, either one",
  address: "Address",
} as const;

/** The fields the business's form asks for `service`, in the booking window's order. */
export function formFields(
  business: BookingBusinessType,
  service: BookingServiceType,
  words: ChatBookWordsType
): BookingFieldType[] {
  const field = (key: keyof typeof FIELD_NAMES, required = true): BookingFieldType => ({
    key,
    label: FIELD_NAMES[key],
    required,
  });
  const contact = {
    email: [field("email")],
    phone: [field("phone")],
    either: [field("contact")],
    both: [field("email"), field("phone")],
  }[business.contactRule];
  return [
    field("name"),
    ...contact,
    ...(service.addressMode === "not_asked"
      ? []
      : [field("address", service.addressMode === "required")]),
    {
      key: "details",
      label: business.detailsLabel ?? words.detailsLabel,
      required: business.detailsRequired,
    },
    ...business.questions.map((q) => ({
      key: `answer:${q.id}` as const,
      label: q.label,
      required: q.required,
    })),
  ];
}

/** Whether the visitor gave what `field` needs, or skipped it where the form allows. */
export function fieldDone(
  flow: Pick<BookingFlowType, "values" | "skipped">,
  field: BookingFieldType
): boolean {
  if (field.key === "contact") return Boolean(flow.values.email || flow.values.phone);
  if (flow.values[field.key]) return true;
  return !field.required && flow.skipped.includes(field.key);
}

/** The booking's next step: the service, the time, the first field still open, then the read-back. */
export function nextStep(flow: Omit<BookingFlowType, "step">): BookingStepType {
  if (!flow.service) return "service";
  if (!flow.time) return "time";
  return flow.fields.find((f) => !fieldDone(flow, f))?.key ?? "confirm";
}

/** Lower case, accents off, punctuation as spaces: "¿Las 2:30 p. m.?" is "las 2 30 p m". */
function plain(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9@+]+/g, " ")
    .trim()} `;
}

const has = (said: string, words: readonly string[]) => words.some((w) => said.includes(` ${w} `));

const WORDS = {
  en: {
    yes: [
      "yes",
      "yeah",
      "yep",
      "yup",
      "correct",
      "right",
      "sure",
      "ok",
      "okay",
      "that s right",
      "perfect",
      "go ahead",
      "book it",
    ],
    no: ["no", "nope", "wrong", "not right", "incorrect"],
    cancel: ["cancel", "stop", "never mind", "nevermind", "forget it", "don t book"],
    skip: ["skip", "skip it", "no", "none", "nothing", "no thanks", "pass", "not now", "n a"],
    numbers: [
      "zero",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
    ],
    half: ["half past", "thirty"],
    noon: ["noon", "midday"],
    am: ["am", "a m", "in the morning"],
    pm: ["pm", "p m", "in the afternoon", "in the evening"],
    ordinals: [
      ["first", "1st"],
      ["second", "2nd"],
      ["third", "3rd"],
      ["fourth", "4th"],
      ["fifth", "5th"],
      ["sixth", "6th"],
    ],
    last: ["last", "last one"],
    // Each word as it is folded below, apostrophes dropped: "I'm" is "im".
    nameIntro: ["my name is", "my names", "i am", "im", "its", "this is", "name is"],
    emailIntro: ["my email is", "my email", "email is", "its", "it is"],
    at: ["at"],
    dot: ["dot", "period"],
    underscore: ["underscore"],
    dash: ["dash", "hyphen"],
  },
  es: {
    yes: [
      "si",
      "claro",
      "correcto",
      "exacto",
      "dale",
      "listo",
      "de una",
      "asi es",
      "esta bien",
      "perfecto",
      "ok",
      "agendela",
      "agende",
    ],
    no: ["no", "esta mal", "incorrecto", "no es"],
    cancel: ["cancelar", "cancele", "olvidelo", "olvidalo", "deje asi", "no agende", "pare"],
    skip: ["saltar", "omitir", "no", "ninguno", "ninguna", "nada", "no gracias", "paso"],
    numbers: [
      "cero",
      "una",
      "dos",
      "tres",
      "cuatro",
      "cinco",
      "seis",
      "siete",
      "ocho",
      "nueve",
      "diez",
      "once",
      "doce",
    ],
    half: ["y media", "y treinta"],
    noon: ["mediodia", "medio dia"],
    am: ["am", "a m", "de la manana", "en la manana"],
    pm: ["pm", "p m", "de la tarde", "en la tarde", "de la noche"],
    ordinals: [
      ["primera", "primero", "primer"],
      ["segunda", "segundo"],
      ["tercera", "tercero", "tercer"],
      ["cuarta", "cuarto"],
      ["quinta", "quinto"],
      ["sexta", "sexto"],
    ],
    last: ["ultima", "ultimo"],
    nameIntro: ["mi nombre es", "me llamo", "soy", "habla", "es"],
    emailIntro: ["mi correo es", "mi correo", "el correo es", "correo", "es"],
    at: ["arroba"],
    dot: ["punto"],
    underscore: ["guion bajo"],
    dash: ["guion"],
  },
} as const;

/** A question about something else, not an answer: a question mark, or a long sentence. */
function isOtherQuestion(text: string): boolean {
  return text.includes("?") || text.trim().split(/\s+/).length > 8;
}

/** The words with every one of `words` taken out: what is left once "yes" or "skip" is said. */
function onlySaid(said: string, words: readonly string[]): boolean {
  const rest = [...words]
    .sort((a, b) => b.length - a.length)
    .reduce((left, word) => left.split(` ${word} `).join(" "), said);
  return has(said, words) && !rest.trim();
}

/** A listed time typed or said exactly as its button reads ("9:00 a.m."): taken at once, with no AI. */
export function exactTime(text: string, times: readonly ChatTimeType[]): ChatTimeType | null {
  const said = plain(text);
  return times.find((t) => plain(t.label) === said) ?? null;
}

/** A service typed exactly as its button reads: taken at once, with no AI. */
export function exactService(
  text: string,
  services: readonly BookingServiceType[]
): BookingServiceType | null {
  const said = plain(text);
  return services.find((s) => plain(s.name) === said) ?? null;
}

/** A plain yes and nothing else ("sí", "yes, correct"): taken at once at the read-back, with no AI. */
export function plainYes(text: string, lang: ChatLanguageType): boolean {
  return onlySaid(plain(text), WORDS[lang].yes);
}

/** A plain "skip" and nothing else, for a field the form does not require. */
export function plainSkip(text: string, lang: ChatLanguageType): boolean {
  return onlySaid(plain(text), WORDS[lang].skip);
}

/** The service the visitor named: its name, or "the first one". */
export function pickedService(
  text: string,
  lang: ChatLanguageType,
  services: readonly BookingServiceType[]
): BookingServiceType | null {
  const said = plain(text);
  const byName = services.find((s) => said.includes(plain(s.name)));
  if (byName) return byName;
  const ordinal = WORDS[lang].ordinals.findIndex((names) => has(said, names));
  if (ordinal >= 0) return services[ordinal] ?? null;
  return has(said, WORDS[lang].last) ? (services.at(-1) ?? null) : null;
}

/** The offered time the visitor named: "2", "2:30 pm", "the second one", "las dos y media", "noon". */
export function pickedTime(
  text: string,
  lang: ChatLanguageType,
  times: readonly ChatTimeType[]
): ChatTimeType | null {
  const w = WORDS[lang];
  const said = plain(text);
  // Its own label ("2:00 p.m.", a tapped button's words typed back).
  const byLabel = times.find((t) => plain(t.label) === said);
  if (byLabel) return byLabel;
  const ordinal = w.ordinals.findIndex((names) => has(said, names));
  if (ordinal >= 0) return times[ordinal] ?? null;
  if (has(said, w.last)) return times.at(-1) ?? null;
  let hour: number | null = null;
  let minute: number | null = null;
  const digits = said.match(/ (\d{1,2})(?: (\d{2}))? /);
  if (digits) {
    hour = Number(digits[1]);
    minute = digits[2] ? Number(digits[2]) : null;
  } else if (has(said, w.noon)) {
    hour = 12;
    minute = 0;
  } else {
    const named = w.numbers.findIndex((n, i) => i > 0 && said.includes(` ${n} `));
    if (named > 0) hour = named;
  }
  if (hour === null || hour > 23) return null;
  if (minute === null && has(said, w.half)) minute = 30;
  const pm = has(said, w.pm);
  const am = has(said, w.am);
  // A plain "2" means the afternoon: nothing starts at 2 in the morning.
  const hours =
    hour > 12 ? [hour] : pm ? [(hour % 12) + 12] : am ? [hour % 12] : [(hour % 12) + 12, hour % 12];
  for (const h of hours) {
    const atHour = times.filter((t) => Math.floor(t.minutes / 60) === h);
    const exact = atHour.find((t) => t.minutes % 60 === (minute ?? 0));
    if (exact) return exact;
    if (minute === null && atHour.length) return atHour[0];
  }
  return null;
}

/** The words with a lead-in taken off ("my name is", "me llamo"), matched without accents. */
function withoutIntro(words: string[], intros: readonly string[]): string[] {
  const folded = words.map((w) =>
    w
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "")
  );
  for (const intro of intros) {
    const lead = intro.split(" ");
    if (lead.every((w, i) => folded[i] === w) && words.length > lead.length)
      return words.slice(lead.length);
  }
  return words;
}

/** A name said or typed, without "my name is" / "me llamo", in capitals: "my name is ana maria" is "Ana Maria". */
export function spokenName(
  text: string,
  lang: ChatLanguageType,
  { heard = false }: { heard?: boolean } = {}
): string | null {
  // The visitor's own letters are kept ("José", "Núñez"); only the lead-in is matched without accents.
  const words = withoutIntro(
    text
      .replace(/[.,;:!¡¿?"]/g, " ")
      .split(/\s+/)
      .filter(Boolean),
    WORDS[lang].nameIntro
  );
  // The word lists take no digit ("123" is not a name); a name the AI picked out of a sentence keeps one
  // ("Frank Test2"), or the chat would ask for it again and again.
  const notAName = heard ? /@/ : /[\d@]/;
  if (!words.length || words.length > 5 || words.some((w) => notAName.test(w))) return null;
  if (!/\p{L}/u.test(words.join(""))) return null;
  const name = words
    .map((w) => w[0].toLocaleUpperCase(lang) + w.slice(1).toLocaleLowerCase(lang))
    .join(" ");
  return name.length <= fieldLimits.name ? name : null;
}

/** An email said out loud or typed: "ana dot perez at gmail dot com" is "ana.perez@gmail.com". */
export function spokenEmail(text: string, lang: ChatLanguageType): string | null {
  const w = WORDS[lang];
  const typed = text
    .trim()
    .toLowerCase()
    .replace(/[.,;]+$/, "");
  const lastWord = typed.split(/\s+/).at(-1) ?? "";
  if (passesContactCheck(lastWord, "email")) return lastWord;
  let said = plain(withoutIntro(text.trim().split(/\s+/), w.emailIntro).join(" "));
  const swap = (words: readonly string[], to: string) => {
    for (const word of words) said = said.split(` ${word} `).join(` ${to} `);
  };
  swap(w.underscore, "_");
  swap(w.dash, "-");
  swap(w.at, "@");
  swap(w.dot, ".");
  const email = said.replace(/\s+/g, "");
  return passesContactCheck(email, "email") ? email : null;
}

/** A phone number said out loud or typed: digits, spoken digits ("tres uno dos") and a leading plus. */
export function spokenPhone(text: string, lang: ChatLanguageType): string | null {
  const numbers: readonly string[] = WORDS[lang].numbers;
  const said = plain(text)
    .split(" ")
    .map((word) => {
      const n = numbers.indexOf(word);
      if (n >= 0 && n <= 9) return String(n);
      // The digit's other names: "uno" (the list has "una", as in "la una"), "oh".
      return word === "uno" ? "1" : word === "oh" ? "0" : word;
    })
    .join("");
  const phone = said.replace(/[^\d+]/g, "");
  return passesContactCheck(phone, "tel") ? phone : null;
}

/** "Free Estimate on Saturday, October 31 at 9:00 a.m.", in the booking's words. */
export function whenOf(flow: BookingFlowType, words: ChatBookWordsType): string {
  return fillWords(words.when, {
    service: flow.service?.name ?? "",
    day: flow.time?.day ?? "",
    time: flow.time?.label ?? "",
  });
}

/** The times read out loud: "9:00 a.m., 10:00 a.m. or 1:00 p.m.". */
export function timesSaid(times: readonly ChatTimeType[], lang: ChatLanguageType): string {
  const labels = times.map((t) => t.label);
  if (labels.length < 2) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} ${lang === "es" ? "o" : "or"} ${labels.at(-1)}`;
}

/** A line ended with a period, unless it already ends on one, or on a question or exclamation mark. */
export function endSentence(text: string): string {
  const trimmed = text.trim();
  return /[.?!]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** A booking line with its values filled in, one period where a time ends on its own ("at 9:00 a.m."). */
export function bookingLine(template: string, values: Record<string, string>): string {
  return fillWords(template, values).replace(/([ap]\.\s?m)\.\./g, "$1.");
}

/** The question for `field`, in the chat's words, with the business's own label where it has one. */
export function askFor(field: BookingFieldType, words: ChatBookWordsType, bad = false): string {
  const lines = bad ? words.bad : words.ask;
  const line =
    field.key === "details"
      ? fillWords(lines.details, { label: endSentence(field.label) })
      : field.key.startsWith("answer:")
        ? fillWords(lines.question, { label: endSentence(field.label) })
        : lines[field.key as keyof typeof FIELD_NAMES];
  return field.required || bad ? line : `${line} ${words.optional}`;
}

/** Our own read-back, word for word: the time, then every field given, then "is that right?". */
export function readBack(flow: BookingFlowType, words: ChatBookWordsType): string {
  const parts = [endSentence(whenOf(flow, words))];
  const value = (key: Exclude<BookingFieldKeyType, "contact">) => flow.values[key];
  for (const field of flow.fields) {
    const keys: Exclude<BookingFieldKeyType, "contact">[] =
      field.key === "contact" ? ["email", "phone"] : [field.key];
    for (const key of keys) {
      const given = value(key);
      if (!given) continue;
      const template =
        key === "name" || key === "email" || key === "phone" || key === "address"
          ? words.readBack[key]
          : words.readBack.answer;
      parts.push(endSentence(fillWords(template, { label: field.label, value: given })));
    }
  }
  // A contact given beyond what the form required (a phone where it asks only an email) is sent too, so it is read.
  for (const key of ["email", "phone"] as const) {
    const listed = flow.fields.some((f) => f.key === key || f.key === "contact");
    const given = value(key);
    if (!listed && given) parts.push(endSentence(fillWords(words.readBack[key], { value: given })));
  }
  return bookingLine(words.confirm, { summary: parts.join(" ") });
}

/**
 * What the chat says once the booking moved from `before` to `after`: the time picked or the name given, in our
 * words, then the next question, or the read-back when nothing is missing. `after.step` is set by the caller.
 */
export function movedLine(
  before: BookingFlowType,
  after: BookingFlowType,
  words: ChatBookWordsType
): string {
  if (after.step === "confirm") return readBack(after, words);
  const field = after.fields.find((f) => f.key === after.step);
  const question = field ? askFor(field, words) : words.which;
  const lead =
    after.time && after.time !== before.time
      ? bookingLine(words.booking, { when: whenOf(after, words) })
      : after.values.name && after.values.name !== before.values.name
        ? fillWords(words.thanks, { name: after.values.name.split(" ")[0] })
        : "";
  return lead ? `${lead} ${question}` : question;
}

/** The booking's question for the step it is on, said again when nothing moved and the AI could not help. */
export function askAgain(flow: BookingFlowType, words: ChatBookWordsType): string {
  if (flow.step === "service") return words.service;
  if (flow.step === "time") return words.which;
  if (flow.step === "confirm") return readBack(flow, words);
  const field = flow.fields.find((f) => f.key === flow.step);
  return field ? askFor(field, words, flow.missed) : words.which;
}

/** The flow with `changes` applied and its step moved on. */
export function moveOn(flow: BookingFlowType, changes: Partial<BookingFlowType>): BookingFlowType {
  const next = { ...flow, ...changes, missed: false };
  return { ...next, step: nextStep(next) };
}

/** The value a field takes from a reply, checked: null when it does not fit. */
export function valueFor(
  key: BookingFieldKeyType,
  text: string,
  lang: ChatLanguageType
): Partial<BookingValuesType> | null {
  if (key === "name") {
    const name = spokenName(text, lang);
    return name ? { name } : null;
  }
  if (key === "email" || key === "phone" || key === "contact") {
    const email = key === "phone" ? null : spokenEmail(text, lang);
    if (email) return { email };
    const phone = key === "email" ? null : spokenPhone(text, lang);
    return phone ? { phone } : null;
  }
  const most =
    key === "address"
      ? fieldLimits.address
      : key === "details"
        ? fieldLimits.details
        : fieldLimits.answer;
  const words = fitsText(text, most);
  return words ? { [key]: words } : null;
}

/** The booking's next turn after the visitor said or typed `text`, read with the word lists alone. */
export function bookingTurn(
  flow: BookingFlowType,
  text: string,
  words: ChatBookWordsType
): BookingTurnType {
  const w = WORDS[flow.lang];
  const said = plain(text);
  if (has(said, w.cancel)) return { kind: "say", text: words.cancelled, flow: null };
  const notCaught = (): BookingTurnType =>
    flow.missed
      ? { kind: "ask" }
      : {
          kind: "say",
          text: askAgain({ ...flow, missed: true }, words),
          flow: { ...flow, missed: true },
        };

  if (flow.step === "service") {
    const service = pickedService(text, flow.lang, flow.services);
    if (service) return { kind: "service", service };
    return isOtherQuestion(text) ? { kind: "leave" } : { kind: "ask" };
  }
  if (flow.step === "time") {
    const time = pickedTime(text, flow.lang, flow.times);
    if (time) {
      const next = moveOn(flow, { time });
      return { kind: "say", text: movedLine(flow, next, words), flow: next };
    }
    // The buttons are right there, so a time not caught asks once more.
    return isOtherQuestion(text) ? { kind: "leave" } : { kind: "ask" };
  }
  if (flow.step === "confirm") {
    // The read-back: yes books, no asks what to change, a new email or number replaces the old one.
    if (has(said, w.yes) && !has(said, w.no)) return { kind: "book", flow };
    if (has(said, w.no))
      return { kind: "say", text: words.change, flow: { ...flow, missed: false } };
    const asksEmail = flow.fields.some((f) => f.key === "email" || f.key === "contact");
    const asksPhone = flow.fields.some((f) => f.key === "phone" || f.key === "contact");
    const email = asksEmail ? spokenEmail(text, flow.lang) : null;
    const phone = !email && asksPhone ? spokenPhone(text, flow.lang) : null;
    if (email || phone) {
      const next = moveOn(flow, {
        values: { ...flow.values, ...(email ? { email } : { phone: phone! }) },
      });
      return { kind: "say", text: movedLine(flow, next, words), flow: next };
    }
    if (isOtherQuestion(text)) return { kind: "leave" };
    return notCaught();
  }
  const field = flow.fields.find((f) => f.key === flow.step);
  if (!field) return { kind: "ask" };
  if (plainSkip(text, flow.lang)) {
    // A box the form requires is asked again; one it does not is skipped.
    if (field.required) return notCaught();
    const next = moveOn(flow, { skipped: [...flow.skipped, field.key] });
    return { kind: "say", text: movedLine(flow, next, words), flow: next };
  }
  const isText =
    field.key === "address" || field.key === "details" || field.key.startsWith("answer:");
  // A name is short: a question in its place is another question. A project's words may be anything, a question
  // mark included.
  if (field.key === "name" && isOtherQuestion(text)) return { kind: "leave" };
  if (field.key === "address" && text.includes("?")) return { kind: "leave" };
  const value = valueFor(field.key, text, flow.lang);
  // An email or a number said digit by digit is long: read first, and only then taken for another question.
  if (!value) return !isText && isOtherQuestion(text) ? { kind: "leave" } : notCaught();
  const next = moveOn(flow, { values: { ...flow.values, ...value } });
  return { kind: "say", text: movedLine(flow, next, words), flow: next };
}
