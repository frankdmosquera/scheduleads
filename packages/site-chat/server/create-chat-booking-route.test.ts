import { MockLanguageModelV4 } from "ai/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BookingAskAnswerType,
  BookingAskBodyType,
} from "../booking/booking-understood-type.js";
import { createChatBookingRoute } from "./create-chat-booking-route.js";

const SITE = "https://primopainters.ca";
const VISITOR = "Ana Perez, 12 Main St SW, ana@example.com";

function ask(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${SITE}/api/chat/booking`, {
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

/** Primo's form, at the name, with a visitor's reply. */
const body = (changes: Partial<BookingAskBodyType> = {}): BookingAskBodyType => ({
  lang: "en",
  business: "Primo Painters",
  service: "Free Estimate",
  services: [],
  today: "Monday, November 2, 2026",
  todayIso: "2026-11-02",
  day: "Saturday, November 7",
  times: ["9:00 a.m.", "3:00 p.m."],
  picked: "3:00 p.m.",
  fields: [
    { key: "name", label: "Name", required: true, value: null },
    { key: "email", label: "Email", required: true, value: null },
    { key: "phone", label: "Phone", required: true, value: null },
    { key: "address", label: "Address", required: true, value: null },
    { key: "details", label: "Tell us about your project", required: true, value: null },
  ],
  asking: "name",
  messages: [{ role: "user", text: VISITOR }],
  ...changes,
});

const understood = {
  service: null,
  time: null,
  day: null,
  part: null,
  name: "Ana Perez",
  email: "ana@example.com",
  phone: null,
  address: "12 Main St SW",
  details: null,
  answers: [],
  skip: false,
  book: false,
  cancel: false,
  other: false,
  reply: "Thanks, Ana. What phone number can we reach you at?",
};

/** The AI, stood in: it answers these fields as JSON, and keeps what it was asked. */
function model(answer: unknown = understood) {
  const mock = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 900, noCache: 900, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 60, text: 60, reasoning: 0 },
      },
      warnings: [],
    }),
  });
  return { mock, model: () => mock };
}

const saved = process.env.OPENAI_API_KEY;
beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.OPENAI_API_KEY;
});
afterEach(() => {
  vi.restoreAllMocks();
  if (saved === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = saved;
});

const answerOf = async (response: Response) => (await response.json()) as BookingAskAnswerType;

describe("the booking AI's route", () => {
  it("returns the fields the AI understood, and nothing that books", async () => {
    const response = await createChatBookingRoute({ model: model().model })(ask(body()));
    expect(response.status).toBe(200);
    expect((await answerOf(response)).understood).toEqual(understood);
  });
  it("tells the AI the business's own form and the times on screen, never another business's offer", async () => {
    const { mock, model: stand } = model();
    await createChatBookingRoute({ model: stand })(ask(body()));
    const prompt = JSON.stringify(mock.doGenerateCalls[0]?.prompt);
    for (const part of [
      "Primo Painters",
      "Free Estimate",
      "Tell us about your project (required)",
      "2. 3:00 p.m.",
      "Never say it is booked",
    ])
      expect(prompt).toContain(part);
    expect(prompt).not.toMatch(/30-minute|video call|agency/i);
    // Fields only: structured output, with no thinking pause.
    expect(mock.doGenerateCalls[0]?.responseFormat?.type).toBe("json");
    expect(mock.doGenerateCalls[0]?.providerOptions?.openai).toMatchObject({
      reasoningEffort: "none",
    });
  });
  it("refuses another site, and anything that is not JSON", async () => {
    const route = createChatBookingRoute({ model: model().model });
    expect((await route(ask(body(), { origin: "https://elsewhere.example" }))).status).toBe(403);
    expect((await route(ask(body(), { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await route(ask(body(), { "content-type": "text/plain" }))).status).toBe(403);
  });
  it("refuses a body that is not a booking's", async () => {
    const route = createChatBookingRoute({ model: model().model });
    expect((await route(ask("{not json"))).status).toBe(400);
    expect((await route(ask(body({ messages: [{ role: "assistant", text: "hi" }] })))).status).toBe(
      400
    );
    expect(
      (
        await route(
          ask(body({ fields: [{ key: "password", label: "x", required: true, value: null }] }))
        )
      ).status
    ).toBe(400);
  });
  it("caps every turn, the conversation and the whole call", async () => {
    const route = createChatBookingRoute({ model: model().model });
    const turn = (role: "user" | "assistant", n: number) => ({ role, text: "x".repeat(n) });
    expect((await route(ask(body({ messages: [turn("user", 501)] })))).status).toBe(400);
    expect(
      (
        await route(
          ask(body({ messages: [turn("user", 10), turn("assistant", 601), turn("user", 10)] }))
        )
      ).status
    ).toBe(400);
    const nine = Array.from({ length: 9 }, (_, i) => turn(i % 2 ? "assistant" : "user", 5));
    expect((await route(ask(body({ messages: nine })))).status).toBe(400);
    const full = Array.from({ length: 7 }, (_, i) =>
      i % 2 ? turn("assistant", 600) : turn("user", 500)
    );
    // Each part within its own limit, the whole past 6,000 characters.
    const fields = body().fields.map((f) =>
      f.key === "details"
        ? { ...f, value: "d".repeat(2000) }
        : f.key === "address"
          ? { ...f, value: "a".repeat(300) }
          : f
    );
    expect((await route(ask(body({ messages: full, fields })))).status).toBe(400);
  });
  it("cuts each field's value to its own limit before the AI sees it", async () => {
    const { mock, model: stand } = model();
    const fields = body().fields.map((f) =>
      f.key === "name" ? { ...f, value: "N".repeat(2000) } : f
    );
    expect((await createChatBookingRoute({ model: stand })(ask(body({ fields })))).status).toBe(
      200
    );
    const prompt = JSON.stringify(mock.doGenerateCalls[0]?.prompt);
    expect(prompt).toContain("N".repeat(120));
    expect(prompt).not.toContain("N".repeat(121));
  });
  it("stops one address past its hourly limit, and a visit past its AI answers", async () => {
    const route = createChatBookingRoute({ model: model().model });
    for (let i = 0; i < 60; i++) await route(ask(body()));
    expect(await answerOf(await route(ask(body())))).toEqual({ error: "limit" });
    const fresh = createChatBookingRoute({ model: model().model });
    expect(await answerOf(await fresh(ask(body({ aiSpent: true }))))).toEqual({ error: "limit" });
  });
  it("without a key, the chat's word lists answer", async () => {
    expect(await answerOf(await createChatBookingRoute()(ask(body())))).toEqual({
      error: "unavailable",
    });
  });
  it("a model that fails is unavailable, never its error text", async () => {
    const failing = () =>
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new Error(VISITOR);
        },
      });
    const answer = await answerOf(await createChatBookingRoute({ model: failing })(ask(body())));
    expect(answer).toEqual({ error: "unavailable" });
  });
  it("never logs what the visitor wrote, only counts", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await createChatBookingRoute({ model: model().model })(ask(body()));
    await createChatBookingRoute({
      model: () =>
        new MockLanguageModelV4({
          doGenerate: async () => {
            throw new Error(VISITOR);
          },
        }),
    })(ask(body()));
    const logged = JSON.stringify([...info.mock.calls, ...error.mock.calls]);
    expect(logged).toContain("in (");
    for (const word of ["Ana", "Main St", "ana@example.com"]) expect(logged).not.toContain(word);
  });
  it("the laptop's inspector gets the AI's tokens and time", async () => {
    const answer = await answerOf(
      await createChatBookingRoute({ model: model().model, debug: true })(ask(body()))
    );
    expect(answer.trace?.ai).toMatchObject({
      model: "gpt-5.4-mini",
      inputTokens: 900,
      outputTokens: 60,
    });
  });
});
