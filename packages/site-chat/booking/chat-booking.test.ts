// Booking from the chat, ported from ialaorden.com's 83 checks (scripts/check-chat-booking.mjs) and adapted to a
// form that follows each business: which questions ask for a time and which day and part they name; the free times
// a chat offers, from a stand-in Booking CRM; a tapped time or service; booking by talking with the word lists; the
// booking AI's fields checked by our code. Then the cases only a business's own form has. No network.
import { afterEach, describe, expect, it, vi } from "vitest";

import { crmFetch, type CrmStandInType } from "../crm-stand-in.js";
import { englishChatWords } from "../words/english-chat-words.js";
import { askedTime, asksForTime, type AskedTimeType } from "./asked-day.js";
import type { BookingBusinessType, BookingServiceType } from "./booking-api.js";
import {
  bookingLine,
  bookingTurn,
  pickedTime,
  spokenEmail,
  spokenName,
  spokenPhone,
  type BookingFlowType,
  type BookingTurnType,
} from "./booking-flow.js";
import { createBookingSource } from "./booking-source.js";
import type { BookingUnderstoodType } from "./booking-understood-type.js";
import { showBubble, type BubbleType } from "../chat/bubble-list.js";
import { BOOKING_ASK_LIMITS, askChars } from "./booking-ask-limits.js";
import {
  asksForNewTime,
  bookingAi,
  bookingAskBody,
  bookingReply,
  startBooking,
  tapService,
  tapTime,
  type BookingAskType,
  type ChatBookingLineType,
  type ChatBookingType,
} from "./chat-booking.js";
import { chatTimes } from "./chat-times.js";

// A fixed Monday, Nov 2 2026, noon on the stand-in business's clock (Colombia, UTC-5, no summer time).
const NOW = new Date(Date.UTC(2026, 10, 2, 17));
const TODAY = new Date(2026, 10, 2);
const day = (offset: number) => new Date(2026, 10, 2 + offset);
const read = (text: string, lang: "en" | "es" = "en") => askedTime(text, lang, TODAY);
const ZONE = "America/Bogota";
// Saturday at 9:00 and 15:00, Monday the 9th at 10:00, on Colombia's clock.
const at = (offset: number, hour: number) =>
  new Date(Date.UTC(2026, 10, 2 + offset, hour + 5)).toISOString();
const STARTS = [at(5, 9), at(5, 15), at(7, 10)];
const W = englishChatWords.book;
const ACCOUNT = { apiUrl: "https://crm.test/", slug: "test-business" };

const ESTIMATE: BookingServiceType = {
  id: "estimate",
  name: "Free Estimate",
  addressMode: "not_asked",
};
/** ialaorden.com's form: a name and an email; the project box is there and may be left empty. */
const NAME_AND_EMAIL: BookingBusinessType = {
  name: "Test Business",
  contactRule: "email",
  detailsLabel: null,
  detailsRequired: false,
  questions: [],
};
/** Primo's form: a name, an email and a phone, the address, and the project box, all required. */
const PRIMO: BookingBusinessType = {
  name: "Primo Painters",
  contactRule: "both",
  detailsLabel: "Tell us about your project",
  detailsRequired: true,
  questions: [],
};
const PRIMO_ESTIMATE: BookingServiceType = { ...ESTIMATE, addressMode: "required" };

/** A stand-in CRM and the chat's booking routes on it. */
function crmWith(changes: Partial<CrmStandInType> = {}) {
  const crm: CrmStandInType = {
    business: NAME_AND_EMAIL,
    services: [ESTIMATE],
    starts: [...STARTS],
    timeZone: ZONE,
    ...changes,
  };
  const standIn = crmFetch(crm);
  return {
    crm,
    ...standIn,
    source: createBookingSource(ACCOUNT, standIn.fetchFn, () => NOW.getTime()),
  };
}

/** A booking started by `asked` on a stand-in CRM, at its first step. */
async function started(changes: Partial<CrmStandInType> = {}, asked = "book me Saturday") {
  const standIn = crmWith(changes);
  const line = await startBooking(standIn.source, W, "en", asked, NOW);
  return { ...standIn, line, booking: { ...line.booking!, requestKey: "k1" } };
}

/** A word-list turn that says a line, with its next step. */
function said(turn: BookingTurnType): { text: string; flow: BookingFlowType } {
  if (turn.kind !== "say" || !turn.flow) throw new Error(`expected a line, got ${turn.kind}`);
  return { text: turn.text, flow: turn.flow };
}

/** A booking reply that stays in the booking. */
function line(reply: ChatBookingLineType | "leave"): ChatBookingLineType {
  if (reply === "leave") throw new Error("expected a booking line, got leave");
  return reply;
}

/** The booking AI, stood in: it understood these fields. */
const aiSays =
  (understood: Partial<BookingUnderstoodType>): BookingAskType =>
  async () => ({
    understood: {
      service: null,
      time: null,
      day: null,
      part: null,
      name: null,
      email: null,
      phone: null,
      address: null,
      details: null,
      answers: [],
      skip: false,
      book: false,
      cancel: false,
      other: false,
      reply: "",
      ...understood,
    },
    trace: {},
  });
const noAi: BookingAskType = async () => {
  throw new Error("the AI must not be asked");
};
const aiDown: BookingAskType = async () => null;

const reply = (booking: ChatBookingType, text: string, ask: BookingAskType = aiDown) =>
  bookingReply(booking, text, { ask, now: NOW });

