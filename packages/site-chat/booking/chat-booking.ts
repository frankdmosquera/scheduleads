import { answersSoFar, countAnswer } from "../agent/ask-chat.js";
import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatTraceType, ChatTurnType } from "../agent/chat-event-type.js";
import type { ChatBookWordsType } from "../words/chat-book-words-type.js";
import type { ChatLanguageType } from "../words/chat-words-type.js";
import { askedTime, asksForTime, PART_HOURS, type AskedTimeType } from "./asked-day.js";
import { BOOKING_ASK_LIMITS, fieldValueLimit, withinAskLimits } from "./booking-ask-limits.js";
import type { BookingBusinessType, BookingRequestType, BookingServiceType } from "./booking-api.js";
import {
  askAgain,
  askFor,
  bookingLine,
  bookingTurn,
  endSentence,
  exactService,
  exactTime,
  fieldDone,
  formFields,
  movedLine,
  moveOn,
  namedServices,
  nextStep,
  plainSkip,
  pickedTime,
  plainYes,
  spokenEmail,
  spokenName,
  spokenPhone,
  timesSaid,
  whenOf,
  type BookingFieldType,
  type BookingFlowType,
  type BookingValuesType,
} from "./booking-flow.js";
import type { BookingSourceType } from "./booking-source.js";
import type {
  BookingAskAnswerType,
  BookingAskBodyType,
  BookingUnderstoodType,
} from "./booking-understood-type.js";
import { dayOfIso, isoDay, todayIn } from "./business-clock.js";
import { chatTimes, type ChatTimeType } from "./chat-times.js";
import { fieldLimits, fitsText } from "./contact-checks.js";

/*
 * Booking from the chat: a visitor asks for a time (or picks the book way), the chat offers the business's free
 * times as buttons and reads them out, and the visitor picks one by tapping, typing or saying it, gives what the
 * business's form asks, hears it read back and says yes: the chat books it through Booking CRM's public route, the
 * same one the booking window uses. The booking AI reads each reply in context; our code checks every field it
 * heard, picks the next question in our own words, and books only on a plain yes to our read-back.
 */

/** A booking in the chat: where the conversation is, and what it books with. */
export interface ChatBookingType {
  flow: BookingFlowType;
  words: ChatBookWordsType;
  source: BookingSourceType;
  business: BookingBusinessType;
  /** The business's zone, once its times were read. */
  timeZone: string | null;
  /** One key for the whole booking, so a retry after a lost answer never books twice. */
  requestKey: string;
  /** The visitor's words that asked to book: the day they named is the one first offered. */
  asked: string;
}

/** What the chat says, and the line it reads out when that differs (the times, said one by one). */
export interface ChatBookingLineType {
  text: string;
  spoken?: string;
  /** The booking's next step; null when it ended (booked, called off, or none to offer). */
  booking: ChatBookingType | null;
  /** The booking AI read this reply, and how, for the inspector. */
  byAi?: { trace?: ChatTraceType };
  /** The calendar could not be read, or the booking failed: the site's booking window takes it from here. */
  toWindow?: boolean;
}

/** Asks the booking AI; null when it cannot answer (offline, the visit's limit): the word lists read the reply. */
export type BookingAskType = (
  booking: ChatBookingType,
  turns: readonly ChatTurnType[]
) => Promise<{ understood: BookingUnderstoodType; trace?: ChatTraceType } | null>;

const newKey = () => crypto.randomUUID();

/** At most this many services are read out over their buttons; more are many, shown as the site's tiles when it has them. */
export const MANY_SERVICES = 6;

/** Midnight of today on this machine's clock, before the business's zone is known. */
const localToday = (now: Date) => new Date(now.getFullYear(), now.getMonth(), now.getDate());

/** Today on the business's clock once it is known. */
const todayOf = (booking: Pick<ChatBookingType, "timeZone">, now: Date) =>
  booking.timeZone ? todayIn(booking.timeZone, now) : localToday(now);

/**
 * A question that starts a booking from the calendar ("anything Saturday afternoon?"), read in the browser. Never
 * while one is open: "yes, Saturday works" at the read-back belongs to it, and its AI reads a new day.
 */
export function asksForNewTime(
  text: string,
  lang: ChatLanguageType,
  open: ChatBookingType | null,
  today: Date
): AskedTimeType | null {
  return open ? null : asksForTime(text, lang, today);
}

/**
 * A booking starts: the business's form and services are read; one service goes straight to its times on the day
 * asked for in `asked`, more are offered as buttons first. Nothing to offer hands over to the booking window.
 */
