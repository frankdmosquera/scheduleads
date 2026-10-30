import { experimental_evaluate as evaluate } from "ai";

import { CHAT_SETTINGS, type JevSettingsType } from "../agent/chat-settings.js";
import type { ChatTurnType } from "../agent/chat-event-type.js";
import { MAX_STORED_ANSWERS } from "../answers/chat-answers-problems.js";
import type { StoredAnswerType } from "../answers/chat-answers-type.js";
import type { PersonPathType } from "../words/chat-words-type.js";

/*
 * Jev: TypeSafe's decision model, asked first for every typed question. It never writes text. One call asks it
 * which stored question the visitor asked, what the visitor wants, whether the message asks one thing, how clear it
 * is and which language it is in. Our code combines the numbers, so whatever Jev picks, the visitor only reads words
 * the site wrote. The stored questions travel with every request, so nothing is registered at TypeSafe.
 * API: docs.typesafe.ai/api.
 */

/** Why Jev was not used for a question; the server then asks the AI instead. */
export type JevSkipReasonType =
  "no-key" | "too-many" | "timeout" | "error" | "malformed" | "aborted";

/** What Jev decided for one question, checked in this order. */
export type JevOutcomeType =
  | { kind: "person"; path: PersonPathType; confidence: number }
  /** Only a hello, thanks or goodbye: a friendly fixed line. */
  | { kind: "greeting"; confidence: number }
  | { kind: "offTopic"; confidence: number }
  | { kind: "stored"; question: string; answer: string; confidence: number }
  /** Fairly sure: the visitor is asked "Did you mean...?" with these stored questions, likeliest first. */
  | { kind: "suggest"; questions: string[]; confidence: number }
  /** Not sure: the AI answers, starting from these stored questions (bank positions, likeliest first). */
  | { kind: "unsure"; pick: string; confidence: number; likely: number[] }
  | { kind: "skipped"; reason: JevSkipReasonType; status?: number };

/** What Jev weighed, whatever it decided (the inspector): its read of the intent and its likeliest stored questions. */
export interface JevSeenType {
  intent: string;
  intentConfidence: number;
  top: { question: string; confidence: number }[];
  /** The one-thing answer as the probability of yes, and the clarity score (0 garbled to 3 clear). */
  oneThing?: number;
  clarity?: number;
}

/** How clearly the latest message is English and Spanish, as the probability of yes. */
export interface JevLanguageType {
  english?: number;
  spanish?: number;
}

/** How many of Jev's likeliest stored questions the inspector shows. */
const SEEN = 5;

/** Jev's options for what the visitor wants, and what each one does. `{name}` is the business. */
const INTENTS = {
  question: {
    does: null,
    means:
      "Asks something about {name}, its services, its work or how it works, or tells us about their own home or project",
  },
  book: {
    does: { path: "book" },
    means:
      "Wants to book an estimate, a visit or an appointment, or wants someone to come and see their project",
  },
  call: {
    does: { path: "call" },
    means: "Wants to phone {name}, or wants someone at {name} to phone them",
  },
  message: {
    does: { path: "message" },
    means: "Wants to write to someone at {name}, or to be written back to",
  },
  // Without it, Jev read a plain "hello" as wanting to message a person.
  greeting: {
    does: { greeting: true },
    means: "Only says hello, thanks or goodbye, with no question or request yet",
  },
  off_topic: {
    does: { offTopic: true },
    means: "Has nothing to do with {name} or its work, or asks for something unsafe",
  },
  // Always an "other", so nothing is squeezed into the closest wrong option. It does nothing itself.
  other: { does: null, means: "Anything else, including the cost of one particular thing" },
} as const satisfies Record<
  string,
  { does: { path: PersonPathType } | { greeting: true } | { offTopic: true } | null; means: string }
>;
type IntentType = keyof typeof INTENTS;

/**
 * The yes/no and score questions asked with the two choices: a message asking two things goes to the AI, which
 * can answer both; a message too unclear to act on (speech typing swaps words) is asked "Did you mean...?" first.
 */