describe("which day and part of day a visitor asks for", () => {
  const cases: [string, AskedTimeType, AskedTimeType][] = [
    ["en: Saturday", read("Can you book me Saturday?"), { day: day(5), part: null }],
    [
      "en: tomorrow afternoon",
      read("anything tomorrow afternoon?"),
      { day: day(1), part: "afternoon" },
    ],
    [
      "en: next Monday on a Monday is a week away",
      read("next monday please"),
      { day: day(7), part: null },
    ],
    [
      "en: a call on Friday morning",
      read("a phone call on Friday morning"),
      { day: day(4), part: "morning" },
    ],
    ["en: today", read("are you free today?"), { day: day(0), part: null }],
    [
      "es: el sábado en la tarde",
      read("¿Tiene algo el sábado en la tarde?", "es"),
      { day: day(5), part: "afternoon" },
    ],
    [
      "es: mañana en la mañana is tomorrow morning",
      read("mañana en la mañana", "es"),
      { day: day(1), part: "morning" },
    ],
    [
      "es: en la mañana alone is a morning, not tomorrow",
      read("¿algo en la mañana?", "es"),
      { day: null, part: "morning" },
    ],
    ["es: pasado mañana", read("pasado mañana", "es"), { day: day(2), part: null }],
    [
      "es: el miércoles without the accent",
      read("por telefono el miercoles", "es"),
      { day: day(2), part: null },
    ],
    ["en: tonight is this evening", read("anything tonight?"), { day: day(0), part: "evening" }],
    [
      "en: this afternoon",
      read("do you have something this afternoon?"),
      { day: day(0), part: "afternoon" },
    ],
    [
      "es: esta mañana is this morning, not tomorrow",
      read("¿tiene algo esta mañana?", "es"),
      { day: day(0), part: "morning" },
    ],
    [
      "es: la mañana del lunes is Monday morning",
      read("la mañana del lunes", "es"),
      { day: day(7), part: "morning" },
    ],
  ];
  it.each(cases)("%s", (_what, got, want) => {
    expect(got.day?.getTime() ?? null).toBe(want.day?.getTime() ?? null);
    expect(got.part).toBe(want.part);
  });
});

describe("which questions ask for a time", () => {
  const asks = (text: string, lang: "en" | "es" = "en") => asksForTime(text, lang, TODAY) !== null;
  it.each([
    ["Can you book me Saturday?", "en"],
    ["do you have something tomorrow afternoon?", "en"],
    ["¿tiene algo el lunes en la tarde?", "es"],
    ["¿tiene algo el sábado en la tarde?", "es"],
    ["¿Me puede agendar el lunes?", "es"],
    ["¿tienen espacio mañana?", "es"],
    // The chat reads the site's own language; these two replace ialaorden.com's cross-language reads.
    ["Can I book an estimate on Saturday?", "en"],
    ["can you come by tomorrow?", "en"],
  ] as const)('"%s" asks for a time', (text, lang) => expect(asks(text, lang)).toBe(true));
  it.each([
    ["Does the CRM send appointment reminders the day before, in the morning?", "en"],
    ["Can I schedule posts for the evening?", "en"],
    ["Is the consultation free on Monday?", "en"],
    ["what time do you open tomorrow", "en"],
    ["are you open tomorrow?", "en"],
    ["¿cuánto cuesta una cita el lunes?", "es"],
    ["How much is a website?", "en"],
    ["Do you work on Saturday?", "en"],
    ["¿Cuánto cuesta una página?", "es"],
  ] as const)('"%s" does not', (text, lang) => expect(asks(text, lang)).toBe(false));
});

describe("the free times a chat offers, from Booking CRM", () => {
  const times = (
    text: string,
    changes: Partial<CrmStandInType> = {},
    words = W,
    lang: "en" | "es" = "en"
  ) =>
    chatTimes(
      crmWith(changes).source,
      ESTIMATE,
      (today) => askedTime(text, lang, today),
      lang,
      words,
      NOW
    );
  const saturday = "Saturday, November 7";

  it("Saturday: both its times, and the line names the day and the service", async () => {
    const sat = await times("book me Saturday");
    expect(sat.times.map((t) => t.startsAt)).toEqual([at(5, 9), at(5, 15)]);
    expect(sat.text).toContain(saturday);
    expect(sat.text).toContain("Free Estimate");
  });
  it("Saturday afternoon: only the afternoon time", async () => {
    expect((await times("Saturday afternoon")).times.map((t) => t.startsAt)).toEqual([at(5, 15)]);
  });
  it("Sunday has none: says so, and offers the next day's", async () => {
    const sunday = await times("book me Sunday");
    expect(sunday.text.startsWith("Sunday, November 8")).toBe(true);
    expect(sunday.times.map((t) => t.startsAt)).toEqual([at(7, 10)]);
  });
  it("no day asked: the first day with a free time", async () => {
    const next = await times("");
    expect(next.times[0]?.startsAt).toBe(at(5, 9));
    expect(next.text).toContain(saturday);
  });
  it("a time is shown alone, as the CRM writes it", async () => {
    const sat = await times("book me Saturday");
    expect(sat.times.map((t) => t.label.replace(/\s/g, " "))).toEqual(["9:00 a.m.", "3:00 p.m."]);
  });
  it("the calendar unreadable: says so, no buttons", async () => {
    const down = await times("", { down: true });
    expect(down.text).toBe(W.down);
    expect(down.times).toEqual([]);
    expect(down.down).toBe(true);
  });
  it("no free time at all: says so, no buttons", async () => {
    const empty = await times("", { starts: [] });
    expect(empty.text).toBe(W.none);
    expect(empty.times).toEqual([]);
  });
  it("Spanish: the day in Spanish", async () => {
    const es = await times("el sábado", {}, { ...W, dateLocale: "es-CO" }, "es");
    expect(es.text).toContain("sábado");
    expect(es.times).toHaveLength(2);
  });
  it("the times are on the business's own clock, its days too", async () => {
    // 15:00 in Colombia on Saturday is 5:00 the next morning in Tokyo.
    const tokyo = await times("", { timeZone: "Asia/Tokyo" });
    expect(tokyo.times[0]?.date).toBe("2026-11-07");
    expect(tokyo.times[0]?.label.replace(/\s/g, " ")).toBe("11:00 p.m.");
    expect((await times("book me Sunday", { timeZone: "Asia/Tokyo" })).times[0]?.startsAt).toBe(
      at(5, 15)
    );
  });
  it("one read of the business serves the whole conversation", async () => {
    const standIn = crmWith();
    await startBooking(standIn.source, W, "en", "book me Saturday", NOW);
    await startBooking(standIn.source, W, "en", "book me Monday", NOW);
    expect(standIn.reads.form).toBe(1);
  });
});

