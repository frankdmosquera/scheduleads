// The sign-in form answers before the code's email is sent, so how long it takes never tells
// anyone whether an address is a customer's; and the email speaks the sign-in page's language
// (feature 12j). Against the local seeded database, with Resend held: no real email is ever sent.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the login code timing test");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../../app.js");
const { db } = await import("../../database.js");
const { appOrigin } = await import("./auth-server.js");
const { user } = await import("@scheduleads-app/shared/db");

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.$client.end();
});

describe("a login code", () => {
  test("a known address is answered before its email is sent", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_agency_key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "login@agentsweb.com");
    let resendAsked = () => {};
    const askedResend = new Promise<void>((resolve) => (resendAsked = resolve));
    let letResendAnswer = () => {};
    const resendAnswered = new Promise<void>((resolve) => (letResendAnswer = resolve));
    vi.stubGlobal("fetch", async () => {
      resendAsked();
      await resendAnswered; // Resend is slow: it answers only when the test lets it
      return new Response(JSON.stringify({ id: "email-789" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    // owner@example.com is the seed's ordinary owner (npm run db:seed).
    const response = await app.request("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: appOrigin },
      body: JSON.stringify({ email: "owner@example.com", type: "sign-in" }),
    });

    expect(response.status).toBe(200); // answered while Resend still had not answered...
    await askedResend; // ...and the email really went on to be sent, after the login's language
    letResendAnswer();
  });
});

// Through the real route, so Better Auth handing the page's Accept-Language to the email is proved.
describe("a login code's language", () => {
  const login = {
    id: randomUUID(),
    email: `code-language-${randomUUID().slice(0, 8)}@example.com`,
  };

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, login.id));
  });

  // The subject of the one email the faked Resend is asked to send.
  async function subjectSentWith(acceptLanguage: string | null): Promise<string> {
    vi.stubEnv("RESEND_API_KEY", "re_agency_key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "login@agentsweb.com");
    let sent = (_subject: string) => {};
    const subject = new Promise<string>((resolve) => (sent = resolve));
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      sent(JSON.parse(String(init.body)).subject);
      return new Response(JSON.stringify({ id: "email-790" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const response = await app.request("/api/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
        ...(acceptLanguage ? { "Accept-Language": acceptLanguage } : {}),
      },
      body: JSON.stringify({ email: login.email, type: "sign-in" }),
    });
    expect(response.status).toBe(200);
    return subject;
  }

  test("a login that never picked gets its code in the sign-in page's language", async () => {
    await db
      .insert(user)
      .values({ id: login.id, name: "", email: login.email, emailVerified: true });

    expect(await subjectSentWith("es-CO,es;q=0.9")).toMatch(/^Su código de acceso: \d{6}$/);
    expect(await subjectSentWith(null)).toMatch(/^Your sign-in code: \d{6}$/);
  });
});
