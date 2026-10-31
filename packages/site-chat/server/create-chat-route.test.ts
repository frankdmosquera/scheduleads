import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatEventType } from "../agent/chat-event-type.js";
import { jevFetch, type JevStandInType } from "../jev-stand-in.js";
import { testSite } from "../test-site.js";
import { createChatRoute } from "./create-chat-route.js";

const SITE = "https://primopainters.ca";

function ask(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${SITE}/api/chat`, {
    method: "POST",
    headers: {
      host: "primopainters.ca",
      origin: SITE,
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const question = (text: string) => ({ lang: "en", messages: [{ role: "user", text }] });

async function eventsOf(response: Response): Promise<ChatEventType[]> {
  return (await response.text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ChatEventType);
}

/** The AI, stood in: it writes these pieces, one after another. */
function writes(...deltas: string[]) {
  return () =>
    new MockLanguageModelV4({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "t" },
            ...deltas.map((delta) => ({ type: "text-delta" as const, id: "t", delta })),
            { type: "text-end" as const, id: "t" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: undefined },
              usage: {
                inputTokens: { total: 1200, noCache: 200, cacheRead: 1000, cacheWrite: 0 },
                outputTokens: { total: 20, text: 20, reasoning: 0 },
              },
            },
          ],
        }),
      }),
    });
}

function route(jev: JevStandInType = {}, model = writes("Hello.")) {
  return createChatRoute({ sites: [testSite], fetchFn: jevFetch(jev).fetchFn, model });
}

// The tests never reach a real service: Jev and the AI are stood in, and no real key is in reach.
const keys = [
  "TYPESAFE_API_KEY",
  "TYPESAFE_BASE_URL",
  "OPENAI_API_KEY",
  "GOOGLE_TTS_API_KEY",
  "AI_GATEWAY_API_KEY",
];
const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const key of keys) delete process.env[key];
  process.env.TYPESAFE_API_KEY = "stand-in";
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const key of keys)
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
});

describe("createChatRoute refuses", () => {
  it("a request that is not JSON, before reading it", async () => {
    const res = await route()(ask("hello", { "content-type": "text/plain" }));
    expect(res.status).toBe(403);
    expect(await eventsOf(res)).toEqual([{ type: "error", code: "invalid" }]);
  });

  it("a request from another site, by its Origin or the browser's own word", async () => {
    expect(
      (await route()(ask(question("hi"), { origin: "https://elsewhere.example" }))).status
    ).toBe(403);
    expect((await route()(ask(question("hi"), { "sec-fetch-site": "cross-site" }))).status).toBe(
      403
    );
  });

  it("a body that breaks the rules: no visitor message last, an empty or overlong question, a language it does not speak", async () => {
    const chat = route();
    const bad = [
      "not json",
      { lang: "en", messages: [{ role: "assistant", text: "Hello" }] },
      question("   "),
      question("x".repeat(501)),
      { ...question("hola"), lang: "es" },
    ];
    for (const body of bad)
      expect((await chat(ask(body))).status, JSON.stringify(body).slice(0, 40)).toBe(400);
  });

  it("an address over its hourly limit, as an answer the chat shows", async () => {
    const chat = route({ pick: "q1" });
    for (let i = 0; i < 60; i++)
      await chat(ask(question("how long?"), { "x-forwarded-for": "203.0.113.9" }));
    expect(
      await eventsOf(await chat(ask(question("how long?"), { "x-forwarded-for": "203.0.113.9" })))
    ).toEqual([{ type: "error", code: "limit" }]);
  });

  it("to build at all when a site's answers name a question that is not stored", () => {
    const answers = { ...testSite.answers, alsoAsked: { "Renamed?": ["x"] } };
    expect(() => createChatRoute({ sites: [{ ...testSite, answers }] })).toThrow(/Renamed\?/);
  });
});

describe("createChatRoute answers", () => {
  it("with Jev's sure pick, in the site's words, and no AI", async () => {
    const model = vi.fn(writes("never"));
    const events = await eventsOf(
      await route({ pick: "q1" }, model)(ask(question("how long does it take")))
    );
    expect(events).toEqual([
      {
        type: "stored",
        text: "Most take one to five days.",
        question: "How long does a project take?",
      },
      { type: "done", lang: "en" },
    ]);
    expect(model).not.toHaveBeenCalled();
  });

  it("in the site's words when the question names a service one of the pick's other wordings names", async () => {
    const model = vi.fn(writes("never"));
    const handler = createChatRoute({
      sites: [
        {
          ...testSite,
          detailWords: ["Ceiling Painting"],
          answers: {
            ...testSite.answers,
            alsoAsked: { "How long does a project take?": ["how long does ceiling painting take"] },
          },
        },
      ],
      fetchFn: jevFetch({ pick: "q1" }).fetchFn,
      model,
    });
    const events = await eventsOf(
      await handler(ask(question("how long does ceiling painting take")))
    );
    expect(events[0]).toMatchObject({ type: "stored", question: "How long does a project take?" });
    expect(model).not.toHaveBeenCalled();
  });

  it("from the AI when the question names a service Jev's pick does not", async () => {
    const model = vi.fn(writes("Ceilings take a day."));
    const handler = createChatRoute({
      sites: [{ ...testSite, detailWords: ["Ceiling Painting"] }],
      fetchFn: jevFetch({ pick: "q1" }).fetchFn,
      model,
    });
    const events = await eventsOf(
      await handler(ask(question("how long does ceiling painting take")))
    );
    expect(events.some((e) => e.type === "stored")).toBe(false);
    expect(model).toHaveBeenCalled();
  });

  it("with every way to a person under an answer that is itself the way", async () => {
    const events = await eventsOf(
      await route({ pick: "q2" })(ask(question("can I talk to a human")))
    );
    expect(events[0]).toMatchObject({ type: "stored", ways: true });
  });

  it("with the way to a person the visitor asked for, a greeting, or 'Did you mean'", async () => {
    expect(
      (
        await eventsOf(
          await route({ pick: "none", intent: "book" })(
            ask(question("can someone come see my kitchen"))
          )
        )
      )[0]
    ).toEqual({
      type: "person",
      path: "book",
    });
    expect(
      (await eventsOf(await route({ pick: "none", intent: "greeting" })(ask(question("hi")))))[0]
    ).toEqual({
      type: "fixed",
      text: testSite.words.greeting,
    });
    expect(
      (await eventsOf(await route({ pickConfidence: 0.6 })(ask(question("waht do u paint")))))[0]
    ).toEqual({
      type: "suggest",
      questions: ["What services do you offer?", "How long does a project take?"],
    });
  });

  it("with the AI's own words when Jev is unsure, the person mark taken out and the ways offered", async () => {
    const events = await eventsOf(
      await route(
        { pick: "none", pickConfidence: 0.1 },
        writes("Someone from Test Painters can confirm that. [[per", "son]]")
      )(ask(question("do you paint fences?")))
    );
    const text = events.flatMap((e) => (e.type === "text" ? [e.delta] : [])).join("");
    expect(text).toBe("Someone from Test Painters can confirm that.");
    expect(events.slice(-2)).toEqual([{ type: "ways" }, { type: "done", lang: "en" }]);
  });

  it("with a stored answer in the site's exact words when the AI marks one", async () => {
    const events = await eventsOf(
      await route(
        { pick: "none", pickConfidence: 0.1 },
        writes("[[answer:", "1]]")
      )(ask(question("timeline?")))
    );
    expect(events).toEqual([
      {
        type: "stored",
        text: "Most take one to five days.",
        question: "How long does a project take?",
      },
      { type: "done", lang: "en" },
    ]);
  });

  it("with the hand-over when the visit's AI answers are spent, or there is no OpenAI key", async () => {
    const spent = await eventsOf(
      await route({ pick: "none", pickConfidence: 0.1 })(
        ask({ ...question("fences?"), aiSpent: true })
      )
    );
    expect(spent).toEqual([{ type: "error", code: "limit", lang: "en" }]);
    const noKey = createChatRoute({
      sites: [testSite],
      fetchFn: jevFetch({ pick: "none", pickConfidence: 0.1 }).fetchFn,
    });
    expect(await eventsOf(await noKey(ask(question("fences?"))))).toEqual([
      { type: "error", code: "unavailable", lang: "en" },
    ]);
  });

  it("with how it got there only when debugging, never the visitor's words", async () => {
    const chat = createChatRoute({
      sites: [testSite],
      fetchFn: jevFetch({ pick: "q1" }).fetchFn,
      debug: true,
    });
    const [trace] = await eventsOf(await chat(ask(question("how long does my kitchen take"))));
    expect(trace).toMatchObject({
      type: "trace",
      trace: { jev: { kind: "stored", pick: "How long does a project take?" } },
    });
    expect(JSON.stringify(trace)).not.toContain("kitchen");
  });
});