describe("a tapped time or service", () => {
  it("a tapped time asks the first thing the form needs, naming the service, day and time", async () => {
    const { booking } = await started();
    const tapped = tapTime(booking, booking.flow.times[1]);
    expect(tapped.booking?.flow.step).toBe("name");
    expect(tapped.text).toContain(booking.flow.times[1].label);
    expect(tapped.text).toContain("Saturday, November 7");
    expect(tapped.text).toContain("Free Estimate");
  });
  it("one service: its times at once, no question about which", async () => {
    const { line } = await started();
    expect(line.booking?.flow.step).toBe("time");
    expect(line.booking?.flow.service?.id).toBe("estimate");
  });
  it("more than one service: the services first, as buttons", async () => {
    const touchUp = { ...ESTIMATE, id: "touch-up", name: "Touch-up Visit" };
    const { line } = await started({ services: [ESTIMATE, touchUp] });
    expect(line.text).toBe(W.service);
    expect(line.booking?.flow.step).toBe("service");
    expect(line.booking?.flow.services.map((s) => s.name)).toEqual([
      "Free Estimate",
      "Touch-up Visit",
    ]);
  });
  it("a service named in the question goes straight to its times, the longest name winning", async () => {
    const touchUp = { ...ESTIMATE, id: "touch-up", name: "Touch-up Visit" };
    const longTouchUp = { ...ESTIMATE, id: "long", name: "Long Touch-up Visit" };
    const services = [ESTIMATE, touchUp, longTouchUp];
    const { line: short } = await started({ services }, "can I book a touch-up visit Monday?");
    expect(short.booking?.flow.step).toBe("time");
    expect(short.booking?.flow.service?.id).toBe("touch-up");
    expect(short.booking?.flow.times.map((t) => t.startsAt)).toEqual([at(7, 10)]);
    const { line: long } = await started({ services }, "a long touch-up visit please");
    expect(long.booking?.flow.service?.id).toBe("long");
    const { line: none } = await started({ services }, "a touch up on Monday");
    expect(none.booking?.flow.step).toBe("service");
  });
  it("a long list of services is not read aloud", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...ESTIMATE,
      id: `s${i}`,
      name: `Service ${i}`,
    }));
    const { line } = await started({ services: many });
    expect(line.spoken).toBe(W.service);
    const { line: few } = await started({ services: many.slice(0, 2) });
    expect(few.spoken).toContain("Service 1");
  });
  it("a tapped service shows its times on the day first asked for", async () => {
    const touchUp = { ...ESTIMATE, id: "touch-up", name: "Touch-up Visit" };
    const { booking } = await started({ services: [ESTIMATE, touchUp] }, "anything Monday?");
    const picked = await tapService(booking, touchUp, NOW);
    expect(picked.booking?.flow.service?.id).toBe("touch-up");
    expect(picked.booking?.flow.times.map((t) => t.startsAt)).toEqual([at(7, 10)]);
  });
  it("a service typed exactly as its button skips the AI", async () => {
    const touchUp = { ...ESTIMATE, id: "touch-up", name: "Touch-up Visit" };
    const { booking } = await started({ services: [ESTIMATE, touchUp] });
    const typed = line(await reply(booking, "touch-up visit", noAi));
    expect(typed.booking?.flow.service?.id).toBe("touch-up");
  });
});

