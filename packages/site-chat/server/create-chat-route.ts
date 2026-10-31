import { openai } from "@ai-sdk/openai";
import { streamText, type LanguageModel } from "ai";
import { z } from "zod";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { ChatEventType, ChatTraceType, JevTraceType } from "../agent/chat-event-type.js";
import { finishedSentences } from "../agent/sentences.js";
import { chatAnswersProblems } from "../answers/chat-answers-problems.js";
import type { StoredAnswerType } from "../answers/chat-answers-type.js";
import type { ChatLanguageType, ChatWordsType } from "../words/chat-words-type.js";
import { createAnswerMarkerFilter, withoutMarks } from "./answer-marker.js";
import { buildChatBrief, type ChatBriefType } from "./chat-brief.js";
import type { ChatSiteType } from "./chat-site-type.js";
import { namesOtherDetail } from "./detail-words.js";
import { fromOurSite } from "./from-our-site.js";
import { createHourlyLimit, requestAddress } from "./hourly-limit.js";
import { askJev, type AlsoAskedType, type JevOutcomeType, type JevSeenType } from "./jev.js";
import { createPersonMarkerFilter } from "./person-marker.js";
import { replyLanguage } from "./reply-language.js";
import { listedVoice, synthesize } from "./voice.js";

const settings = CHAT_SETTINGS;

export interface ChatRouteOptionsType {
  /** One per language the site speaks; the first is the site's own. */
  sites: readonly ChatSiteType[];
  /** Laptop only: each answer carries how it was reached (Jev's pick, the AI's tokens), never the visitor's words. */
  debug?: boolean;
  /** Stand-ins for tests: Jev's `fetch`, and the AI's model. */
  fetchFn?: typeof fetch;
  model?: () => LanguageModel;
}

/** Everything one language answers from, built once per server instance. */
interface BuiltSiteType {
  words: ChatWordsType;
  bank: readonly StoredAnswerType[];
  alsoAsked: AlsoAskedType;
  detailWords: readonly string[];
  name: string;
  brief: ChatBriefType;
}

/** Where the server sends one typed question before the AI, and how it got there. */
type RoutedType =
  /** Answered without the AI: a fixed line, a way to a person, or "Did you mean...?". */
  | { kind: "answered"; event: ChatEventType }
  /** The AI answers, starting from these stored answers. */
  | { kind: "ai"; likely: number[] };

const encoder = new TextEncoder();
const line = (event: ChatEventType) => encoder.encode(`${JSON.stringify(event)}\n`);
const NDJSON = {
  "Content-Type": "application/x-ndjson; charset=utf-8",
  "Cache-Control": "no-store",
};

/** A response that is a single event, for answers decided before the model is asked. */
function single(event: ChatEventType, status = 200): Response {
  return new Response(line(event), { status, headers: NDJSON });
}

/** A finished answer of a few events, decided without the AI. */
function events(parts: (Uint8Array | null)[]): Response {
  const kept = parts.filter((part): part is Uint8Array => part !== null);
  const whole = new Uint8Array(kept.reduce((sum, part) => sum + part.length, 0));
  kept.reduce((at, part) => (whole.set(part, at), at + part.length), 0);
  return new Response(whole, { headers: NDJSON });
}

/**
 * Which road reaches Jev: TypeSafe's own API whenever `TYPESAFE_API_KEY` is set (with `TYPESAFE_BASE_URL` for a
 * stand-in); otherwise Vercel's AI Gateway when it can sign the request; with neither, Jev is skipped.
 */
function jevRoad(): "gateway" | "direct" | undefined {
  if (process.env.TYPESAFE_API_KEY) return "direct";
  if (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN) return "gateway";
  return undefined;
}

