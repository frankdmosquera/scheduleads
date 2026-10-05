// A login code, through the one email door from the agency's address, with Resend faked.

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { sendLoginCode } from "./send-login-code.js";

type CallType = { headers: Headers; body: Record<string, unknown> };
let calls: CallType[];

beforeEach(() => {
  calls = [];
  vi.stubGlobal("fetch", async (_input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ id: "email-456" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("a login code", () => {
  test("goes through the door from the agency's login sender, with the agency's key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_agency_key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "Agents Web <login@agentsweb.com>");
    const lines = ["log", "info", "warn", "error"].map((level) =>
      vi.spyOn(console, level as "log").mockImplementation(() => {})
    );

    await sendLoginCode({ email: "owner@primopainters.com", otp: "482913", type: "sign-in" });

    // Sent by email, the code never reaches a log line, where Railway would keep it.
    for (const line of lines.flatMap((spy) => spy.mock.calls.flat().map(String))) {
      expect(line).not.toContain("482913");
    }

    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.headers.get("Authorization")).toBe("Bearer re_agency_key");
    expect(call.body).toMatchObject({
      from: "Agents Web <login@agentsweb.com>",
      to: ["owner@primopainters.com"],
    });
    expect(String(call.body.subject)).toContain("482913");
    expect(String(call.body.text)).toContain("482913");
    // The key that stops a double send carries neither the code nor the address.
    const key = call.headers.get("Idempotency-Key") ?? "";
    expect(key).toMatch(/^login-code\/[0-9a-f]{32}$/);
    expect(key).not.toContain("482913");
  });

  test("the same code asked for twice carries the same key, so Resend sends it once", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_agency_key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "login@agentsweb.com");

    await sendLoginCode({ email: "owner@primopainters.com", otp: "482913", type: "sign-in" });
    await sendLoginCode({ email: "owner@primopainters.com", otp: "482913", type: "sign-in" });

    expect(calls[0].headers.get("Idempotency-Key")).toBe(calls[1].headers.get("Idempotency-Key"));
  });

  test("development without the settings prints the code and sends nothing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("LOGIN_EMAIL_FROM", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await sendLoginCode({ email: "owner@example.com", otp: "111222", type: "sign-in" });

    expect(calls).toEqual([]);
    expect(String(log.mock.calls[0][0])).toContain("111222");
  });

  test("production without the settings refuses to send", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("LOGIN_EMAIL_FROM", "");

    await expect(
      sendLoginCode({ email: "owner@example.com", otp: "111222", type: "sign-in" })
    ).rejects.toThrow("RESEND_API_KEY and LOGIN_EMAIL_FROM must both be set in production");
    expect(calls).toEqual([]);
  });
});