export async function startBooking(
  source: BookingSourceType,
  words: ChatBookWordsType,
  lang: ChatLanguageType,
  asked: string,
  now = new Date()
): Promise<ChatBookingLineType> {
  let form;
  try {
    form = await source.form();
  } catch {
    return { text: words.down, booking: null, toWindow: true };
  }
  if (!form.services.length) return { text: words.down, booking: null, toWindow: true };
  // A service named in the question goes straight to its times; several it could mean are the only buttons.
  const named = form.services.length > 1 ? namedServices(asked, form.services) : [];
  const offered = named.length ? named : form.services;
  const booking: ChatBookingType = {
    flow: {
      step: "service",
      lang,
      services: offered,
      times: [],
      fields: [],
      values: {},
      skipped: [],
    },
    words,
    source,
    business: form.business,
    timeZone: null,
    requestKey: newKey(),
    asked,
  };
  if (offered.length === 1) return tapService(booking, offered[0], now);
  return {
    text: words.service,
    // A long list is left on the buttons: read aloud, ten names would bury the question.
    spoken:
      offered.length > MANY_SERVICES
        ? words.service
        : `${words.service} ${endSentence(offered.map((s) => s.name).join(", "))}`,
    booking,
  };
}

/**
 * A booking started from a service tapped in a tile, named by its booking link slug: straight to its free times. A
 * slug the business no longer lists starts the booking as any other, at its services.
 */
export async function startBookingFor(
  source: BookingSourceType,
  words: ChatBookWordsType,
  lang: ChatLanguageType,
  slug: string,
  now = new Date()
): Promise<ChatBookingLineType> {
  const started = await startBooking(source, words, lang, "", now);
  if (started.booking?.flow.step !== "service") return started;
  const service = started.booking.flow.services.find((s) => s.slug === slug);
  return service ? tapService(started.booking, service, now) : started;
}

/** The free times for `service`, keeping everything already given; none ends the booking. */
async function timesFor(
  booking: ChatBookingType,
  service: BookingServiceType,
  askedIn: (today: Date) => AskedTimeType,
  now: Date
): Promise<ChatBookingLineType> {
  const { flow, words } = booking;
  const found = await chatTimes(booking.source, service, askedIn, flow.lang, words, now);
  if (!found.times.length) return { text: found.text, booking: null, toWindow: found.down };
  const fields = formFields(booking.business, service, words);
  const next: BookingFlowType = {
    ...flow,
    step: "time",
    service,
    times: found.times,
    time: undefined,
    fields,
    missed: false,
  };
  return {
    text: found.text,
    spoken: `${found.text.replace(/:$/, ".")} ${endSentence(timesSaid(found.times, flow.lang))} ${words.which}`,
    booking: { ...booking, flow: next, timeZone: found.timeZone },
  };
}

/** A service picked, by a tap or in words: its times, on the day the visitor first asked for when they named one. */
export function tapService(
  booking: ChatBookingType,
  service: BookingServiceType,
  now = new Date()
): Promise<ChatBookingLineType> {
  return timesFor(
    booking,
    service,
    (today) => askedTime(booking.asked, booking.flow.lang, today),
    now
  );
}

/** A time picked, and the chat asks the first thing the form still needs, or reads it all back. */
export function tapTime(booking: ChatBookingType, time: ChatTimeType): ChatBookingLineType {
  const next = moveOn(booking.flow, { time });
  return {
    text: movedLine(booking.flow, next, booking.words),
    booking: { ...booking, flow: next },
  };
}

