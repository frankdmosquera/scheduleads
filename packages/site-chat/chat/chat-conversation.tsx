import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { askChat, type ChatReplyType } from "../agent/ask-chat.js";
import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatTurnType } from "../agent/chat-event-type.js";
import type { ChatAnswersType, ChatTileType } from "../answers/chat-answers-type.js";
import { relatedQuestions } from "../answers/related-questions.js";
import { asksForTime } from "../booking/asked-day.js";
import type { BookingAccountType, BookingServiceType } from "../booking/booking-api.js";
import { createBookingSource, type BookingSourceType } from "../booking/booking-source.js";
import { todayIn } from "../booking/business-clock.js";
import {
  bookingAi,
  bookingReply,
  startBooking,
  tapService,
  tapTime,
  type BookingAskType,
  type ChatBookingLineType,
  type ChatBookingType,
} from "../booking/chat-booking.js";
import type { ChatTimeType } from "../booking/chat-times.js";
import type { ChatDevFactsType } from "../dev/dev-row.js";
import { chosenVoice } from "../voice/chosen-voice.js";
import {
  dropListening,
  recognizerClass,
  startListening,
  type SpeechRecognizerType,
} from "../voice/listen.js";
import { createSpeaker, type SpeakerType } from "../voice/speak-aloud.js";
import type { ChatLanguageType, ChatWordsType, PersonPathType } from "../words/chat-words-type.js";
import { AnswerText } from "./answer-text.js";
import { AnswerTiles } from "./answer-tiles.js";
import { PersonWays, type PersonWayLinksType } from "./person-ways.js";

interface BubbleType {
  id: number;
  from: "me" | "them";
  text: string;
  typing?: boolean;
  /** The visitor asked for a way to a person: its button, carrying the question. `toWindow`: the site's own booking. */
  go?: { path: PersonPathType; message: string; toWindow?: boolean };
  /** A booking at its time or service step: the free times, or the services, as buttons. */
  booking?: ChatBookingType;
  /** "Did you mean...?": stored questions the visitor can tap for their answer. */
  choices?: string[];
  /** Other questions from the same group as the stored question just answered, as buttons. */
  related?: string[];
  /** Nobody could answer: every way to a person, each carrying this question. */
  ways?: string;
  /** An answer that is a list, drawn as tiles under its words. */
  tiles?: readonly ChatTileType[];
}

export interface ChatConversationPropsType {
  lang: ChatLanguageType;
  words: ChatWordsType;
  answers: ChatAnswersType;
  links: PersonWayLinksType;
  onWay?: (path: PersonPathType, question: string) => void;
  /** The business in Booking CRM: with it, the chat books in the conversation. */
  booking?: BookingAccountType;
  chatUrl: string;
  voiceUrl: string;
  bookingUrl: string;
  /** Laptop only: who answered each question, for the inspector. */
  onAnswered?: (facts: ChatDevFactsType) => void;
}

const noSubscription = () => () => {};

/** The inspector's clock; asked only while a question is being answered, never while rendering. */
const clock = () => performance.now();

/** "Did you mean...?" with its questions, one per line: as the conversation keeps it and the voice says it. */
const suggestLine = (ask: string, questions: readonly string[]) => [ask, ...questions].join("\n");

/** A bubble with booking buttons, as the conversation keeps it: its line, then what the buttons say. */
function bookingTurnText(text: string, booking: ChatBookingType): string {
  const { flow } = booking;
  const named =
    flow.step === "service" ? flow.services.map((s) => s.name) : flow.times.map((t) => t.label);
  return `${text} ${named.join(", ")}`;
}