/** What Jev decided, for the inspector: never the visitor's words. */
function jevTrace(
  jev: JevOutcomeType & { seen?: JevSeenType },
  ms: number,
  bank: readonly StoredAnswerType[]
): JevTraceType {
  const seen = jev.seen && { seen: jev.seen };
  switch (jev.kind) {
    case "person":
      return { kind: jev.kind, path: jev.path, confidence: jev.confidence, ms, ...seen };
    case "greeting":
    case "offTopic":
      return { kind: jev.kind, confidence: jev.confidence, ms, ...seen };
    case "stored":
      return { kind: jev.kind, pick: jev.question, confidence: jev.confidence, ms, ...seen };
    case "suggest":
      return { kind: jev.kind, questions: jev.questions, confidence: jev.confidence, ms, ...seen };
    case "unsure":
      return {
        kind: jev.kind,
        pick: jev.pick,
        confidence: jev.confidence,
        questions: jev.likely.map((i) => bank[i].question),
        ms,
        ...seen,
      };
    case "skipped":
      return { kind: jev.kind, reason: jev.reason, status: jev.status, ms };
  }
}

/** The same stored question in another language's bank: the banks keep one order, so a pick is the same place in either. */
function sameQuestionIn(
  question: string,
  from: readonly StoredAnswerType[],
  to: readonly StoredAnswerType[]
) {
  const at = from.findIndex((s) => s.question === question);
  return at >= 0 && to.length === from.length ? to[at] : null;
}

/**
 * How long to wait before the second try: the provider's own "retry-after-ms" (or "retry-after", in seconds) when a
 * rate limit refused the first, within `retryAfterMs` and `maxRetryWaitMs`; otherwise `retryAfterMs`.
 */
function retryWait(error: unknown): number {
  const headers = (error as { responseHeaders?: Record<string, string> } | undefined)
    ?.responseHeaders;
  const ms = Number(headers?.["retry-after-ms"] ?? Number(headers?.["retry-after"]) * 1000);
  const asked = Number.isFinite(ms) && ms > 0 ? ms : settings.retryAfterMs;
  return Math.min(Math.max(asked, settings.retryAfterMs), settings.maxRetryWaitMs);
}

/**
 * The POST handler for the chat's questions. Checks the request, asks Jev first and answers in the site's own words
 * when it is sure; otherwise asks the AI with the site's brief and streams the answer back as newline-separated
 * JSON events, spoken sentence by sentence when the visitor asked out loud. Never stores or logs what a visitor
 * wrote: the log keeps only counts and outcomes, and the provider's own error text never reaches the browser.
 */