/** What the booking AI is told about the booking so far: the form's fields, what was given, what was last asked. */
export function bookingAskBody(
  booking: ChatBookingType,
  turns: readonly ChatTurnType[],
  now = new Date()
): BookingAskBodyType {
  const { flow, words, business } = booking;
  const today = todayOf(booking, now);
  const valueOf = (field: BookingFieldType): string | null => {
    const given =
      field.key === "contact" ? (flow.values.email ?? flow.values.phone) : flow.values[field.key];
    if (given) return given.slice(0, fieldValueLimit(field.key));
    return flow.skipped.includes(field.key) ? "skipped" : null;
  };
  return withinAskLimits({
    lang: flow.lang,
    business: business.name,
    service: flow.service?.name ?? null,
    services:
      flow.step === "service"
        ? flow.services.slice(0, BOOKING_ASK_LIMITS.services).map((s) => s.name)
        : [],
    today: today.toLocaleDateString(words.dateLocale, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    todayIso: isoDay(today),
    day: flow.times[0]?.day ?? "",
    times: flow.times.slice(0, BOOKING_ASK_LIMITS.times).map((t) => t.label),
    picked: flow.time?.label ?? null,
    fields: flow.fields.slice(0, BOOKING_ASK_LIMITS.fields).map((f) => ({
      key: f.key,
      label: f.label.slice(0, BOOKING_ASK_LIMITS.labelChars),
      required: f.required,
      value: valueOf(f),
    })),
    asking: flow.step,
    // The visit's AI answers are shared with the rest of the chat.
    ...(answersSoFar() >= CHAT_SETTINGS.answersPerVisit && { aiSpent: true }),
    messages: [...turns],
  });
}

/** The booking AI at the site's booking route; a reply it does not give in time is read by the word lists. */
export function bookingAi(url: string, waitMs: number = CHAT_SETTINGS.firstWordMs): BookingAskType {
  return async (booking, turns) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingAskBody(booking, turns)),
        signal: AbortSignal.timeout(waitMs),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as BookingAskAnswerType;
      if (!data.understood) return null;
      countAnswer();
      return { understood: data.understood, trace: data.trace };
    } catch {
      return null;
    }
  };
}

/** A day the AI named, if it is a real day from today on, within two months. */
function namedDay(iso: string | null, today: Date): Date | null {
  const day = dayOfIso(iso);
  if (!day) return null;
  const ahead = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  return ahead >= 0 && ahead <= 62 ? day : null;
}

/** Every field the AI heard that passes our check; anything that fails is never kept. */
function checkedValues(booking: ChatBookingType, u: BookingUnderstoodType): BookingValuesType {
  const { flow, business } = booking;
  const out: BookingValuesType = {};
  const name = u.name ? spokenName(u.name, flow.lang, { heard: true }) : null;
  if (name) out.name = name;
  const email = u.email ? spokenEmail(u.email, flow.lang) : null;
  if (email) out.email = email;
  const phone = u.phone ? spokenPhone(u.phone, flow.lang) : null;
  if (phone) out.phone = phone;
  // An address only where the form may ask one: before a service is picked it is not known yet.
  const asksAddress = !flow.fields.length || flow.fields.some((f) => f.key === "address");
  const address = asksAddress ? fitsText(u.address, fieldLimits.address) : null;
  if (address) out.address = address;
  const details = fitsText(u.details, fieldLimits.details);
  if (details) out.details = details;
  for (const { id, answer } of Array.isArray(u.answers) ? u.answers : []) {
    const words = fitsText(answer, fieldLimits.answer);
    if (words && business.questions.some((q) => q.id === id)) out[`answer:${id}`] = words;
  }
  return out;
}

/**
 * The booking's next step after the visitor said or typed `text`: the booking AI reads it in context ("ok Saturday
 * then", a name and an email in one line), and the chat checks what it understood: only a listed service or time,
 * a real day, a name, an email or number that passes the check, words within the route's limits. Our own lines
 * say each step that moved, and the booking is made only on a yes to our read-back. A time or service typed exactly
 * as its button, a plain skip and a plain yes skip the AI. "leave" when it is another question. `turns`: the
 * conversation, ending with `text`; `ask`: the booking AI, stood in by the tests.
 */
