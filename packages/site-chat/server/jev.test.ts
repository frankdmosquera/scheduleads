import { describe, expect, it } from "vitest";

import { CHAT_SETTINGS } from "../agent/chat-settings.js";
import { jevAnswers, jevFetch } from "../jev-stand-in.js";
import { testAnswers } from "../test-site.js";
import { askJev, jevOutcome, jevRequest } from "./jev.js";

const bank = testAnswers.stored;
const settings = CHAT_SETTINGS.jev;
const visitor = (text: string) => [{ role: "user" as const, text }];

describe("jevRequest", () => {
  const request = jevRequest(
    visitor("do you paint cabinets?"),
    bank,
    testAnswers.alsoAsked ?? {},
    settings,
    "Test Painters"
  );

  it("offers every stored question by its place, with its other wordings, and none", () => {
    expect(request.questions.answer.criteria).toEqual({
      q0: 'What services do you offer? Also asked as: "What do you paint?"',
      q1: "How long does a project take?",
      q2: "Can I talk to someone?",
      none: expect.stringContaining("None of these"),
    });
  });

  it("names the business in what the visitor may want, and asks with jev-latest", () => {
    expect(request.model).toBe("jev-latest");
    expect(request.questions.intent.criteria.call).toBe(
      "Wants to phone Test Painters, or wants someone at Test Painters to phone them"
    );
    expect(Object.keys(request.questions.intent.criteria)).toEqual([
      "question",
      "book",
      "call",
      "message",
      "greeting",
      "off_topic",
      "other",
    ]);
  });

  it("sends the latest message with the few before it, as visitor and assistant", () => {
    const turns = [
      { role: "user" as const, text: "hi" },
      { role: "assistant" as const, text: "Hello!" },
      { role: "user" as const, text: "how long?" },
    ];
    const { state } = jevRequest(turns, bank, {}, settings, "Test Painters");
    expect(state).toEqual({
      latest_message: "how long?",
      earlier_messages: [
        { from: "visitor", text: "hi" },
        { from: "assistant", text: "Hello!" },
      ],
    });
  });
});

describe("jevOutcome", () => {
  it("answers a sure pick with the stored answer, in the site's own words", () => {
    expect(
      jevOutcome(jevAnswers({ pick: "q1", pickConfidence: 0.8 }), bank, settings)
    ).toMatchObject({
      kind: "stored",
      question: "How long does a project take?",
      answer: "Most take one to five days.",
    });
  });

  it("asks 'Did you mean' when fairly sure, but in words on a follow-up or a spoken question", () => {
    expect(jevOutcome(jevAnswers({ pickConfidence: 0.6 }), bank, settings).kind).toBe("suggest");
    expect(jevOutcome(jevAnswers({ pickConfidence: 0.6 }), bank, settings, true).kind).toBe(
      "unsure"
    );
  });

  it("offers the way to a person the visitor asked for", () => {
    expect(
      jevOutcome(
        jevAnswers({ pick: "none", intent: "book", intentConfidence: 0.6 }),
        bank,
        settings
      )
    ).toMatchObject({
      kind: "person",
      path: "book",
    });
  });

  it("answers a hello, and off topic only when no stored question fits", () => {
    expect(jevOutcome(jevAnswers({ pick: "none", intent: "greeting" }), bank, settings).kind).toBe(
      "greeting"
    );
    expect(jevOutcome(jevAnswers({ pick: "none", intent: "off_topic" }), bank, settings).kind).toBe(
      "offTopic"
    );
    expect(jevOutcome(jevAnswers({ pick: "q0", intent: "off_topic" }), bank, settings).kind).toBe(
      "stored"
    );
  });

  it("sends two questions in one message, and a garbled one with no pick, to the AI with a head start", () => {
    expect(jevOutcome(jevAnswers({ oneThing: 0.05 }), bank, settings)).toMatchObject({
      kind: "unsure",
      likely: [0, 1],
    });
    expect(jevOutcome(jevAnswers({ clarity: 0 }), bank, settings).kind).toBe("suggest");
    expect(jevOutcome(jevAnswers({ pick: "none", clarity: 0 }), bank, settings).kind).toBe(
      "unsure"
    );
  });

  it("treats any option it never offered as malformed", () => {
    expect(jevOutcome(jevAnswers({ pick: "q9" }), bank, settings)).toEqual({
      kind: "skipped",
      reason: "malformed",
    });
    expect(jevOutcome(jevAnswers({ intent: "constructor" }), bank, settings)).toEqual({
      kind: "skipped",
      reason: "malformed",
    });
    expect(jevOutcome({ answers: {} }, bank, settings)).toEqual({
      kind: "skipped",
      reason: "malformed",
    });
  });
});

describe("askJev", () => {
  const context = { bank, alsoAsked: {}, name: "Test Painters" };

  it("is skipped without a key, and never throws on a refusal", async () => {
    expect(await askJev(visitor("hi"), context)).toEqual({ kind: "skipped", reason: "no-key" });
    const { fetchFn } = jevFetch(() => new Response("no", { status: 503 }));
    expect(await askJev(visitor("hi"), { ...context, apiKey: "key", fetchFn })).toEqual({
      kind: "skipped",
      reason: "error",
      status: 503,
    });
  });

  it("calls TypeSafe's own API with the key, and reads its pick, its weighing and the message's language", async () => {
    const { fetchFn, sent } = jevFetch({ pick: "q0" });
    const outcome = await askJev(visitor("what do you paint"), {
      ...context,
      apiKey: "key",
      baseUrl: "https://jev.test",
      fetchFn,
    });
    expect(sent[0].url).toBe("https://jev.test/v1/systemone");
    expect(outcome).toMatchObject({
      kind: "stored",
      question: "What services do you offer?",
      language: { english: 0.95, spanish: 0.02 },
    });
    expect(outcome.seen?.top[0]).toMatchObject({ question: "What services do you offer?" });
  });
});