const CHECKS = {
  oneThing: {
    type: "noul",
    instructions:
      "Does the visitor's `latest_message` ask exactly one thing? Two separate questions or requests in one message is no; a hello or thanks around one question is still one, and so is telling us about their own home or project, with or without a question.",
  },
  clarity: {
    type: "score",
    instructions:
      "How clearly can the visitor's `latest_message` be understood? It may come from speech typing, which swaps a word for one that sounds alike.",
    criteria: [
      "Garbled: it cannot be understood",
      "A key word seems wrong or misheard, so the meaning is unclear",
      "Understandable, with small slips",
      "Perfectly clear",
    ],
  },
} as const;

/** Which language the visitor clearly wrote in, so the reply can follow it. Shared words are neither. */
const LANGUAGE_CHECKS = {
  english: {
    type: "noul",
    instructions:
      "Is the visitor's `latest_message` clearly written in English? A single word, a greeting, a name, a brand or a product that both English and Spanish speakers use (ok, hola, WhatsApp, Zoom) is no.",
  },
  spanish: {
    type: "noul",
    instructions:
      "Is the visitor's `latest_message` clearly written in Spanish? A single word, a greeting, a name, a brand or a product that both English and Spanish speakers use (ok, hola, WhatsApp, Zoom) is no.",
  },
} as const;

const NONE = "none";
/** How many stored questions a "Did you mean" offers, and how many the AI is pointed to first. */
const SUGGESTED = 2;
const LIKELY = 3;

/** The AI SDK's evaluate call, or a stand-in for tests. */
type EvaluateFnType = (options: {
  model: string;
  state: unknown;
  questions: unknown;
  abortSignal: AbortSignal;
  maxRetries: number;
}) => Promise<{ answers: Record<string, unknown> }>;

/** Other ways visitors word a stored question, keyed by the question as the bank asks it. */
export type AlsoAskedType = Readonly<Record<string, readonly string[]>>;

export interface JevContextType {
  bank: readonly StoredAnswerType[];
  alsoAsked: AlsoAskedType;
  /** The business, as Jev's options name it. */
  name: string;
  /**
   * How Jev is reached. `direct`: TypeSafe's own API with `apiKey`. `gateway`: Vercel's AI Gateway through the
   * AI SDK (the live site signs its own requests; a laptop needs `AI_GATEWAY_API_KEY`). Without either, Jev is skipped.
   */
  via?: "gateway" | "direct";
  apiKey?: string;
  /** `TYPESAFE_BASE_URL`, the SDK's name: a stand-in Jev for tests. Defaults to TypeSafe's API. */
  baseUrl?: string;
  settings?: JevSettingsType;
  /** Asked out loud: a fairly sure pick goes to the AI, which can ask in words, instead of buttons. */
  spoken?: boolean;
  /** The visitor's request: leaving the page cancels the call. */
  signal?: AbortSignal;
  /** A stand-in for tests; the real `fetch` otherwise. */
  fetchFn?: typeof fetch;
  /** A stand-in for tests; the AI SDK's `experimental_evaluate` otherwise. */
  evaluateFn?: EvaluateFnType;
}

/**
 * TypeSafe's confidence for a Choice, from its probabilities (docs.typesafe.ai/confidence): how far the top option
 * sits above an even split. The gateway returns the probabilities but not this number.
 */
function choiceConfidence(
  probabilities: Record<string, number> | undefined,
  options: number
): number {
  const values = Object.values(probabilities ?? {});
  if (!values.length || options < 2) return 0;
  return Math.max(0, (Math.max(...values) - 1 / options) / (1 - 1 / options));
}

/** Gateway answers in TypeSafe's own shape, so one reader serves both roads: a confidence for each Choice, "noul" for a yes/no. */
export function withConfidence(
  answers: Record<string, unknown>,
  request: ReturnType<typeof jevRequest>
) {
  const read = (id: "answer" | "intent") => {
    const a = answers[id] as
      { type?: string; choice?: unknown; probabilities?: Record<string, number> } | undefined;
    if (!a || a.type !== "choice") return a;
    return {
      ...a,
      confidence: choiceConfidence(
        a.probabilities,
        Object.keys(request.questions[id].criteria).length
      ),
    };
  };
  const yesNo = (id: "oneThing" | "english" | "spanish") => {
    const a = answers[id] as { type?: string; probability?: unknown } | undefined;
    return a?.type === "boolean" ? { type: "noul", noul: a.probability } : a;
  };
  return {
    answers: {
      answer: read("answer"),
      intent: read("intent"),
      oneThing: yesNo("oneThing"),
      clarity: answers.clarity,
      english: yesNo("english"),
      spanish: yesNo("spanish"),
    },
  };
}

