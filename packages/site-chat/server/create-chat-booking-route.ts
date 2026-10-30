import { openai } from "@ai-sdk/openai";
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import type { BookingAskAnswerType } from "../booking/booking-understood-type.js";
import { withoutMarks } from "./answer-marker.js";
import { bookingInstructionsFor } from "./booking-instructions.js";
import { fromOurSite } from "./from-our-site.js";
import { createHourlyLimit, requestAddress } from "./hourly-limit.js";

const settings = CHAT_SETTINGS;

export interface ChatBookingRouteOptionsType {
  /** Laptop only: each answer carries the AI's tokens and time, never the visitor's words. */
  debug?: boolean;
  /** A stand-in for tests: the AI's model. */
  model?: () => LanguageModel;
}

const text = (most: number) => z.string().max(most);

const requestSchema = z.object({
  lang: z.enum(["en", "es"]),
  business: text(120),
  service: text(120).nullable(),
  services: z.array(text(120)).max(20),
  today: text(60),
  todayIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day: text(60),
  times: z.array(text(24)).max(12),
  picked: text(24).nullable(),
  fields: z
    .array(
      z.object({
        key: z
          .string()
          .regex(/^(name|email|phone|contact|address|details|answer:[A-Za-z0-9_-]{1,64})$/),
        label: text(200),
        required: z.boolean(),
        value: text(2000).nullable(),
      })
    )
    .max(30),
  asking: text(80),
  aiSpent: z.boolean().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: text(settings.maxAnswerChars) }))
    .min(1)
    .max(settings.maxTurns)
    .refine(
      (list) =>
        list.at(-1)?.role === "user" &&
        list.at(-1)!.text.trim().length > 0 &&
        list.at(-1)!.text.trim().length <= settings.maxQuestionChars,
      "The last message must be the visitor's"
    ),
});

/** What the AI understood. Every field is always there (null, false or empty when not said), as strict output wants. */
const understoodSchema = z.object({
  service: z.number().int().nullable(),
  time: z.number().int().nullable(),
  day: z.string().nullable(),
  part: z.enum(["morning", "afternoon", "evening"]).nullable(),
  name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  details: z.string().nullable(),
  answers: z.array(z.object({ id: z.string(), answer: z.string() })),
  skip: z.boolean(),
  book: z.boolean(),
  cancel: z.boolean(),
  other: z.boolean(),
  reply: z.string(),
});

const json = (body: BookingAskAnswerType, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The POST handler for the booking AI: while a visitor books in the chat, each typed or spoken reply comes here with
 * the booking so far and the business's form, and the AI says what it understood, as fields: a listed time, another
 * day, a name, an email, an address, a yes to the read-back. The chat checks each field before using it and books
 * only on a yes to its own read-back. Nothing here books, and the visitor's words are never logged.
 */
export function createChatBookingRoute(options: ChatBookingRouteOptionsType = {}) {
  const overLimit = createHourlyLimit(settings.requestsPerHour);
  const model = options.model ?? (() => openai(settings.model));
  const hasKey = () => Boolean(options.model || process.env.OPENAI_API_KEY);

  return async function POST(request: Request): Promise<Response> {
    if (!fromOurSite(request)) return json({ error: "invalid" }, 403);
    let body: z.infer<typeof requestSchema>;
    try {
      const parsed = requestSchema.safeParse(await request.json());
      if (!parsed.success) return json({ error: "invalid" }, 400);
      body = parsed.data;
    } catch {
      return json({ error: "invalid" }, 400);
    }
    // Expected answers the chat handles with its word lists, so they come with a 200.
    if (overLimit(requestAddress(request.headers)) || body.aiSpent) return json({ error: "limit" });
    if (!hasKey()) {
      console.error("chat: booking, no OPENAI_API_KEY");
      return json({ error: "unavailable" });
    }

    const started = performance.now();
    try {
      const result = await generateText({
        model: model(),
        instructions: bookingInstructionsFor(body),
        // Our own marks are taken out of what the visitor and the history say.
        messages: body.messages.map((m) => ({ role: m.role, content: withoutMarks(m.text) })),
        output: Output.object({ schema: understoodSchema }),
        maxOutputTokens: 800,
        maxRetries: 1,
        // Fields from one reply, not a puzzle: no thinking pause.
        providerOptions: { openai: { reasoningEffort: "none", textVerbosity: "low" } },
        abortSignal: request.signal,
      });
      const totalMs = Math.round(performance.now() - started);
      const { usage } = result;
      console.info(
        `chat: booking, ${usage.inputTokens ?? 0} in (${usage.inputTokenDetails?.cacheReadTokens ?? 0} cached), ${usage.outputTokens ?? 0} out, ${totalMs} ms`
      );
      return json({
        understood: result.output,
        ...(options.debug && {
          trace: {
            ai: {
              model: settings.model,
              spoken: false,
              totalMs,
              inputTokens: usage.inputTokens ?? 0,
              cachedTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
            },
          },
        }),
      });
    } catch (error) {
      // The error name and the provider status only: the provider text can carry what the visitor wrote.
      console.error(
        "chat: booking model error",
        error instanceof Error ? error.name : "unknown",
        (error as { statusCode?: number }).statusCode ?? ""
      );
      return json({ error: "unavailable" });
    }
  };
}