/** Midnight of today: on the business's clock once a booking read it, else on this machine's. */
function todayFor(timeZone: string | null): Date {
  if (timeZone) return todayIn(timeZone);
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The conversation: it opens on the greeting, then answers for real. A tapped question answers at once from the
 * site's own answers; a typed or spoken one goes to the site's server, Jev first, then the AI, then a person.
 */
export function ChatConversation({
  lang,
  words,
  answers,
  links,
  onWay,
  booking,
  chatUrl,
  voiceUrl,
  bookingUrl,
  onAnswered,
}: ChatConversationPropsType) {
  const [bubbles, setBubbles] = useState<BubbleType[]>(() => [
    { id: 1, from: "them", text: words.float.greeting },
  ]);
  const [asked, setAsked] = useState(false);
  const [input, setInput] = useState("");
  const nextId = useRef(2);
  const busy = useRef(false);
  // The language the chat last answered in: the server keeps it for an unclear next question.
  const replyLang = useRef<ChatLanguageType | undefined>(undefined);
  const turns = useRef<ChatTurnType[]>([{ role: "assistant", text: words.float.greeting }]);
  const bodyRef = useRef<HTMLDivElement>(null);
  // Asking out loud: a mic only where the browser can listen.
  const canListen = useSyncExternalStore(
    noSubscription,
    () => Boolean(recognizerClass()),
    () => false
  );
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState("");
  const rec = useRef<SpeechRecognizerType | null>(null);
  const speaker = useRef<SpeakerType | null>(null);
  // Bumped by the mic, a new question and leaving the page: an answer from an earlier round is never spoken.
  const speakRound = useRef(0);
  // The stored questions already answered in this chat, never offered again.
  const answeredQuestions = useRef(new Set<string>());
  // A booking being talked through: while it is open, every reply goes to it first, never to Jev or the AI.
  const bookingNow = useRef<ChatBookingType | null>(null);
  // The business's zone once a booking read it, so "tomorrow" is the business's tomorrow.
  const businessZone = useRef<string | null>(null);
  const bookingSource = useRef<BookingSourceType | null>(null);
  const bookingAsk = useRef<BookingAskType | null>(null);

  useEffect(
    () => () => {
      // Leaving the page: the mic goes off and nothing more is said.
      dropListening(rec.current);
      rec.current = null;
      speakRound.current++;
      speaker.current?.close();
    },
    []
  );

  useEffect(() => {
    const body = bodyRef.current;
    if (body && asked) body.scrollTop = body.scrollHeight;
  }, [bubbles, asked]);

  /** The chat's speaker, made on first use (it needs the browser), in the visitor's voice. */
  function voice(): SpeakerType {
    speaker.current ??= createSpeaker(voiceUrl, chosenVoice, () => replyLang.current ?? lang);
    return speaker.current;
  }

  function show(id: number, bubble: Omit<BubbleType, "id">) {
    setBubbles((list) => list.map((b) => (b.id === id ? { ...bubble, id } : b)));
  }

  /** The business's booking routes for this chat, made on first use; null when the site gave no booking. */
  function source(): BookingSourceType | null {
    if (!booking) return null;
    bookingSource.current ??= createBookingSource(booking);
    return bookingSource.current;
  }

  /** A booking line as the chat's answer: its buttons at the time or service, the window when it cannot go on. */
  function fromBooking(line: ChatBookingLineType, q: string): Omit<BubbleType, "id"> {
    bookingNow.current = line.booking;
    if (line.booking?.timeZone) businessZone.current = line.booking.timeZone;
    const step = line.booking?.flow.step;
    const toWindow = line.toWindow && Boolean(links.book || onWay);
    return {
      from: "them",
      text: line.text,
      booking: step === "time" || step === "service" ? line.booking! : undefined,
      go: toWindow ? { path: "book", message: q, toWindow: true } : undefined,
    };
  }

  /** The answer the server's reply becomes in the chat; `fixed` is false only for the AI's own words. */
  function fromReply(
    reply: ChatReplyType,
    q: string
  ): { answer: Omit<BubbleType, "id">; fixed: boolean; stored?: string } {
    const ways = (text: string) => ({ from: "them" as const, text, ways: q });
    if (reply.error === "limit") return { answer: ways(words.limit), fixed: true };
    if (reply.person)
      return {
        answer: {
          from: "them",
          text: words.paths[reply.person],
          go: { path: reply.person, message: q },
        },
        fixed: true,
      };
    if (reply.suggest?.length)
      return { answer: { from: "them", text: words.suggest, choices: reply.suggest }, fixed: true };
    if (reply.stored) {
      const text = { from: "them" as const, text: reply.text };
      return { answer: reply.ways ? ways(reply.text) : text, fixed: true, stored: reply.question };
    }
    if (!reply.error)
      return {
        answer: reply.ways ? ways(reply.text) : { from: "them", text: reply.text },
        fixed: false,
      };
    return { answer: ways(words.handOver), fixed: true };
  }

  /** `chip`: a tapped stored question, answered from the site's own answers. `spoken`: asked out loud, so answered out loud. */
  async function ask(raw: string, chip?: string, spoken = false) {
    // Typed input is capped by the field; a spoken question is not, so every question is cut here.
    const q = raw.trim().slice(0, CHAT_SETTINGS.maxQuestionChars);
    if (!q || busy.current) return;
    busy.current = true;
    const started = clock();
    let replied: ChatReplyType | null = null;
    speakRound.current++;
    speaker.current?.stop();
    const round = speakRound.current;
    const stillSpoken = () => round === speakRound.current;
    // A fixed line is said from the voice lines; the AI's answer arrives sentence by sentence.
    let fixedLine = true;
    let sentencesHeard = 0;
    setInput("");
    setAsked(true);
    const id = nextId.current + 2;
    nextId.current += 2;
    setBubbles((list) => [
      ...list.map((b) => (b.related ? { ...b, related: undefined } : b)),
      { id: id - 1, from: "me", text: q },
      { id, from: "them", text: "", typing: true },
    ]);
    let answer: Omit<BubbleType, "id"> = { from: "them", text: words.handOver, ways: q };
    let answered = false;
    // What is said out loud when it differs from what is shown (the times, read one by one).
    let spokenLine: string | undefined;
    // How a booking answered, for the inspector.
    let bookingBy: ChatDevFactsType["booking"];
    const bookingLine = (line: ChatBookingLineType) => {
      spokenLine = line.spoken;
      replyLang.current = line.booking?.flow.lang ?? replyLang.current;
      return fromBooking(line, q);
    };
    const books = source();
    // A request for a time is answered from the calendar at once, never sent to the server.
    const timeAsk = !chip && books ? asksForTime(q, lang, todayFor(businessZone.current)) : null;
    // A booking being talked through takes the reply first, never Jev or the AI; anything else ends it. A new
    // request for a time ("Monday instead") starts over with that day's times.
    const going =
      books && bookingNow.current && !timeAsk && !chip
        ? await bookingReply(bookingNow.current, q, {
            turns: [...turns.current, { role: "user", text: q }],
            ask: (bookingAsk.current ??= bookingAi(bookingUrl)),
          })
        : null;
    if (going === "leave") bookingNow.current = null;
    // The stored question this answer is, when it is one: its tiles and related questions follow it.
    let storedQuestion: string | undefined;
    const stored = chip ? answers.stored.find((s) => s.question === chip) : undefined;
    if (stored) {
      answer = stored.offersPerson
        ? { from: "them", text: stored.answer, ways: q }
        : { from: "them", text: stored.answer };
      storedQuestion = stored.question;
      answered = true;
    } else if (going && going !== "leave") {
      answer = bookingLine(going);
      bookingBy = going.byAi ? "ai" : "words";
      if (going.byAi) replied = { text: going.text, trace: going.byAi.trace };
      answered = true;
    } else if (books && timeAsk) {
      answer = bookingLine(await startBooking(books, words.book, lang, q));
      bookingBy = "calendar";
      answered = true;
    } else if (!chip) {
      const reply = await askChat(
        {
          url: chatUrl,
          lang,
          replyLang: replyLang.current,
          turns: [...turns.current, { role: "user", text: q }],
          spoken: spoken
            ? {
                voice: chosenVoice(),
                onSentence: (sentence, audio, sentenceLang) => {
                  sentencesHeard++;
                  // Its language before the answer's end says it, so a fallback voice speaks it right.
                  if (sentenceLang) replyLang.current = sentenceLang;
                  if (stillSpoken()) voice().sentence(sentence, audio);
                },
              }
            : undefined,
        },
        (soFar) => show(id, { from: "them", text: soFar })
      );
      replied = reply;
      if (reply.lang) replyLang.current = reply.lang;
      const read = fromReply(reply, q);
      answer = read.answer;
      fixedLine = read.fixed;
      storedQuestion = read.stored;
      answered = !reply.error;
      // The visitor asked to book: the free times right here, on the day asked for when one was named.
      if (reply.person === "book" && books) {
        answer = bookingLine(await startBooking(books, words.book, lang, q));
        bookingBy = "calendar";
      }
    }
    const list = storedQuestion
      ? answers.tiles?.find((l) => l.question === storedQuestion)
      : undefined;
    if (list) answer = { ...answer, tiles: list.tiles };
    if (storedQuestion) {
      answeredQuestions.current.add(storedQuestion);
      const next = relatedQuestions(answers, storedQuestion, answeredQuestions.current);
      if (next.length) answer = { ...answer, related: next };
    }
    show(id, answer);
    onAnswered?.({
      question: q,
      ms: clock() - started,
      chip: Boolean(chip),
      reply: replied,
      booking: bookingBy,
    });
    // Only answered turns join the conversation, so one refused question never spoils the next ones. A "Did you
    // mean" is kept with its choices, so "the first one" can be understood; times and services with their buttons.
    const whole = answer.choices
      ? suggestLine(answer.text, answer.choices)
      : answer.booking
        ? bookingTurnText(answer.text, answer.booking)
        : answer.text;
    if (answered) turns.current.push({ role: "user", text: q }, { role: "assistant", text: whole });
    busy.current = false;
    if (!spoken || !stillSpoken()) return;
    // An AI answer that failed halfway: its spoken sentences stop, and the hand-over is said instead.
    if (fixedLine && sentencesHeard) speaker.current?.stop();
    // A booking being talked through listens again once its question is said.
    if (fixedLine) voice().line(spokenLine ?? whole, bookingNow.current ? listen : undefined);
    // An AI answer that came with no spoken sentences is read whole in the browser's voice.
    else if (sentencesHeard === 0) voice().sentence(answer.text);
  }

  /** A booking line from a tap or a picked way, added to the conversation as the chat's own answer. */
  async function bookingStep(
    label: string,
    make: () => Promise<ChatBookingLineType> | ChatBookingLineType
  ) {
    if (busy.current) return;
    busy.current = true;
    const started = clock();
    nextId.current += 1;
    const id = nextId.current;
    setAsked(true);
    setBubbles((list) => [...list, { id, from: "them", text: "", typing: true }]);
    const answer = fromBooking(await make(), label);
    show(id, answer);
    onAnswered?.({
      question: label,
      ms: clock() - started,
      chip: true,
      reply: null,
      booking: "button",
    });
    const whole = answer.booking ? bookingTurnText(answer.text, answer.booking) : answer.text;
    turns.current.push({ role: "user", text: label }, { role: "assistant", text: whole });
    busy.current = false;
  }

  /**
   * A way to a person picked under an answer, when the site gave it no link: the book way books right here in the
   * chat when the site gave its booking; the rest, and the book way without it, go to the site's own handler.
   */
  function pickWay(path: PersonPathType, message: string) {
    const books = source();
    if (path === "book" && books)
      void bookingStep(words.ctas.book, () => startBooking(books, words.book, lang, message));
    else onWay?.(path, message);
  }

  /** A tapped time: the chat asks the first thing the business's form still needs. */
  function onTime(at: ChatBookingType, time: ChatTimeType) {
    void bookingStep(time.label, () => tapTime(at, time));
  }

  /** A tapped service: its free times. */
  function onService(at: ChatBookingType, service: BookingServiceType) {
    void bookingStep(service.name, () => tapService(at, service));
  }

  function listen() {
    const r = startListening({
      lang: words.voice.speechLang,
      onStart: () => {
        setListening(true);
        setHint(words.voice.listening);
        setInput("");
      },
      onHeard: setInput,
      onError: (why) => setHint(why === "blocked" ? words.voice.micBlocked : words.voice.notCaught),
      onEnd: (said) => {
        setListening(false);
        rec.current = null;
        if (said) {
          setHint("");
          void ask(said, undefined, true);
        } else setHint((h) => (h === words.voice.listening ? "" : h));
      },
    });
    rec.current = r;
    if (!r) setHint(words.voice.tapAgain);
  }

  function onMic() {
    speakRound.current++;
    speaker.current?.stop();
    if (rec.current) {
      rec.current.stop();
      return;
    }
    // The tap lets our voice play for the rest of the visit.
    voice().unlock();
    listen();
  }

  /** Typing while the mic listens takes over: what was heard so far is dropped, never asked. */
  function type(value: string) {
    if (rec.current) {
      dropListening(rec.current);
      rec.current = null;
      setListening(false);
      setHint("");
    }
    setInput(value);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <>
      <div className="sc-body" ref={bodyRef} aria-live="polite">
        {bubbles.map((b) => (
          <div key={b.id} className={b.from === "me" ? "sc-bubble sc-bubble-me" : "sc-bubble"}>
            {b.typing ? (
              <span className="sc-typing">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <AnswerText text={b.text} arrive={b.from !== "me"} />
            )}
            {b.go &&
              (links[b.go.path] ? (
                <a className="sc-go" href={links[b.go.path]}>{`${words.ctas[b.go.path]} →`}</a>
              ) : (
                (onWay || (b.go.path === "book" && booking)) && (
                  <button
                    type="button"
                    className="sc-go"
                    onClick={() =>
                      b.go!.toWindow
                        ? onWay?.(b.go!.path, b.go!.message)
                        : pickWay(b.go!.path, b.go!.message)
                    }
                  >
                    {`${words.ctas[b.go.path]} →`}
                  </button>
                )
              ))}
            {b.booking && (
              <span className="sc-choices">
                {b.booking.flow.step === "service"
                  ? b.booking.flow.services.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => onService(b.booking!, service)}
                      >
                        {service.name}
                      </button>
                    ))
                  : b.booking.flow.times.map((time) => (
                      <button
                        key={time.startsAt}
                        type="button"
                        onClick={() => onTime(b.booking!, time)}
                      >
                        {time.label}
                      </button>
                    ))}
              </span>
            )}
            {b.tiles && <AnswerTiles tiles={b.tiles} />}
            {b.ways !== undefined && (
              <PersonWays
                words={words.ways}
                links={links}
                onPick={onWay || booking ? (path) => pickWay(path, b.ways!) : undefined}
              />
            )}
            {(b.related ?? b.choices) && (
              <span className="sc-choices">
                {(b.related ?? b.choices)!.map((question) => (
                  <button key={question} type="button" onClick={() => void ask(question, question)}>
                    {question}
                  </button>
                ))}
              </span>
            )}
          </div>
        ))}
      </div>
      <form className="sc-input" onSubmit={onSubmit} data-listening={listening ? "" : undefined}>
        {canListen && (
          <button
            type="button"
            className="sc-mic"
            aria-label={words.voice.mic}
            title={words.voice.mic}
            aria-pressed={listening}
            onClick={onMic}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
        )}
        <input
          value={input}
          onChange={(e) => type(e.target.value)}
          placeholder={hint || words.placeholder}
          aria-label={words.placeholder}
          maxLength={CHAT_SETTINGS.maxQuestionChars}
        />
        <button type="submit" className="sc-send" aria-label={words.send}>
          &uarr;
        </button>
      </form>
    </>
  );
}