/** The request's questions as the AI Gateway names them: its yes/no is "boolean", TypeSafe's own API says "noul". */
function gatewayQuestions(questions: ReturnType<typeof jevRequest>["questions"]) {
  return Object.fromEntries(
    Object.entries(questions).map(([id, q]) => [
      id,
      q.type === "noul" ? { ...q, type: "boolean" } : q,
    ])
  );
}

/** The question as Jev reads it: with the other ways visitors word it, when there are any. */
function withAlsoAsked(question: string, alsoAsked: AlsoAskedType): string {
  const also = alsoAsked[question];
  return also?.length
    ? `${question} Also asked as: ${also.map((a) => `"${a}"`).join(", ")}`
    : question;
}

/** The request body: the visitor's latest message with a few earlier ones, and our questions about it. */
export function jevRequest(
  turns: readonly ChatTurnType[],
  bank: readonly StoredAnswerType[],
  alsoAsked: AlsoAskedType,
  settings: JevSettingsType,
  name: string
) {
  const latest = turns.at(-1)?.text.trim() ?? "";
  const earlier = turns
    .slice(-1 - settings.turns, -1)
    .map((t) => ({ from: t.role === "user" ? "visitor" : "assistant", text: t.text }));
  const criteria: Record<string, string> = Object.fromEntries(
    bank.map((s, i) => [`q${i}`, withAlsoAsked(s.question, alsoAsked)])
  );
  criteria[NONE] =
    "None of these: the message asks something else, or nothing these questions answer";
  const named = (means: string) => means.replaceAll("{name}", name);
  return {
    state: { latest_message: latest, ...(earlier.length && { earlier_messages: earlier }) },
    model: settings.model,
    questions: {
      answer: {
        type: "choice",
        instructions:
          "Which of these questions asks the same thing as the visitor's `latest_message`, read in the context of any `earlier_messages`? Pick none unless one of them would fully answer it.",
        criteria,
      },
      intent: {
        type: "choice",
        instructions:
          "What does the visitor want with their `latest_message`, read in the context of any `earlier_messages`?",
        criteria: Object.fromEntries(
          Object.entries(INTENTS).map(([option, { means }]) => [option, named(means)])
        ),
      },
      ...CHECKS,
      ...LANGUAGE_CHECKS,
    },
  };
}

interface ChoiceAnswerType {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
}

function choiceAnswer(value: unknown): ChoiceAnswerType | null {
  if (!value || typeof value !== "object") return null;
  const { type, choice, confidence, probabilities } = value as Record<string, unknown>;
  if (
    type !== "choice" ||
    typeof choice !== "string" ||
    typeof confidence !== "number" ||
    !Number.isFinite(confidence)
  )
    return null;
  const odds =
    probabilities && typeof probabilities === "object"
      ? (probabilities as Record<string, unknown>)
      : {};
  return {
    choice,
    confidence,
    probabilities: Object.fromEntries(
      Object.entries(odds).filter((e): e is [string, number] => typeof e[1] === "number")
    ),
  };
}

/** A yes/no answer's probability of yes (0 to 1), or `null` when it is not one. */
function noulAnswer(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const { type, noul } = value as Record<string, unknown>;
  return type === "noul" && typeof noul === "number" && noul >= 0 && noul <= 1 ? noul : null;
}

/** A score answer's position on our scale (0 to its last level), or `null` when it is not one. */
function scoreAnswer(value: unknown, levels: number): number | null {
  if (!value || typeof value !== "object") return null;
  const { type, score } = value as Record<string, unknown>;
  return type === "score" && typeof score === "number" && score >= 0 && score <= levels - 1
    ? score
    : null;
}