describe("booking by talking, with the word lists", async () => {
  const { booking } = await started();
  const T = booking.flow.times;
  const flow = booking.flow;
  const turn = (f: BookingFlowType, text: string) => bookingTurn(f, text, W);
  const t1 = said(turn(flow, "3 pm"));
  const t2 = said(turn(t1.flow, "my name is ana maria"));
  const t3 = said(turn(t2.flow, "ana dot perez at gmail dot com"));
  // The project box is on the form but not required: asked once, and skipped.
  const t3s = said(turn(t3.flow, "skip"));
  const t4 = turn(t3s.flow, "yes");
  const es = { ...flow, lang: "es" as const };
  const e1 = said(turn(es, "las tres de la tarde"));
  const e2 = said(turn(e1.flow, "me llamo José Núñez"));
  const e3 = said(turn(e2.flow, "jose arroba gmail punto com"));
  const e4 = turn(said(turn(e3.flow, "saltar")).flow, "sí, correcto");

  it('a time by its hour: "3" is 3 PM', () =>
    expect(pickedTime("3", "en", T)?.startsAt).toBe(at(5, 15)));
  it('"9 am", "the first one" and "the last one"', () => {
    expect(pickedTime("9 am", "en", T)?.startsAt).toBe(at(5, 9));
    expect(pickedTime("the first one", "en", T)?.startsAt).toBe(at(5, 9));
    expect(pickedTime("the last one", "en", T)?.startsAt).toBe(at(5, 15));
  });
  it("a typed button label", () =>
    expect(pickedTime(T[1].label, "en", T)?.startsAt).toBe(at(5, 15)));
  it('es: "las tres de la tarde" and "la primera"', () => {
    expect(pickedTime("las tres de la tarde", "es", T)?.startsAt).toBe(at(5, 15));
    expect(pickedTime("la primera", "es", T)?.startsAt).toBe(at(5, 9));
  });
  it("a time not offered matches none", () => expect(pickedTime("4 pm", "en", T)).toBeNull());
  it('names: "my name is ana maria", "I\'m Dave"', () => {
    expect(spokenName("my name is ana maria", "en")).toBe("Ana Maria");
    expect(spokenName("I'm Dave", "en")).toBe("Dave");
  });
  it('names keep their accents: "me llamo José Núñez"', () =>
    expect(spokenName("me llamo José Núñez", "es")).toBe("José Núñez"));
  it("an email said out loud, in both languages, and typed", () => {
    expect(spokenEmail("ana dot perez at gmail dot com", "en")).toBe("ana.perez@gmail.com");
    expect(spokenEmail("ana punto perez arroba gmail punto com", "es")).toBe("ana.perez@gmail.com");
    expect(spokenEmail("Ana@Gmail.com", "en")).toBe("ana@gmail.com");
    expect(spokenEmail("my email is Ana@Gmail.com.", "en")).toBe("ana@gmail.com");
  });
  it("not an email", () => expect(spokenEmail("my email", "en")).toBeNull());
  it("a number said in Spanish digits", () =>
    expect(spokenPhone("tres uno dos tres uno dos ocho cero cuatro tres", "es")).toBe(
      "3123128043"
    ));
  it("the whole talk: time, name, email, the project box skipped, read-back, yes books", () => {
    expect([t1.flow.step, t2.flow.step, t3.flow.step, t3s.flow.step]).toEqual([
      "name",
      "email",
      "details",
      "confirm",
    ]);
    expect(t3.text).toContain(W.optional);
    expect(t3s.text).toContain("ana.perez@gmail.com");
    expect(t4.kind).toBe("book");
    if (t4.kind !== "book") return;
    expect(t4.flow.values.name).toBe("Ana Maria");
    expect(t4.flow.time?.startsAt).toBe(at(5, 15));
  });
  it("es: the whole talk too", () => {
    expect(e4.kind).toBe("book");
    if (e4.kind !== "book") return;
    expect(e4.flow.values.name).toBe("José Núñez");
    expect(e4.flow.values.email).toBe("jose@gmail.com");
  });
  it("an email rule asks for an email; a phone rule takes a number said aloud", () => {
    expect(t2.text).toContain(W.ask.email);
    const phoneFlow: BookingFlowType = {
      ...e2.flow,
      step: "phone",
      fields: e2.flow.fields.map((f) => (f.key === "email" ? { ...f, key: "phone" as const } : f)),
    };
    expect(
      said(turn(phoneFlow, "tres uno dos tres uno dos ocho cero cuatro tres")).flow.values.phone
    ).toBe("3123128043");
  });
  it('a "no" at the read-back asks what to change', () => {
    const no = said(turn(t3s.flow, "no"));
    expect(no.text).toBe(W.change);
    expect(no.flow.step).toBe("confirm");
  });
  it("a new email at the read-back replaces it, and reads back again", () => {
    const fixed = said(turn(t3s.flow, "bo@example.co"));
    expect(fixed.flow.values.email).toBe("bo@example.co");
    expect(fixed.text).toContain("bo@example.co");
  });
  it('"cancel" ends it, nothing booked', () => {
    const cancel = turn(t2.flow, "cancel");
    expect(cancel).toEqual({ kind: "say", text: W.cancelled, flow: null });
  });
  it("another question leaves the booking", () => {
    expect(turn(flow, "How much is it to paint a whole house, roughly?").kind).toBe("leave");
    expect(turn(t2.flow, "do you do cabinets too?").kind).toBe("leave");
  });
  it("a time not offered: asked once more, the booking kept", () =>
    expect(turn(flow, "4 pm").kind).toBe("ask"));
  it("a name not caught once: asked again", () => {
    const once = said(turn(t1.flow, "123"));
    expect(once.flow.missed).toBe(true);
    expect(once.text).toBe(W.bad.name);
  });
  it("a name not caught twice: asked no more by the word lists", () =>
    expect(turn(said(turn(t1.flow, "123")).flow, "456").kind).toBe("ask"));
  it("a time ends with one period, in both languages", () => {
    expect(bookingLine("Listo: {when}.", { when: "a las 12:00 p. m." })).toBe(
      "Listo: a las 12:00 p. m."
    );
    expect(bookingLine("Done: {when}.", { when: "at 9:00 a.m." })).toBe("Done: at 9:00 a.m.");
  });

  it("yes books once, with the service, the key, the time and the email", async () => {
    const { booking: b, bookings } = await started();
    const booked = line(await reply({ ...b, flow: t3s.flow }, "yes"));
    expect(bookings).toHaveLength(1);
    expect(bookings[0]).toMatchObject({
      bookingLinkId: "estimate",
      requestKey: "k1",
      startsAt: at(5, 15),
      customer: { name: "Ana Maria", email: "ana.perez@gmail.com" },
      language: "en",
    });
    expect(booked.byAi).toBeUndefined();
  });
  it("then says booked in our words, and the booking ends", async () => {
    const { booking: b } = await started();
    const booked = line(await reply({ ...b, flow: t3s.flow }, "yes"));
    expect(booked.text.replace(/\s/g, " ")).toBe(
      "Booked: Free Estimate on Saturday, November 7 at 3:00 p.m. Your confirmation is on its way."
    );
    expect(booked.booking).toBeNull();
  });
  it("a time taken meanwhile: says so, offers the rest, with a new key", async () => {
    const { booking: b } = await started({ next: ["taken"] });
    const taken = line(await reply({ ...b, flow: t3s.flow }, "yes"));
    expect(taken.text.startsWith(W.gone)).toBe(true);
    expect(taken.booking?.flow.step).toBe("time");
    expect(taken.booking?.flow.times.some((t) => t.startsAt === at(5, 15))).toBe(false);
    expect(taken.booking?.requestKey).not.toBe("k1");
    // What was given stays: the next time goes straight to the read-back.
    expect(tapTime(taken.booking!, taken.booking!.flow.times[0]).booking?.flow.step).toBe(
      "confirm"
    );
  });
  it("a lost answer keeps the key, so a second yes cannot book twice", async () => {
    const { booking: b, bookings, sent } = await started({ next: ["lost"] });
    const lost = line(await reply({ ...b, flow: t3s.flow }, "yes"));
    expect(lost.text).toBe(W.lost);
    expect(lost.booking?.requestKey).toBe("k1");
    expect(lost.booking?.flow.step).toBe("confirm");
    const again = line(await reply(lost.booking!, "yes"));
    expect(again.text.startsWith("Booked: ")).toBe(true);
    expect(sent).toHaveLength(2);
    expect(bookings).toHaveLength(1);
  });
});

