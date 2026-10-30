import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { askChat, type ChatReplyType } from "../agent/ask-chat.js";
import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatTurnType } from "../agent/chat-event-type.js";
import type { ChatAnswersType, ChatTileType } from "../answers/chat-answers-type.js";
import { relatedQuestions } from "../answers/related-questions.js";
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
  /** The visitor asked for a way to a person: its button, carrying the question. */
  go?: { path: PersonPathType; message: string };
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
  chatUrl: string;
  voiceUrl: string;
  /** Laptop only: who answered each question, for the inspector. */
  onAnswered?: (facts: ChatDevFactsType) => void;
}

const noSubscription = () => () => {};

/** The inspector's clock; asked only while a question is being answered, never while rendering. */
const clock = () => performance.now();

/** "Did you mean...?" with its questions, one per line: as the conversation keeps it and the voice says it. */
const suggestLine = (ask: string, questions: readonly string[]) => [ask, ...questions].join("\n");

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
  chatUrl,
  voiceUrl,
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
    // The stored question this answer is, when it is one: its tiles and related questions follow it.
    let storedQuestion: string | undefined;
    const stored = chip ? answers.stored.find((s) => s.question === chip) : undefined;
    if (stored) {
      answer = stored.offersPerson
        ? { from: "them", text: stored.answer, ways: q }
        : { from: "them", text: stored.answer };
      storedQuestion = stored.question;
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
    onAnswered?.({ question: q, ms: clock() - started, chip: Boolean(chip), reply: replied });
    // Only answered turns join the conversation, so one refused question never spoils the next ones. A "Did you
    // mean" is kept with its choices, so "the first one" can be understood.
    const whole = answer.choices ? suggestLine(answer.text, answer.choices) : answer.text;
    if (answered) turns.current.push({ role: "user", text: q }, { role: "assistant", text: whole });
    busy.current = false;
    if (!spoken || !stillSpoken()) return;
    // An AI answer that failed halfway: its spoken sentences stop, and the hand-over is said instead.
    if (fixedLine && sentencesHeard) speaker.current?.stop();
    if (fixedLine) voice().line(whole);
    // An AI answer that came with no spoken sentences is read whole in the browser's voice.
    else if (sentencesHeard === 0) voice().sentence(answer.text);
  }

  /**
   * A way to a person picked under an answer, when the site gave it no link: the site's own handler, with the
   * question. Booking in the chat, once it exists, takes the book way here before the site's handler sees it.
   */
  function pickWay(path: PersonPathType, message: string) {
    onWay?.(path, message);
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
                onWay && (
                  <button
                    type="button"
                    className="sc-go"
                    onClick={() => pickWay(b.go!.path, b.go!.message)}
                  >
                    {`${words.ctas[b.go.path]} →`}
                  </button>
                )
              ))}
            {b.tiles && <AnswerTiles tiles={b.tiles} />}
            {b.ways !== undefined && (
              <PersonWays
                words={words.ways}
                links={links}
                onPick={onWay && ((path) => pickWay(path, b.ways!))}
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