export async function bookingReply(
  booking: ChatBookingType,
  text: string,
  {
    turns = [{ role: "user", text }],
    ask,
    now = new Date(),
  }: { turns?: readonly ChatTurnType[]; ask: BookingAskType; now?: Date }
): Promise<ChatBookingLineType | "leave"> {
  const { flow, words } = booking;
  // Instant: a listed time or service read back exactly, a plain skip, a plain yes to the read-back.
  if (flow.step === "time") {
    const tapped = exactTime(text, flow.times);
    if (tapped) return tapTime(booking, tapped);
  }
  if (flow.step === "service") {
    const picked = exactService(text, flow.services);
    if (picked) return tapService(booking, picked, now);
  }
  if (flow.step === "confirm" && plainYes(text, flow.lang)) return bookNow(booking, flow, now);
  const field = flow.fields.find((f) => f.key === flow.step);
  if (field && !field.required && plainSkip(text, flow.lang)) {
    const next = moveOn(flow, { skipped: [...flow.skipped, field.key] });
    return { text: movedLine(flow, next, words), booking: { ...booking, flow: next } };
  }

  const heard = await ask(booking, turns);
  // No AI (offline, the visit's limit): the word lists read it, and a reply they miss gets the step's question again.
  if (!heard) {
    const turn = bookingTurn(flow, text, words);
    if (turn.kind === "leave") return "leave";
    if (turn.kind === "book") return bookNow(booking, turn.flow, now);
    if (turn.kind === "service") return tapService(booking, turn.service, now);
    if (turn.kind === "ask") return { text: askAgain(flow, words), booking };
    return { text: turn.text, booking: turn.flow ? { ...booking, flow: turn.flow } : null };
  }
  const { understood: u, trace } = heard;
  const byAi = { trace };
  if (u.cancel) return { text: words.cancelled, booking: null, byAi };
  if (u.other) return "leave";

  const given = checkedValues(booking, u);
  const known: BookingFlowType = { ...flow, values: { ...flow.values, ...given } };
  const kept = { ...booking, flow: known };

  // A service picked: its times, keeping what was given with it.
  const service = u.service ? (flow.services[u.service - 1] ?? null) : null;
  if (flow.step === "service" && service)
    return { ...(await tapService(kept, service, now)), byAi };

  // Another day or part of the day: those times, keeping everything given. Not when the reply picks a listed time
  // or answers the form with a time already picked ("2:00 works", "the living room, I'm free Friday too"): an AI
  // echoing the day or part of the day on screen never sends the visitor back to the times.
  const pickedNow = u.time !== null && Boolean(flow.times[u.time - 1]);
  const answering = Boolean(flow.time) && Object.keys(given).length > 0;
  const day = namedDay(u.day, todayOf(booking, now));
  const offered = flow.times[0]?.date ?? null;
  const otherDay = Boolean(day) && isoDay(day!) !== offered;
  const [first, last] = u.part ? PART_HOURS[u.part] : [0, 24];
  const otherPart =
    Boolean(u.part) && flow.times.some((t) => t.minutes < first * 60 || t.minutes >= last * 60);
  if (known.service && !pickedNow && !answering && (otherDay || otherPart)) {
    const wanted = { day: day ?? dayOfIso(offered), part: u.part };
    return { ...(await timesFor(kept, known.service, () => wanted, now)), byAi };
  }

  // The AI's number, 1-based as the instructions list the times.
  const aiTime = u.time !== null ? (flow.times[u.time - 1] ?? null) : null;
  // Once a time is picked, it moves only when the visitor's own words, read by us, name the same new time
  // ("make it 2:30"), and never in a reply that gives the address: an AI echoing a time off by one, or reading
  // "50 Test Ave" as one, leaves it where it was.
  const moveTo =
    flow.time && aiTime && aiTime !== flow.time && !given.address
      ? pickedTime(text, flow.lang, flow.times)
      : null;
  const time = !flow.time ? aiTime : moveTo === aiTime ? moveTo : null;
  const skip = u.skip && field && !field.required && !fieldDone(known, field) ? field.key : null;
  const next: BookingFlowType = {
    ...known,
    ...(time && { time }),
    skipped: skip ? [...flow.skipped, skip] : flow.skipped,
  };
  const changed =
    Boolean(time && time !== flow.time) ||
    (Object.keys(given) as (keyof BookingValuesType)[]).some(
      (key) => flow.values[key] !== given[key]
    );
  // Something the AI heard that failed our check ("use bo at nowhere instead"): a change all the same, so a yes
  // with it reads back again rather than booking the old value.
  const refused =
    // A number off the list; an echo of a listed time we did not take changes nothing and books as said.
    (u.time !== null && !aiTime) ||
    (["name", "email", "phone", "address", "details"] as const).some(
      (key) => u[key] !== null && !given[key]
    ) ||
    (Array.isArray(u.answers) ? u.answers : []).some(({ id }) => !given[`answer:${id}`]);
  // A yes books only at the read-back, only when it changed nothing, and only with every field the form needs.
  if (u.book && flow.step === "confirm" && !changed && !refused && nextStep(next) === "confirm")
    return { ...(await bookNow(booking, next, now)), byAi };
  const moved = moveOn(next, {});
  // A step that moved says so in our own words, the read-back included; otherwise the AI's line.
  if (
    changed ||
    skip ||
    (moved.step === "confirm" && (flow.step !== "confirm" || (refused && u.book)))
  )
    return { text: movedLine(flow, moved, words), booking: { ...booking, flow: moved }, byAi };
  return {
    text: u.reply.trim() || askAgain(moved, words),
    booking: { ...booking, flow: { ...moved, missed: flow.missed } },
    byAi,
  };
}