/** The bank position an option names ("q12"), or -1 for none and anything we never offered. */
function bankIndex(option: string, bank: readonly StoredAnswerType[]): number {
  const match = /^q(\d+)$/.exec(option);
  const index = match ? Number(match[1]) : -1;
  return index >= 0 && index < bank.length ? index : -1;
}

/** The stored questions Jev found likeliest, likeliest first: its pick, then the rest by probability, `count` in all. */
function mostLikely(
  answer: ChoiceAnswerType,
  bank: readonly StoredAnswerType[],
  count: number
): number[] {
  const ranked = Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .map(([option]) => bankIndex(option, bank));
  return [...new Set([bankIndex(answer.choice, bank), ...ranked])]
    .filter((i) => i >= 0)
    .slice(0, count);
}

/**
 * Reads Jev's answers into one outcome. A way to a person, a greeting and off topic (off topic only when none of the
 * stored questions was picked), each only when Jev is sure of what the visitor wants. Too unclear to act on, with a
 * stored question picked: "Did you mean...?" with it and the next likeliest. A message asking two things goes to the
 * AI. Then a sure stored answer; then a fairly sure one, offered as "Did you mean...?"; anything else goes to the AI
 * with Jev's likeliest answers as its head start. On a follow-up or a spoken question (`inWords`) the AI asks or
 * answers in words instead of offering "Did you mean...?" buttons.
 */
export function jevOutcome(
  body: unknown,
  bank: readonly StoredAnswerType[],
  settings: JevSettingsType,
  inWords = false
): JevOutcomeType {
  const answers =
    body && typeof body === "object"
      ? (body as { answers?: Record<string, unknown> }).answers
      : undefined;
  const answer = choiceAnswer(answers?.answer);
  const intent = choiceAnswer(answers?.intent);
  // Only options we offered count: anything else (even an inherited name like "constructor") is malformed.
  const oneThing = noulAnswer(answers?.oneThing);
  const clarity = scoreAnswer(answers?.clarity, CHECKS.clarity.criteria.length);
  if (!answer || !intent || !Object.hasOwn(INTENTS, intent.choice))
    return { kind: "skipped", reason: "malformed" };
  if (oneThing === null || clarity === null) return { kind: "skipped", reason: "malformed" };
  const index = bankIndex(answer.choice, bank);
  if (answer.choice !== NONE && index < 0) return { kind: "skipped", reason: "malformed" };

  const does = INTENTS[intent.choice as IntentType].does;
  if (does && "path" in does && intent.confidence >= settings.personConfidence)
    return { kind: "person", path: does.path, confidence: intent.confidence };
  if (does && "greeting" in does && intent.confidence >= settings.toolConfidence)
    return { kind: "greeting", confidence: intent.confidence };
  // Off topic only when none of the stored questions fits ("I'm in Airdrie" is not off topic beside "Where do you work?").
  if (does && "offTopic" in does && intent.confidence >= settings.toolConfidence && index < 0)
    return { kind: "offTopic", confidence: intent.confidence };
  const toAi = (): JevOutcomeType => ({
    kind: "unsure",
    pick: index >= 0 ? bank[index].question : NONE,
    confidence: answer.confidence,
    likely: mostLikely(answer, bank, LIKELY),
  });
  const suggest = (): JevOutcomeType => ({
    kind: "suggest",
    questions: mostLikely(answer, bank, SUGGESTED).map((i) => bank[i].question),
    confidence: answer.confidence,
  });
  // Too unclear to act on (a misheard word): with a stored question picked, ask whether that is what was meant.
  if (clarity < settings.clarityFloor && index >= 0) return inWords ? toAi() : suggest();
  // Two things in one message: one stored answer would cover half, so the AI answers both.
  if (oneThing < settings.oneThingYes) return toAi();
  if (index >= 0 && answer.confidence >= settings.storedConfidence)
    return {
      kind: "stored",
      question: bank[index].question,
      answer: bank[index].answer,
      confidence: answer.confidence,
    };
  if (index >= 0 && answer.confidence >= settings.suggestConfidence)
    return inWords ? toAi() : suggest();
  return toAi();
}

