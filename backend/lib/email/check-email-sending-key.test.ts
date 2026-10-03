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
  test("a working key sends one test email from the business to its notification address", async () => {
    expect(await checkEmailSendingKey(input)).toEqual({ ok: true });

    expect(calls).toHaveLength(1);
    expect(calls[0].headers.get("Authorization")).toBe("Bearer re_business_key_123");
    expect(calls[0].body).toMatchObject({
      from: "Primo Painters <bookings@primopainters.com>",
      to: ["office@primopainters.com"],
      subject: "Your booking emails are set up",
    });
  });

  test.each([
    ["a wrong key", 401, "invalid_api_key", "Resend refused this key."],
    [
      "an address whose domain is not verified",
      403,
      "validation_error",
      "Resend would not send from this address. Check that its domain is verified in the same Resend account, and that the key may send from it.",
    ],
    [
      "Resend having trouble",
      500,
      "internal_server_error",
      "Resend could not send the test email just now. Try again shortly.",
    ],
  ])("%s is refused in plain words, never with the key", async (_name, status, name, reason) => {
    answer = () =>
      json({ name, statusCode: status, message: "re_business_key_123 was rejected" }, status);

    const result = await checkEmailSendingKey(input);

    expect(result).toEqual({ ok: false, reason });
    expect(JSON.stringify(result)).not.toContain("re_business");
  });
});