/** Exactly what the booking window sends for this form: the time, the customer, the address, the answers. */
export function bookingRequest(
  booking: ChatBookingType,
  flow: BookingFlowType
): BookingRequestType {
  const { business, requestKey } = booking;
  const service = flow.service!;
  const v = flow.values;
  // Only what the visitor gave in the project box, which the read-back named: a skipped box sends none.
  const details = v.details;
  return {
    bookingLinkId: service.id,
    startsAt: flow.time!.startsAt,
    customer: {
      name: v.name ?? "",
      ...(v.email ? { email: v.email } : {}),
      ...(v.phone ? { phone: v.phone } : {}),
    },
    // Required: always sent; optional: only when given; never when the service does not ask.
    ...(service.addressMode === "required" ? { location: v.address ?? "" } : {}),
    ...(service.addressMode === "optional" && v.address ? { location: v.address } : {}),
    ...(details ? { details } : {}),
    // Every question the form shows, with its words, a blank one included, as the booking window sends them.
    answers: business.questions.map((q) => ({
      questionId: q.id,
      question: q.label,
      answer: v[`answer:${q.id}`] ?? "",
    })),
    language: flow.lang,
    requestKey,
  };
}

/** The visitor's yes: booked through Booking CRM's public route, which sends the confirmation itself. */
async function bookNow(
  booking: ChatBookingType,
  flow: BookingFlowType,
  now: Date
): Promise<ChatBookingLineType> {
  const { words } = booking;
  const result = await booking.source.book(bookingRequest(booking, flow));
  const time = flow.time!;
  switch (result.state) {
    case "booked":
      return { text: bookingLine(words.booked, { when: whenOf(flow, words) }), booking: null };
    case "already":
      return { text: words.already, booking: null };
    case "taken": {
      // The time went meanwhile: back to the times without it, with a new key; none left, that day read again.
      const fresh = { ...booking, flow, requestKey: newKey() };
      const times = flow.times.filter((t) => t.startsAt !== time.startsAt);
      if (!times.length) {
        const again = await timesFor(
          fresh,
          flow.service!,
          () => ({ day: dayOfIso(time.date), part: null }),
          now
        );
        return { ...again, text: `${words.gone} ${again.text}` };
      }
      return {
        text: `${words.gone} ${endSentence(timesSaid(times, flow.lang))} ${words.which}`,
        booking: { ...fresh, flow: { ...flow, step: "time", times, time: undefined } },
      };
    }
    // The same key on the next yes: a booking the lost answer made is answered, never made twice.
    case "tooMany":
      return { text: words.tooMany, booking: { ...booking, flow } };
    case "lost":
      return { text: words.lost, booking: { ...booking, flow } };
    case "needed":
      return askWhatIsNeeded(booking, flow, result.message);
    case "refused":
      return { text: words.failed, booking: null, toWindow: true };
  }
}

/**
 * The route refused the form for something missing ("Answer: Do you have pets?", "Enter an email."): the business's
 * form is read again, in case it changed, and the field the route named is asked in the chat instead of failing.
 */
async function askWhatIsNeeded(
  booking: ChatBookingType,
  flow: BookingFlowType,
  message: string
): Promise<ChatBookingLineType> {
  const { words, source } = booking;
  const failed = { text: words.failed, booking: null, toWindow: true };
  source.forget();
  let form;
  try {
    form = await source.form();
  } catch {
    return failed;
  }
  const service = form.services.find((s) => s.id === flow.service?.id) ?? flow.service!;
  const fields = formFields(form.business, service, words);
  const answer = message.match(/^Answer:\s*(.+)$/)?.[1]?.trim();
  const named = answer
    ? fields.find((f) => (f.key === "details" || f.key.startsWith("answer:")) && f.label === answer)
    : /email/i.test(message)
      ? fields.find((f) => f.key === "email" || f.key === "contact")
      : /phone/i.test(message)
        ? fields.find((f) => f.key === "phone" || f.key === "contact")
        : /address/i.test(message)
          ? fields.find((f) => f.key === "address")
          : undefined;
  const dropped = named?.key === "contact" ? ["email", "phone"] : named ? [named.key] : [];
  // The named field's answer was missing or refused: it is asked again, the rest kept.
  const values = Object.fromEntries(
    Object.entries(flow.values).filter(([key]) => !dropped.includes(key))
  ) as BookingValuesType;
  const hadOne = dropped.some((key) => flow.values[key as keyof BookingValuesType]);
  const next = moveOn(
    { ...flow, service, fields },
    { values, skipped: flow.skipped.filter((key) => key !== named?.key) }
  );
  const field = fields.find((f) => f.key === next.step);
  if (!field) return failed;
  return {
    text: askFor(field, words, hadOne),
    booking: { ...booking, business: form.business, flow: next },
  };
}