export function createChatRoute(options: ChatRouteOptionsType) {
  if (!options.sites.length) throw new Error("site-chat: createChatRoute needs at least one site");
  const built = new Map<ChatLanguageType, BuiltSiteType>();
  for (const site of options.sites) {
    const problems = chatAnswersProblems(site.answers);
    if (problems.length)
      throw new Error(`site-chat: the ${site.lang} answers are not usable: ${problems.join("; ")}`);
    built.set(site.lang, {
      words: site.words,
      bank: site.answers.stored,
      alsoAsked: site.answers.alsoAsked ?? {},
      detailWords: site.detailWords ?? [],
      name: site.brief.business.name,
      brief: buildChatBrief(site.brief, site.answers, site.briefWords),
    });
  }
  const languages = options.sites.map((site) => site.lang) as [
    ChatLanguageType,
    ...ChatLanguageType[],
  ];
  const siteOf = (lang: ChatLanguageType) => built.get(lang)!;

  const requestSchema = z
    .object({
      lang: z.enum(languages).default(languages[0]),
      replyLang: z.enum(languages).optional(),
      aiSpent: z.boolean().optional(),
      messages: z
        .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() }))
        .min(1)
        .max(settings.maxTurns),
      spoken: z.boolean().optional(),
      voice: z.string().max(40).optional(),
    })
    .refine(
      (body) => body.messages.at(-1)?.role === "user",
      "The last message must be the visitor's"
    )
    .refine((body) =>
      body.messages.every((m) =>
        m.role === "user"
          ? m.text.trim().length > 0 && m.text.trim().length <= settings.maxQuestionChars
          : m.text.length <= settings.maxAnswerChars
      )
    );
  type BodyType = z.infer<typeof requestSchema>;

  const overLimit = createHourlyLimit(settings.requestsPerHour);
  const model = options.model ?? (() => openai(settings.model));
  const hasKey = () => Boolean(options.model || process.env.OPENAI_API_KEY);

  /**
   * The ladder before the AI: Jev first. Sure of a way to a person, a greeting, off topic or one stored answer, it
   * answers at once in the site's words; fairly sure, it asks "Did you mean...?"; otherwise the AI answers, starting
   * from Jev's likeliest answers. When Jev cannot run, the AI answers from its brief.
   */
  async function route(body: BodyType, signal: AbortSignal) {
    const started = performance.now();
    const site = siteOf(body.lang);
    const jev = await askJev(body.messages, {
      bank: site.bank,
      alsoAsked: site.alsoAsked,
      name: site.name,
      via: jevRoad(),
      apiKey: process.env.TYPESAFE_API_KEY,
      baseUrl: process.env.TYPESAFE_BASE_URL || undefined,
      spoken: body.spoken,
      signal,
      fetchFn: options.fetchFn,
    });
    const ms = Math.round(performance.now() - started);
    console.info(
      `chat: jev ${jev.kind}${jev.kind === "skipped" ? ` (${jev.reason}${jev.status ? ` ${jev.status}` : ""})` : ""} in ${ms} ms`
    );
    // Jev's read of the message's language, else the chat's last; a language the site does not speak keeps its own.
    const asked = replyLanguage({
      site: body.lang,
      replyLang: body.replyLang,
      ...jev.language,
      yes: settings.jev.languageYes,
    });
    const reply = built.has(asked) ? asked : body.lang;
    const trace: ChatTraceType = {
      jev: jevTrace(jev, ms, site.bank),
      language: { ...jev.language, reply },
    };
    const out = siteOf(reply);
    const inReply = (question: string) => sameQuestionIn(question, site.bank, out.bank);
    const answered = (
      event: ChatEventType
    ): { routed: RoutedType; trace: ChatTraceType; reply: ChatLanguageType } => ({
      routed: { kind: "answered", event },
      trace,
      reply,
    });
    const toAi = (likely: number[]) => ({
      routed: { kind: "ai", likely } as RoutedType,
      trace,
      reply,
    });
    // A question naming one of the site's services or groups is the AI's unless Jev's pick names it too, in its own
    // words or the other ways visitors word it; the AI starts from Jev's picks, so a stored answer that does fit
    // still goes out in the site's words.
    const latest = body.messages.at(-1)!.text;
    const picked =
      jev.kind === "stored" ? [jev.question] : jev.kind === "suggest" ? jev.questions : null;
    if (picked) {
      const wordings = picked.flatMap((q) => [q, ...(site.alsoAsked[q] ?? [])]);
      if (namesOtherDetail(latest, wordings, site.detailWords))
        return toAi(
          picked.map((q) => site.bank.findIndex((s) => s.question === q)).filter((i) => i >= 0)
        );
    }
    switch (jev.kind) {
      case "person":
        return answered({ type: "person", path: jev.path });
      case "greeting":
        return answered({ type: "fixed", text: out.words.greeting });
      case "offTopic":
        return answered({ type: "fixed", text: out.words.offTopic });
      case "stored": {
        const stored = inReply(jev.question);
        if (!stored) return toAi([]);
        return answered({
          type: "stored",
          text: stored.answer,
          question: stored.question,
          ...(stored.offersPerson && { ways: true as const }),
        });
      }
      case "suggest":
        return answered({
          type: "suggest",
          questions: jev.questions.flatMap((q) => inReply(q)?.question ?? []),
        });
      case "unsure":
        return toAi(jev.likely);
      case "skipped":
        return toAi([]);
    }
  }

  return async function POST(request: Request): Promise<Response> {
    if (!fromOurSite(request)) return single({ type: "error", code: "invalid" }, 403);
    let body: BodyType;
    try {
      const parsed = requestSchema.safeParse(await request.json());
      if (!parsed.success) return single({ type: "error", code: "invalid" }, 400);
      body = parsed.data;
    } catch {
      return single({ type: "error", code: "invalid" }, 400);
    }

    // Limit and unavailable are expected answers the chat handles, so they travel in the stream with a 200, not
    // as failed requests the browser reports as errors.
    if (overLimit(requestAddress(request.headers)))
      return single({
        type: "error",
        code: "limit",
        ...(body.replyLang && { lang: body.replyLang }),
      });

    const received = performance.now();
    const { routed, trace, reply } = await route(body, request.signal);
    const out = siteOf(reply);
    const traced = Boolean(options.debug);
    const traceLine = traced ? line({ type: "trace", trace }) : null;
    if (routed.kind === "answered")
      return events([traceLine, line(routed.event), line({ type: "done", lang: reply })]);
    // The visit's AI limit stops only the AI: everything above still answered.
    if (body.aiSpent)
      return events([traceLine, line({ type: "error", code: "limit", lang: reply })]);
    if (!hasKey()) {
      console.error("chat: no OPENAI_API_KEY");
      return events([traceLine, line({ type: "error", code: "unavailable", lang: reply })]);
    }

    const { likely } = routed;
    /**
     * One try at the AI's answer. The provider's own retries wait seconds between tries, so they are off: the
     * stream below tries once more at once instead.
     */
    const askModel = (signal: AbortSignal) =>
      streamText({
        model: model(),
        // The fixed brief first, so the provider keeps it ready; Jev's head start, which changes, last.
        instructions: [
          body.spoken ? out.brief.spoken : out.brief.typed,
          out.brief.headStart(likely),
        ]
          .filter(Boolean)
          .join("\n\n"),
        // Our own marks are taken out of what the visitor and the history say, so only the AI can write one.
        messages: body.messages.map((m) => ({ role: m.role, content: withoutMarks(m.text) })),
        maxOutputTokens: settings.maxAnswerTokens,
        maxRetries: 0,
        // A chat, not a puzzle: no thinking pause before the first words.
        providerOptions: { openai: { reasoningEffort: "none", textVerbosity: "low" } },
        abortSignal: signal,
        // The error name and the provider status only: the provider text can carry what the visitor wrote.
        onError: ({ error }) =>
          console.error(
            "chat: model error",
            error instanceof Error ? error.name : "unknown",
            (error as { statusCode?: number }).statusCode ?? ""
          ),
      });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (chunk: Uint8Array) => controller.enqueue(chunk);
        if (traceLine) send(traceLine);
        let failed = false;
        let firstWordMs: number | undefined;
        // A spoken answer: each sentence goes to Google as soon as it is written, and its sound follows in the
        // stream in order, so the chat plays the first sentence while the next are made. A sentence Google cannot
        // speak arrives without sound, and the browser's voice says it.
        let unspoken = "";
        let spokenChars = 0;
        let speaking = Promise.resolve();
        // The AI's "this stored answer" mark and its "a person should take this" mark are taken out before
        // anything is shown or spoken.
        let picked = createAnswerMarkerFilter();
        let marker = createPersonMarkerFilter();
        const speak = (sentence: string) => {
          if (spokenChars >= settings.voice.maxSpokenChars) return;
          spokenChars += sentence.length;
          const sound = synthesize(sentence, listedVoice(body.voice), reply, request.signal);
          speaking = speaking.then(async () => {
            const audio = await sound;
            if (request.signal.aborted) return; // the visitor left: the stream is already closed
            send(line({ type: "speak", text: sentence, lang: reply, ...(audio && { audio }) }));
          });
        };
        const show = (text: string) => {
          const shown = marker.push(text);
          if (!shown) return;
          send(line({ type: "text", delta: shown }));
          if (body.spoken) {
            const { sentences, rest } = finishedSentences(unspoken + shown);
            unspoken = rest;
            sentences.forEach(speak);
          }
        };
        try {
          // Two tries at most: a try that fails, or writes nothing within `firstWordMs`, before any word reached the
          // visitor is tried again at once; once words are out, a failure hands over to a person.
          let result: ReturnType<typeof askModel>;
          for (let attempt = 1; ; attempt++) {
            const giveUp = new AbortController();
            result = askModel(AbortSignal.any([request.signal, giveUp.signal]));
            const timer = setTimeout(() => giveUp.abort(), settings.firstWordMs);
            let wrote = false;
            let refused: unknown;
            failed = false;
            try {
              for await (const part of result.stream) {
                if (part.type === "text-delta" && part.text) {
                  clearTimeout(timer);
                  wrote = true;
                  firstWordMs ??= Math.round(performance.now() - received);
                  show(picked.push(part.text));
                } else if (part.type === "error") {
                  failed = true;
                  refused = part.error;
                }
              }
            } catch (error) {
              if (request.signal.aborted) throw new Error("aborted");
              failed = true;
              refused = error;
            } finally {
              clearTimeout(timer);
            }
            // Cut off before its first word: as good as failed.
            if (giveUp.signal.aborted && !wrote) failed = true;
            if (!failed || wrote || attempt === 2) break;
            console.info("chat: model retry");
            // A pause first: refused for a moment (the provider's tokens-a-minute limit), it says how long to wait.
            await new Promise((wait) => setTimeout(wait, retryWait(refused)));
            picked = createAnswerMarkerFilter();
            marker = createPersonMarkerFilter();
          }
          if (!failed) show(picked.end());
          const number = picked.picked();
          const stored = number === null ? undefined : out.bank[number];
          if (!failed && stored) {
            // The AI picked one of the stored answers: it goes out in the site's exact words, as a fixed line.
            if (traced) send(line({ type: "trace", trace: { llmPicked: stored.question } }));
            send(
              line({
                type: "stored",
                text: stored.answer,
                question: stored.question,
                ...(stored.offersPerson && { ways: true as const }),
              })
            );
            send(line({ type: "done", lang: reply }));
          } else if (failed || number !== null) {
            // A failed stream, or a mark naming no stored answer: the chat hands over to a person.
            send(line({ type: "error", code: "unavailable", lang: reply }));
          } else {
            // A mark written where the full stop goes leaves the answer without one: it is put back.
            const close = marker.end();
            if (close) {
              send(line({ type: "text", delta: close }));
              if (unspoken.trim()) unspoken += close;
            }
            if (unspoken.trim()) speak(unspoken.trim());
            await speaking;
            // Only an answer the AI marked as needing a person offers the ways to one.
            if (marker.marked()) send(line({ type: "ways" }));
            send(line({ type: "done", lang: reply }));
          }
          if (!failed) {
            const usage = await result.usage;
            if (traced) {
              const ai = {
                model: settings.model,
                spoken: Boolean(body.spoken),
                firstWordMs,
                totalMs: Math.round(performance.now() - received),
                inputTokens: usage.inputTokens ?? 0,
                cachedTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
              };
              send(line({ type: "trace", trace: { ai } }));
            }
            console.info(
              `chat: ai${stored ? " (picked a stored answer)" : ""}, ${usage.inputTokens ?? 0} in (${usage.inputTokenDetails?.cacheReadTokens ?? 0} cached), ${usage.outputTokens ?? 0} out`
            );
          }
        } catch {
          if (!request.signal.aborted)
            send(line({ type: "error", code: "unavailable", lang: reply }));
        } finally {
          // A sentence still being made must not write into a closed stream.
          await speaking.catch(() => {});
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: NDJSON });
  };
}
