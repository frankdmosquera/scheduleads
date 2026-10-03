// The sign-in form answers before the code's email is sent, so how long it takes never tells
// anyone whether an address is a customer's (F-97). Against the local seeded database, with
// Resend held: no real email is ever sent.

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

afterAll(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.$client.end();
});

describe("a login code", () => {
  test("a known address is answered before its email is sent", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_agency_key");
    vi.stubEnv("LOGIN_EMAIL_FROM", "login@agentsweb.com");
    let resendAsked = false;
    let letResendAnswer = () => {};
    const resendAnswered = new Promise<void>((resolve) => (letResendAnswer = resolve));
    vi.stubGlobal("fetch", async () => {
      resendAsked = true;
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

    expect(response.status).toBe(200);
    expect(resendAsked).toBe(true); // the email was started...
    letResendAnswer(); // ...and the answer came while Resend still had not answered
  });
});
