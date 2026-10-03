// Proving a business's own Resend key with a test email, Resend faked: no real email is sent.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { checkEmailSendingKey } from "./check-email-sending-key.js";

type CallType = { headers: Headers; body: Record<string, unknown> };
let calls: CallType[];
let answer: () => Response;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const input = {
  apiKey: "re_business_key_123",
  businessName: "Primo Painters",
  senderEmail: "bookings@primopainters.com",
  notifyEmail: "office@primopainters.com",
};

beforeEach(() => {
  calls = [];
  answer = () => json({ id: "email-1" });
  vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return answer();
  });
  vi.spyOn(console, "error").mockImplementation(() => {}); // the library's own line outside production
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("checking a business's key", () => {
  test("a name with a comma and an ampersand stays one quoted name in the from line", async () => {
    await checkEmailSendingKey({ ...input, businessName: 'Smith, Jones & Co "the painters"' });

    expect(calls[0].body.from).toBe(
      '"Smith, Jones & Co \\"the painters\\"" <bookings@primopainters.com>'
    );
  });

  test("a working key sends one test email from the business to its notification address", async () => {
    expect(await checkEmailSendingKey(input)).toEqual({ ok: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("Authorization")).toBe("Bearer re_business_key_123");
    expect(calls[0].body).toMatchObject({
      from: '"Primo Painters" <bookings@primopainters.com>',
      to: ["office@primopainters.com"],
      subject: "Your booking emails are set up",
    });
  });

  test.each([
    [
      "a wrong key, which Resend answers with 403",
      403,
      "invalid_api_key",
      "Resend refused this key.",
      "key",
    ],
    ["a missing key", 401, "missing_api_key", "Resend refused this key.", "key"],
    [
      "an account over its daily limit",
      429,
      "daily_quota_exceeded",
      "This Resend account has reached its sending limit. Raise it in Resend, or wait for it to reset.",
      "other",
    ],
    [
      "a sender address Resend will not take",
      422,
      "invalid_from_address",
      "Resend would not accept this sender address. Check it is a real address at the business's domain.",
      "sender",
    ],
    [
      "an address whose domain is not verified",
      403,
      "validation_error",
      "Resend would not send from this address. Check that its domain is verified in the same Resend account, and that the key may send from it.",
      "sender",
    ],
    [
      "Resend having trouble",
      500,
      "internal_server_error",
      "Resend could not send the test email just now. Try again shortly.",
      "other",
    ],
  ])(
    "%s is refused in plain words, never with the key",
    async (_name, status, name, reason, about) => {
      answer = () =>
        json({ name, statusCode: status, message: "re_business_key_123 was rejected" }, status);

      const result = await checkEmailSendingKey(input);

      expect(result).toEqual({ ok: false, reason, about });
      expect(JSON.stringify(result)).not.toContain("re_business");
    }
  );
});
