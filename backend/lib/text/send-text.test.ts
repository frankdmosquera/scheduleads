// The one door every text goes out through, with Twilio faked: what it posts, and how each kind
// of answer is sorted. No test reaches Twilio.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SendTextError } from "./send-text-error.js";
import { sendText } from "./send-text.js";

const text = {
  kind: "booking_confirmation",
  from: "+14035550199",
  to: "+14035550148",
  body: "Summit Painting: you're booked for Estimate, Tue Oct 13, 7:30 AM. To change or cancel: https://app.example.com/b/x",
};
const MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json";

type CallType = { url: string; init: RequestInit };
let calls: CallType[];

function fakeTwilio(answer: (init: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), init });
    return answer(init);
  });
}

const refusal = (status: number, code: number) =>
  Response.json({ code, message: `The 'To' number ${text.to} is not valid.`, status }, { status });

beforeEach(() => {
  calls = [];
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret-token");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendText", () => {
  test("posts the business's number, the customer's and the words to the agency's account, and returns Twilio's id", async () => {
    fakeTwilio(() => Response.json({ sid: "SM1", status: "queued" }, { status: 201 }));

    expect(await sendText(text)).toBe("SM1");

    expect(calls).toHaveLength(1);
    const [{ url, init }] = calls;
    expect(url).toBe(MESSAGES_URL);
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Authorization")).toBe(
      `Basic ${Buffer.from("AC123:secret-token").toString("base64")}`
    );
    expect(headers.get("Content-Type")).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      From: text.from,
      To: text.to,
      Body: text.body,
    });
  });

  test.each([
    ["a number that is not one", 21211],
    ["a customer who texted STOP", 21610],
    ["a number no carrier can text from ours", 21612],
    ["a landline", 21614],
    ["words over Twilio's 1600 characters", 21617],
    ["a text to the sending number itself", 21266],
  ])("%s is refused for good: never retried", async (_, code) => {
    fakeTwilio(() => refusal(400, code));

    const error = await sendText(text).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SendTextError);
    expect(error).toMatchObject({ code: String(code), status: 400, retry: false });
  });

  test.each([
    ["too many at once", 429, 20429],
    ["Twilio down for a moment", 503, 20503],
    ["keys Twilio does not take", 401, 20003],
    ["a country not yet switched on in the account", 400, 21408],
    ["a sending number not in the account", 400, 21606],
  ])("%s fails for now: retried", async (_, status, code) => {
    fakeTwilio(() => refusal(status, code));

    await expect(sendText(text)).rejects.toMatchObject({ code: String(code), status, retry: true });
  });

  test("a refusal that is not Twilio's JSON keeps its status as its code, retried", async () => {
    fakeTwilio(() => new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(sendText(text)).rejects.toMatchObject({
      code: "http_502",
      status: 502,
      retry: true,
    });
  });

  test("no answer within the limit is retried", async () => {
    fakeTwilio(
      (init) =>
        new Promise((_, reject) =>
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason))
        )
    );

    await expect(sendText(text, { timeoutMs: 50 })).rejects.toMatchObject({
      code: "timeout",
      retry: true,
    });
  });

  test.each([
    ["not JSON", () => new Response("<html>ok</html>", { status: 201 })],
    ["JSON without an id", () => Response.json({ status: "queued" }, { status: 201 })],
  ])(
    "Twilio took it but its answer is %s: retried, so the retry checks first",
    async (_, answer) => {
      fakeTwilio(answer);

      await expect(sendText(text)).rejects.toMatchObject({
        code: "unreadable_answer",
        status: 201,
        retry: true,
      });
    }
  );

  test("Twilio took it but its answer stops halfway: retried, so the retry checks first", async () => {
    // Half an answer, then nothing, until the time limit cuts the read as a real fetch does.
    fakeTwilio(
      (init) =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('{"sid":"SM'));
              init.signal?.addEventListener("abort", () => controller.error(init.signal?.reason));
            },
          }),
          { status: 201 }
        )
    );

    await expect(sendText(text, { timeoutMs: 50 })).rejects.toMatchObject({
      code: "unreadable_answer",
      retry: true,
    });
  });

  test("no connection is retried", async () => {
    fakeTwilio(() => {
      throw new TypeError("fetch failed");
    });

    await expect(sendText(text)).rejects.toMatchObject({ code: "no_connection", retry: true });
  });

  test("no error names the customer's number or the words", async () => {
    fakeTwilio(() => refusal(400, 21211));

    const error = (await sendText(text).catch((caught: unknown) => caught)) as Error;
    expect(error.message).toBe("Sending a text failed: Twilio 21211 (400).");
    expect(error.message).not.toContain("555");
  });

  test("without keys in development nothing is sent, and the log line names only the kind", async () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    fakeTwilio(() => Response.json({ sid: "SM1" }, { status: 201 }));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(await sendText(text)).toBeNull();

    expect(calls).toHaveLength(0);
    expect(log).toHaveBeenCalledWith(
      "[text] booking_confirmation not sent, no Twilio keys in development"
    );
  });

  test("without keys in production it fails, retried, so the text goes once the keys are set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    fakeTwilio(() => Response.json({ sid: "SM1" }, { status: 201 }));

    await expect(sendText(text)).rejects.toMatchObject({ code: "no_keys", retry: true });
    expect(calls).toHaveLength(0);
  });
});
