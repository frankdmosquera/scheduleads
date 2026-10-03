// The one email door, with Resend's side faked: no test ever sends a real email.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { sendEmail, type SendEmailInputType } from "./send-email.js";

type CallType = { url: string; headers: Headers; body: Record<string, unknown> };
let calls: CallType[];
let answer: (init?: RequestInit) => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const email: SendEmailInputType = {
  apiKey: "re_test_business_key",
  kind: "booking_confirmation",
  from: "Primo Painters <bookings@primopainters.com>",
  to: ["jane@example.com"],
  replyTo: "office@primopainters.com",
  subject: "You're booked",
  html: "<p>You're booked</p>",
  text: "You're booked",
  attachments: [
    { filename: "invite.ics", content: "BEGIN:VCALENDAR", contentType: "text/calendar" },
  ],
  idempotencyKey: "booking-confirmation/b-1",
};

beforeEach(() => {
  calls = [];
  answer = () => json({ id: "email-123" });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input instanceof Request ? input.url : input),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return answer(init);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the email door", () => {
  test("a send carries the from, to, reply-to, subject, both bodies, the attachment and its key", async () => {
    expect(await sendEmail(email)).toBe("email-123");

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.url).toBe("https://api.resend.com/emails");
    expect(call.headers.get("Authorization")).toBe("Bearer re_test_business_key"); // the key it was given
    expect(call.headers.get("Idempotency-Key")).toBe("booking-confirmation/b-1");
    expect(call.body).toMatchObject({
      from: "Primo Painters <bookings@primopainters.com>",
      to: ["jane@example.com"],
      reply_to: "office@primopainters.com",
      subject: "You're booked",
      html: "<p>You're booked</p>",
      text: "You're booked",
      attachments: [
        {
          filename: "invite.ics",
          content: Buffer.from("BEGIN:VCALENDAR").toString("base64"),
          content_type: "text/calendar",
        },
      ],
    });
  });

  test("Resend's error answer throws a reason with no key, address or content in it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // the SDK's own line outside production
    answer = () =>
      json(
        {
          name: "invalid_from_address",
          statusCode: 403,
          message: "The primopainters.com domain is not verified for jane@example.com",
        },
        403
      );

    const failure = await sendEmail(email).catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("Sending an email failed: invalid_from_address (403).");
    for (const secret of ["re_test", "jane@", "bookings@", "primopainters", "booked"]) {
      expect((failure as Error).message).not.toContain(secret);
    }
  });

  test("no answer within the time limit throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    answer = (init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason))
      );

    await expect(sendEmail(email, { timeoutMs: 50 })).rejects.toThrow(
      "Sending an email failed: no answer from Resend within 0.05 seconds."
    );
  });

  test("no key in development prints one line without content and sends nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(await sendEmail({ ...email, apiKey: null })).toBeNull();

    expect(calls).toEqual([]);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0][0]);
    expect(line).toContain("booking_confirmation");
    for (const content of ["jane@", "bookings@", "booked", "VCALENDAR"]) {
      expect(line).not.toContain(content);
    }
  });

  test("no key in production throws instead of pretending", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await expect(sendEmail({ ...email, apiKey: null })).rejects.toThrow(
      "Sending an email failed: no Resend key for booking_confirmation."
    );
    expect(calls).toEqual([]);
  });
});