describe("the booking AI reads each reply; our code checks it", async () => {
  const { booking } = await started();
  const T = booking.flow.times;
  const turn = (f: BookingFlowType, text: string) => said(bookingTurn(f, text, W)).flow;
  const atName = turn(booking.flow, "3 pm");
  const atEmail = turn(atName, "ana maria");
  const atConfirm = turn(turn(atEmail, "ana.perez@gmail.com"), "skip");
  let booked = 0;
  /** A fresh stand-in CRM for each booking, every booking counted. */
  const on = async (flow: BookingFlowType) => {
    const fresh = await started();
    return {
      ...fresh.booking,
      source: {
        ...fresh.source,
        book: (r: Parameters<typeof fresh.source.book>[0]) =>
          fresh.source.book(r).then((res) => (res.state === "booked" && booked++, res)),
      },
      flow,
    };
  };

  it("the day already shown: the AI's line, the times still there", async () => {
    const sameDay = line(
      await reply(booking, "ok Saturday then", aiSays({ reply: "Which time suits you?" }))
    );
    expect(sameDay.text).toBe("Which time suits you?");
    expect(sameDay.booking?.flow.step).toBe("time");
    expect(sameDay.byAi).toBeTruthy();
  });
  const early = () =>
    reply(
      booking,
      "frank Mosquera, email frankdmosquera@gmail.com, two bedrooms",
      aiSays({
        name: "frank Mosquera",
        email: "frankdmosquera@gmail.com",
        details: "Two bedrooms",
        reply: "Thanks. Which time?",
      })
    ).then(line);
  it("a name, an email and the project before any time: all kept", async () => {
    const given = await early();
    expect(given.booking?.flow.values).toMatchObject({
      name: "Frank Mosquera",
      email: "frankdmosquera@gmail.com",
      details: "Two bedrooms",
    });
    expect(given.booking?.flow.step).toBe("time");
  });
  it("then a tapped time goes straight to the read-back", async () => {
    const earlyTap = tapTime((await early()).booking!, T[0]);
    expect(earlyTap.booking?.flow.step).toBe("confirm");
    expect(earlyTap.text).toContain("frankdmosquera@gmail.com");
  });
  it("a time the AI picked: our own line asks the name", async () => {
    const aiTime = line(await reply(booking, "the later one", aiSays({ time: 2 })));
    expect(aiTime.booking?.flow.time?.startsAt).toBe(at(5, 15));
    expect(aiTime.booking?.flow.step).toBe("name");
    expect(aiTime.text.startsWith("Booking ")).toBe(true);
  });
  it("an email that fails the check is never kept", async () => {
    const bad = line(
      await reply(
        { ...booking, flow: atEmail },
        "frank at nowhere",
        aiSays({ email: "frank at nowhere", reply: "Could you type the email?" })
      )
    );
    expect(bad.booking?.flow.values.email).toBeUndefined();
    expect(bad.booking?.flow.step).toBe("email");
  });
  it("the AI's yes at the read-back books once", async () => {
    const aiYes = line(
      await reply(await on(atConfirm), "yes please go ahead", aiSays({ book: true }))
    );
    expect(aiYes.booking).toBeNull();
    expect(aiYes.text.startsWith("Booked: ")).toBe(true);
  });
  it("a yes that changes the email reads it back again, nothing booked", async () => {
    const yesChanged = line(
      await reply(
        await on(atConfirm),
        "yes but use bo@example.co",
        aiSays({ book: true, email: "bo@example.co" })
      )
    );
    expect(yesChanged.booking?.flow.step).toBe("confirm");
    expect(yesChanged.booking?.flow.values.email).toBe("bo@example.co");
    expect(yesChanged.text).toContain("bo@example.co");
  });
  it("a yes before the read-back books nothing", async () => {
    const tooSoon = line(await reply(await on(atName), "yes", aiSays({ book: true })));
    expect(tooSoon.booking?.flow.step).toBe("name");
  });
  it("another question leaves; cancel ends it", async () => {
    expect(await reply(booking, "what does a kitchen cost", aiSays({ other: true }))).toBe("leave");
    const cancel = line(await reply(booking, "forget it", aiSays({ cancel: true })));
    expect(cancel.booking).toBeNull();
    expect(cancel.text).toBe(W.cancelled);
  });
  it("no AI: the word lists, and a miss asks the step's question again", async () => {
    const down = line(await reply(booking, "4 pm", aiDown));
    expect(down.text).toBe(W.which);
    expect(down.booking?.flow.step).toBe("time");
  });
  it("a plain yes and a button's own words skip the AI", async () => {
    const quickYes = line(await reply(await on(atConfirm), "yes", noAi));
    expect(quickYes.booking).toBeNull();
    const quickLabel = line(await reply(booking, T[1].label, noAi));
    expect(quickLabel.booking?.flow.step).toBe("name");
  });
  it("books exactly twice in all (the AI's yes and the plain yes)", () => expect(booked).toBe(2));
  it("another day the AI named: that day's times, keeping what was given", async () => {
    const monday = line(
      await reply({ ...booking, flow: atEmail }, "monday instead", aiSays({ day: "2026-11-09" }))
    );
    expect(monday.booking?.flow.times.map((t) => t.startsAt)).toEqual([at(7, 10)]);
    expect(monday.booking?.flow.values.name).toBe("Ana Maria");
  });
});

