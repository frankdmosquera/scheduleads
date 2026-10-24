// A refused sign-in code gets one answer, whoever the address belongs to (F-487): a customer's
// expired code and its fourth wrong try answer exactly as an unknown address does. Through the
// real route, against the local seeded database, with Resend held: no real email is ever sent.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the one answer for a wrong code test");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../../app.js");
const { db } = await import("../../database.js");
const { appOrigin } = await import("./auth-server.js");
const { user, verification } = await import("@scheduleads-app/shared/db");

const customer = { id: randomUUID(), email: `one-answer-${randomUUID().slice(0, 8)}@example.com` };
const unknownEmail = `nobody-${randomUUID().slice(0, 8)}@example.com`;
const codeRow = (email: string) => eq(verification.identifier, `sign-in-otp-${email}`);

beforeAll(async () => {
  vi.stubEnv("RESEND_API_KEY", "re_agency_key");
  vi.stubEnv("LOGIN_EMAIL_FROM", "login@agentsweb.com");
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(JSON.stringify({ id: "email-791" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  );
  await db
    .insert(user)
    .values({ id: customer.id, name: "", email: customer.email, emailVerified: true });
});

afterAll(async () => {
  await db.delete(verification).where(codeRow(customer.email));
  await db.delete(user).where(eq(user.id, customer.id));
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await db.$client.end();
});

const post = (path: string, body: object) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: appOrigin },
    body: JSON.stringify(body),
  });
const sendCode = (email: string) =>
  post("/email-otp/send-verification-otp", { email, type: "sign-in" });
// Never a real code: the real one is six random digits, never this.
const tryWrongCode = async (email: string) => {
  const response = await post("/sign-in/email-otp", { email, otp: "000000" });
  return { status: response.status, code: ((await response.json()) as { code?: string }).code };
};

const unknownAnswer = { status: 400, code: "INVALID_OTP" };

describe("a refused sign-in code", () => {
  test("an unknown address hears Invalid OTP on every try", async () => {
    expect((await sendCode(unknownEmail)).status).toBe(200);
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(await tryWrongCode(unknownEmail)).toEqual(unknownAnswer);
    }
  });

  test("a customer's fourth wrong try answers the same, not Too many attempts", async () => {
    expect((await sendCode(customer.email)).status).toBe(200);
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(await tryWrongCode(customer.email)).toEqual(unknownAnswer);
    }
  });

  test("a customer's expired code answers the same, not OTP expired", async () => {
    expect((await sendCode(customer.email)).status).toBe(200);
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(codeRow(customer.email));
    expect(await tryWrongCode(customer.email)).toEqual(unknownAnswer);
  });
});