/** Jev's read of the message's language; a missing or broken answer is left out. */
export function jevLanguage(body: unknown): JevLanguageType {
  const answers =
    body && typeof body === "object"
      ? (body as { answers?: Record<string, unknown> }).answers
      : undefined;
  const english = noulAnswer(answers?.english) ?? undefined;
  const spanish = noulAnswer(answers?.spanish) ?? undefined;
  return { ...(english !== undefined && { english }), ...(spanish !== undefined && { spanish }) };
}

/** What Jev weighed, from the same answers `jevOutcome` reads; nothing when they are malformed. */
export function jevSeen(
  body: unknown,
  bank: readonly StoredAnswerType[],
  options: number
): JevSeenType | undefined {
  const answers =
    body && typeof body === "object"
      ? (body as { answers?: Record<string, unknown> }).answers
      : undefined;
  const answer = choiceAnswer(answers?.answer);
  const intent = choiceAnswer(answers?.intent);
  if (!answer || !intent) return undefined;
  const top = Object.entries(answer.probabilities)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SEEN)
    .map(([option, p]) => {
      const index = bankIndex(option, bank);
      return {
        question: index >= 0 ? bank[index].question : option,
        confidence: choiceConfidence({ [option]: p }, options),
      };
    });
  const oneThing = noulAnswer(answers?.oneThing) ?? undefined;
  const clarity = scoreAnswer(answers?.clarity, CHECKS.clarity.criteria.length) ?? undefined;
  return { intent: intent.choice, intentConfidence: intent.confidence, top, oneThing, clarity };
}

/**
 * Asks Jev about the conversation's latest message. Never throws: a missing key, an error status, a malformed
 * answer or a slow Jev comes back as `skipped`, and the server asks the AI instead.
 */
export async function askJev(
  turns: readonly ChatTurnType[],
  context: JevContextType
): Promise<JevOutcomeType & { seen?: JevSeenType; language?: JevLanguageType }> {
  const settings = context.settings ?? CHAT_SETTINGS.jev;
  const via = context.via ?? (context.apiKey ? "direct" : undefined);
  if (!via || (via === "direct" && !context.apiKey)) return { kind: "skipped", reason: "no-key" };
  if (context.bank.length > MAX_STORED_ANSWERS) return { kind: "skipped", reason: "too-many" };
  if (context.signal?.aborted) return { kind: "skipped", reason: "aborted" };
  // A follow-up (the visitor already got an answer) or a question asked out loud gets words, not buttons.
  const inWords = Boolean(context.spoken) || turns.some((t) => t.role === "assistant");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), settings.timeoutMs);
  const signal = context.signal
    ? AbortSignal.any([context.signal, timeout.signal])
    : timeout.signal;
  const request = jevRequest(turns, context.bank, context.alsoAsked, settings, context.name);
  const options = Object.keys(request.questions.answer.criteria).length;
  const read = (body: unknown) => ({
    ...jevOutcome(body, context.bank, settings, inWords),
    seen: jevSeen(body, context.bank, options),
    language: jevLanguage(body),
  });
  try {
    if (via === "gateway") {
      const result = await (context.evaluateFn ?? (evaluate as unknown as EvaluateFnType))({
        model: settings.gatewayModel,
        state: request.state,
        questions: gatewayQuestions(request.questions),
        abortSignal: signal,
        // A retry would outlast the time limit; the AI is the fallback instead.
        maxRetries: 0,
      });
      return read(withConfidence(result.answers, request));
    }
    const res = await (context.fetchFn ?? fetch)(
      `${context.baseUrl ?? "https://api.typesafe.ai"}/v1/systemone`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${context.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
      }
    );
    if (!res.ok) return { kind: "skipped", reason: "error", status: res.status };
    return read(await res.json());
  } catch {
    if (context.signal?.aborted) return { kind: "skipped", reason: "aborted" };
    if (timeout.signal.aborted) return { kind: "skipped", reason: "timeout" };
    return { kind: "skipped", reason: "error" };
  } finally {
    clearTimeout(timer);
  }
}