describe("the chat follows the business's own form (Primo's)", async () => {
  const primo = { business: PRIMO, services: [PRIMO_ESTIMATE] };
  const { booking } = await started(primo, "anything Saturday afternoon?");
  const turn = (f: BookingFlowType, text: string) => said(bookingTurn(f, text, W));
  const atName = turn(booking.flow, booking.flow.times[0].label);
  const atEmail = turn(atName.flow, "Ana Perez");
  const atPhone = turn(atEmail.flow, "ana@example.com");
  const atAddress = turn(atPhone.flow, "403 555 0101");
  const atDetails = turn(atAddress.flow, "12 Main St SW, Calgary");
  const atConfirm = turn(atDetails.flow, "Living room and two bedrooms, walls and ceilings");

  it('a time asked for in words shows that day\'s times: "Saturday afternoon" is the 3 p.m. only', () =>
    expect(booking.flow.times.map((t) => t.startsAt)).toEqual([at(5, 15)]));
  it("asks what Primo's form asks, in its order: name, email, phone, address, project", () => {
    expect([atName, atEmail, atPhone, atAddress, atDetails].map((t) => t.flow.step)).toEqual([
      "name",
      "email",
      "phone",
      "address",
      "details",
    ]);
    expect(atConfirm.flow.step).toBe("confirm");
  });
  it("contact rule both: a missing phone is asked for, in our words", () => {
    expect(atPhone.text).toBe(W.ask.phone);
  });
  it("address required: it is asked, with no way to skip it", () => {
    expect(atAddress.text).toBe(W.ask.address);
    const skipped = turn(atAddress.flow, "skip");
    expect(skipped.flow.step).toBe("address");
    expect(skipped.flow.values.address).toBeUndefined();
    expect(skipped.text).toBe(W.bad.address);
  });
  it("the project box is asked in the business's own words, and cannot be skipped when required", async () => {
    expect(atDetails.text).toBe("Tell us about your project.");
    const skipped = turn(atDetails.flow, "skip");
    expect(skipped.flow.step).toBe("details");
    expect(skipped.flow.skipped).toEqual([]);
    // The AI's skip is not taken for a required box either.
    const aiSkip = line(
      await reply(
        { ...booking, flow: atDetails.flow },
        "rather not",
        aiSays({ skip: true, reply: "We need a few words about it." })
      )
    );
    expect(aiSkip.booking?.flow.step).toBe("details");
  });
  it("the read-back names every field given", () => {
    for (const part of [
      "Free Estimate",
      "Ana Perez",
      "ana@example.com",
      "4035550101",
      "12 Main St SW, Calgary",
      "Tell us about your project: Living room",
    ])
      expect(atConfirm.text).toContain(part);
  });
  it("the AI giving everything but the phone: the phone is asked next", async () => {
    const most = line(
      await reply(
        { ...booking, flow: atName.flow },
        "Ana Perez, ana@example.com, 12 Main St SW",
        aiSays({
          name: "Ana Perez",
          email: "ana@example.com",
          address: "12 Main St SW",
          reply: "Thanks!",
        })
      )
    );
    expect(most.booking?.flow.step).toBe("phone");
    expect(most.text).toBe(`${W.thanks.replace("{name}", "Ana")} ${W.ask.phone}`);
  });
  it("yes books exactly what the booking window sends, the project in details", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const booked = line(await reply({ ...fresh.booking, flow: atConfirm.flow }, "yes"));
    expect(booked.booking).toBeNull();
    expect(fresh.bookings).toEqual([
      {
        bookingLinkId: "estimate",
        startsAt: at(5, 15),
        customer: { name: "Ana Perez", email: "ana@example.com", phone: "4035550101" },
        location: "12 Main St SW, Calgary",
        details: "Living room and two bedrooms, walls and ceilings",
        answers: [],
        language: "en",
        requestKey: "k1",
      },
    ]);
  });
  it("a second yes never books twice", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const at3 = { ...fresh.booking, flow: atConfirm.flow };
    const first = line(await reply(at3, "yes"));
    expect(first.booking).toBeNull();
    // Even sent again with its key, the CRM answers the booking it has.
    const second = line(await reply(at3, "yes"));
    expect(second.text.startsWith("Booked: ")).toBe(true);
    expect(fresh.sent).toHaveLength(2);
    expect(fresh.bookings).toHaveLength(1);
  });
  it("answer_needed: a question the business added meanwhile is asked in the chat, then booked", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    fresh.crm.business = {
      ...PRIMO,
      questions: [{ id: "pets", label: "Do you have pets?", required: true }],
    };
    const asked = line(await reply({ ...fresh.booking, flow: atConfirm.flow }, "yes"));
    expect(asked.text).toBe("Do you have pets?");
    expect(asked.booking?.flow.step).toBe("answer:pets");
    expect(fresh.bookings).toHaveLength(0);
    const answered = line(await reply(asked.booking!, "a cat"));
    expect(answered.booking?.flow.step).toBe("confirm");
    expect(answered.text).toContain("Do you have pets?: a cat.");
    line(await reply(answered.booking!, "yes"));
    expect(fresh.bookings[0]?.answers).toEqual([
      { questionId: "pets", question: "Do you have pets?", answer: "a cat" },
    ]);
  });
  it("answer_needed for the project box: asked in the chat instead of failing", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const noProject = {
      ...atConfirm.flow,
      values: { ...atConfirm.flow.values, details: undefined },
    };
    const asked = line(await reply({ ...fresh.booking, flow: noProject }, "yes"));
    expect(asked.booking?.flow.step).toBe("details");
    expect(asked.text).toBe("Tell us about your project.");
  });
  it("too many tries: says so, and keeps the booking and its key", async () => {
    const fresh = await started({ ...primo, next: ["tooMany"] }, "anything Saturday afternoon?");
    const limited = line(await reply({ ...fresh.booking, flow: atConfirm.flow }, "yes"));
    expect(limited.text).toBe(W.tooMany);
    expect(limited.booking?.requestKey).toBe("k1");
    expect(limited.booking?.flow.step).toBe("confirm");
  });
  it("no answer at all: the same key on the next yes", async () => {
    const fresh = await started({ ...primo, next: ["noAnswer"] }, "anything Saturday afternoon?");
    const lost = line(await reply({ ...fresh.booking, flow: atConfirm.flow }, "yes"));
    expect(lost.text).toBe(W.lost);
    line(await reply(lost.booking!, "yes"));
    expect(fresh.bookings).toHaveLength(1);
    expect(fresh.sent.map((r) => r.requestKey)).toEqual(["k1", "k1"]);
  });
});

describe("a form's optional boxes", async () => {
  const optional = {
    business: NAME_AND_EMAIL,
    services: [{ ...ESTIMATE, addressMode: "optional" as const }],
  };
  const { booking } = await started(optional, "can I book Saturday?");
  const turn = (f: BookingFlowType, text: string) => said(bookingTurn(f, text, W));
  const atAddress = turn(turn(turn(booking.flow, "9").flow, "Bo").flow, "bo@example.com");

  it("an optional address is asked once, saying it can be skipped", () => {
    expect(atAddress.flow.step).toBe("address");
    expect(atAddress.text).toBe(`${W.ask.address} ${W.optional}`);
  });
  it("a plain skip moves on without the AI, and no address is sent", async () => {
    const fresh = await started(optional, "can I book Saturday?");
    const skipped = line(await reply({ ...fresh.booking, flow: atAddress.flow }, "skip", noAi));
    expect(skipped.booking?.flow.step).toBe("details");
    const confirm = line(await reply(skipped.booking!, "no thanks", noAi));
    expect(confirm.booking?.flow.step).toBe("confirm");
    line(await reply(confirm.booking!, "yes", noAi));
    expect(fresh.bookings[0]).not.toHaveProperty("location");
  });
  it("the project box skipped: no details are sent, since the read-back named none", async () => {
    const fresh = await started(optional, "can I book Saturday? I need my fence painted");
    const skipped = line(await reply({ ...fresh.booking, flow: atAddress.flow }, "skip", noAi));
    const confirm = line(await reply(skipped.booking!, "skip", noAi));
    line(await reply(confirm.booking!, "yes", noAi));
    expect(fresh.bookings).toHaveLength(1);
    expect(fresh.bookings[0]).not.toHaveProperty("details");
  });
  it("the AI's skip moves on only for a box the form does not require", async () => {
    const fresh = await started(optional, "can I book Saturday?");
    const skipped = line(
      await reply(
        { ...fresh.booking, flow: atAddress.flow },
        "I'd rather not say",
        aiSays({ skip: true })
      )
    );
    expect(skipped.booking?.flow.step).toBe("details");
  });
  it("contact rule either: a phone number is enough", async () => {
    const either = await started({ business: { ...NAME_AND_EMAIL, contactRule: "either" } });
    const atContact = turn(turn(either.booking.flow, "9").flow, "Bo");
    expect(atContact.text).toContain(W.ask.contact);
    expect(turn(atContact.flow, "403 555 0101").flow.values.phone).toBe("4035550101");
  });
  it("the business's form unreadable: the booking window takes it from here", async () => {
    const down = await startBooking(
      crmWith({ down: true }).source,
      W,
      "en",
      "book me Saturday",
      NOW
    );
    expect(down).toEqual({ text: W.down, booking: null, toWindow: true });
  });
});

describe("an open booking keeps its own replies, buttons and values", async () => {
  const primo = { business: PRIMO, services: [PRIMO_ESTIMATE] };
  const { booking } = await started(primo, "anything Saturday afternoon?");
  const turn = (f: BookingFlowType, text: string) => said(bookingTurn(f, text, W));
  const atDetails = [
    booking.flow.times[0].label,
    "Ana Perez",
    "ana@example.com",
    "403 555 0101",
    "12 Main St SW",
  ].reduce((f, text) => turn(f, text).flow, booking.flow);
  const atConfirm = turn(atDetails, "Living room walls").flow;

  it("a day in a reply to an open booking never starts another one", () => {
    const open = { ...booking, flow: atConfirm };
    expect(asksForNewTime("Yes, book it for Saturday", "en", open, TODAY)).toBeNull();
    expect(
      asksForNewTime(
        "Paint the living room, I'm available Friday",
        "en",
        { ...booking, flow: atDetails },
        TODAY
      )
    ).toBeNull();
    expect(asksForNewTime("Yes, book it for Saturday", "en", null, TODAY)?.day?.getTime()).toBe(
      day(5).getTime()
    );
  });
  it('so "yes, book it for Saturday" at the read-back books the open booking', async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const booked = line(
      await reply(
        { ...fresh.booking, flow: atConfirm },
        "Yes, book it for Saturday",
        aiSays({ book: true, day: "2026-11-07" })
      )
    );
    expect(booked.booking).toBeNull();
    expect(fresh.bookings).toHaveLength(1);
  });
  it("and a project answer naming a day is kept as the project", async () => {
    const kept = line(
      await reply(
        { ...booking, flow: atDetails },
        "Paint the living room, I'm available Friday",
        aiSays({ details: "Paint the living room" })
      )
    );
    expect(kept.booking?.flow.step).toBe("confirm");
    expect(kept.booking?.flow.values.details).toBe("Paint the living room");
  });
  it("only the open booking's buttons can be tapped; an older bubble's are stale", () => {
    const older = { ...booking };
    const list: BubbleType[] = [
      { id: 1, from: "them", text: "times", booking: older },
      { id: 2, from: "them", text: "" },
    ];
    const newer = { ...booking, requestKey: "k2" };
    const shown = showBubble(list, 2, { from: "them", text: "new times", booking: newer }, newer);
    expect(shown[0].stale).toBe(true);
    expect(shown[1].stale).toBeUndefined();
    // The booking ended: no times anywhere can be tapped.
    expect(showBubble(shown, 2, shown[1], null).every((b) => b.stale)).toBe(true);
  });
  it("a correction at the read-back that fails our check reads back again and books nothing", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const again = line(
      await reply(
        { ...fresh.booking, flow: atConfirm },
        "yes, but use bo at nowhere",
        aiSays({ book: true, email: "bo at nowhere" })
      )
    );
    expect(again.booking?.flow.step).toBe("confirm");
    expect(again.booking?.flow.values.email).toBe("ana@example.com");
    expect(again.text).toContain("Here's your booking");
    expect(fresh.sent).toHaveLength(0);
  });
  it("a time the AI named that is not listed is a change too: nothing is booked", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    const again = line(
      await reply(
        { ...fresh.booking, flow: atConfirm },
        "yes, the 5th one",
        aiSays({ book: true, time: 5 })
      )
    );
    expect(again.booking?.flow.step).toBe("confirm");
    expect(fresh.sent).toHaveLength(0);
  });
  it("request_key_used: the earlier booking stands, and none is made", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    fresh.bookings.push({
      ...fresh.booking.flow,
      requestKey: "k1",
      bookingLinkId: "estimate",
      startsAt: at(5, 9),
    } as never);
    const answer = line(await reply({ ...fresh.booking, flow: atConfirm }, "yes"));
    expect(answer.text).toBe(W.already);
    expect(answer.booking).toBeNull();
    expect(fresh.bookings).toHaveLength(1);
  });
  it("a refused booking hands over to the booking window", async () => {
    const fresh = await started(primo, "anything Saturday afternoon?");
    fresh.crm.services = [{ ...PRIMO_ESTIMATE, id: "another" }];
    const answer = line(await reply({ ...fresh.booking, flow: atConfirm }, "yes"));
    expect(answer).toEqual({ text: W.failed, booking: null, toWindow: true });
  });
});

describe("the booking AI's call stays small and never waits long", async () => {
  const { booking } = await started({ business: PRIMO, services: [PRIMO_ESTIMATE] });
  afterEach(() => vi.unstubAllGlobals());

  it("a long conversation and long values are cut to the limits", () => {
    const turns = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 ? ("assistant" as const) : ("user" as const),
      text: "x".repeat(3000),
    }));
    const long = {
      ...booking,
      flow: { ...booking.flow, values: { name: "N".repeat(500), details: "d".repeat(5000) } },
    };
    const body = bookingAskBody(long, [...turns, { role: "user", text: "y".repeat(900) }], NOW);
    expect(askChars(body)).toBeLessThanOrEqual(BOOKING_ASK_LIMITS.totalChars);
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      text: "y".repeat(BOOKING_ASK_LIMITS.userChars),
    });
    expect(body.messages.length).toBeLessThanOrEqual(BOOKING_ASK_LIMITS.turns);
    expect(body.fields.find((f) => f.key === "name")?.value).toHaveLength(120);
    expect(body.fields.find((f) => f.key === "details")?.value).toHaveLength(2000);
  });
  it("an AI that does not answer in time: the word lists read the reply", async () => {
    vi.stubGlobal(
      "fetch",
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () => reject(new Error("timeout")))
        )
    );
    expect(
      await bookingAi("/api/chat/booking", 20)(booking, [{ role: "user", text: "hi" }])
    ).toBeNull();
  });
  it("a refused call: the word lists read the reply", async () => {
    vi.stubGlobal(
      "fetch",
      async () => new Response(JSON.stringify({ error: "invalid" }), { status: 400 })
    );
    expect(
      await bookingAi("/api/chat/booking")(booking, [{ role: "user", text: "hi" }])
    ).toBeNull();
  });
});

describe("Frank's laptop conversation on 0.2.1, reply by reply", async () => {
  // Saturday at 1, 2 and 3 in the afternoon, as the chat routes each reply: a new time asked for only with no
  // booking open, every reply to an open booking to the booking AI (stood in, as the real one answered).
  const afternoon = [at(5, 13), at(5, 14), at(5, 15)];
  const fresh = await started(
    { business: PRIMO, services: [PRIMO_ESTIMATE], starts: afternoon },
    ""
  );
  let open: ChatBookingType | null = null;
  const say = async (text: string, heard: Partial<BookingUnderstoodType> = {}) => {
    const asked = asksForNewTime(text, "en", open, TODAY);
    const answer = asked
      ? await startBooking(fresh.source, W, "en", text, NOW)
      : line(await bookingReply(open!, text, { ask: aiSays(heard), now: NOW }));
    open = answer.booking && { ...answer.booking, requestKey: "k1" };
    return answer;
  };
  const r1 = await say("anything open saturday afternoon for an estimate?");
  const r2 = await say("2:00 works. Frank Test2, frankdmosquera+chat2@gmail.com, 403 555 0188", {
    time: 2,
    day: "2026-11-07",
    part: "afternoon",
    name: "Frank Test2",
    email: "frankdmosquera+chat2@gmail.com",
    phone: "403 555 0188",
    reply: "Thanks, Frank.",
  });
  const r3 = await say("50 Test Ave SW Calgary", {
    address: "50 Test Ave SW Calgary",
    time: 2,
    part: "afternoon",
  });
  const r4 = await say("Just the living room, I'm free Friday too if that helps", {
    details: "Just the living room",
    day: "2026-11-06",
  });
  const r5 = await say("Yes, book it for Saturday", { book: true, day: "2026-11-07" });

  it("1: Saturday afternoon's times as buttons", () => {
    expect(r1.booking?.flow.step).toBe("time");
    expect(r1.booking?.flow.times.map((t) => t.startsAt)).toEqual(afternoon);
  });
  it("2: takes 2:00 and keeps the name, email and phone, though the AI echoed the day and the afternoon", () => {
    expect(r2.booking?.flow.time?.startsAt).toBe(at(5, 14));
    expect(r2.booking?.flow.values).toMatchObject({
      name: "Frank Test2",
      email: "frankdmosquera+chat2@gmail.com",
      phone: "4035550188",
    });
    expect(r2.booking?.flow.step).toBe("address");
  });
  it("3: the address, then the project box", () => {
    expect(r3.booking?.flow.values.address).toBe("50 Test Ave SW Calgary");
    expect(r3.booking?.flow.step).toBe("details");
  });
  it("4: the project is kept, and a Friday said in passing never moves the time", () => {
    expect(r4.booking?.flow.values.details).toBe("Just the living room");
    expect(r4.booking?.flow.time?.startsAt).toBe(at(5, 14));
    expect(r4.booking?.flow.step).toBe("confirm");
  });
  it("5: the yes books it, everything given in it", () => {
    expect(r5.booking).toBeNull();
    expect(fresh.bookings).toEqual([
      expect.objectContaining({
        startsAt: at(5, 14),
        customer: {
          name: "Frank Test2",
          email: "frankdmosquera+chat2@gmail.com",
          phone: "4035550188",
        },
        location: "50 Test Ave SW Calgary",
        details: "Just the living room",
      }),
    ]);
  });
});

describe("Frank's laptop conversation on 0.2.2: the picked time never drifts", async () => {
  // Saturday 12:00 to 2:30 every half hour; 2:00 is the 5th listed, 2:30 the 6th.
  const half = (hour: number, minute: number) =>
    new Date(Date.UTC(2026, 10, 7, hour + 5, minute)).toISOString();
  const saturday = [
    half(12, 0),
    half(12, 30),
    half(13, 0),
    half(13, 30),
    half(14, 0),
    half(14, 30),
  ];
  const talk = async (turn3: Partial<BookingUnderstoodType>, echo: number | null = null) => {
    const fresh = await started(
      { business: PRIMO, services: [PRIMO_ESTIMATE], starts: saturday },
      ""
    );
    let open: ChatBookingType | null = null;
    const say = async (text: string, heard: Partial<BookingUnderstoodType> = {}) => {
      const asked = asksForNewTime(text, "en", open, TODAY);
      const answer = asked
        ? await startBooking(fresh.source, W, "en", text, NOW)
        : line(await bookingReply(open!, text, { ask: aiSays(heard), now: NOW }));
      open = answer.booking && { ...answer.booking, requestKey: "k1" };
      return answer;
    };
    const r1 = await say("anything open saturday afternoon for an estimate?");
    const r2 = await say("2:00 works. Frank Tester, frankdmosquera+chat2@gmail.com, 403 555 0188", {
      time: 5,
      name: "Frank Tester",
      email: "frankdmosquera+chat2@gmail.com",
      phone: "403 555 0188",
    });
    const r3 = await say("50 Test Ave SW Calgary", { address: "50 Test Ave SW Calgary", ...turn3 });
    // The real model keeps echoing a listed number it gave on turn 3.
    const r4 = await say("Just the living room, I'm free Friday too if that helps", {
      details: "Just the living room",
      time: echo,
    });
    const r5 = await say("Yes, book it for Saturday", {
      book: true,
      day: "2026-11-07",
      time: echo,
    });
    return { fresh, r1, r2, r3, r4, r5 };
  };

  it("1-2: six times, and 2:00 is taken with the name, email and phone", async () => {
    const { r1, r2 } = await talk({});
    expect(r1.booking?.flow.times.map((t) => t.startsAt)).toEqual(saturday);
    expect(r2.booking?.flow.time?.startsAt).toBe(half(14, 0));
    expect(r2.booking?.flow.step).toBe("address");
  });
  it.each([
    ["echoes the time one off (6, the 2:30)", { time: 6 }, 6],
    ['reads "50" as a number', { time: 50 }, null],
  ])("3-5: an AI that %s never moves 2:00, and 2:00 is booked", async (_what, turn3, echo) => {
    const { fresh, r3, r4, r5 } = await talk(turn3, echo);
    expect(r3.booking?.flow.time?.startsAt).toBe(half(14, 0));
    expect(r3.text).not.toContain("2:30");
    expect(r3.booking?.flow.step).toBe("details");
    expect(r4.booking?.flow.step).toBe("confirm");
    expect(r4.text).toContain("2:00");
    expect(r5.booking).toBeNull();
    expect(fresh.bookings.map((b) => b.startsAt)).toEqual([half(14, 0)]);
  });
  it("the visitor's own words still change the time", async () => {
    const { r4 } = await talk({});
    const moved = line(
      await bookingReply(r4.booking!, "actually make it 2:30", {
        ask: aiSays({ time: 6 }),
        now: NOW,
      })
    );
    expect(moved.booking?.flow.time?.startsAt).toBe(half(14, 30));
    expect(moved.booking?.flow.step).toBe("confirm");
    expect(moved.text).toContain("2:30");
  });
});
