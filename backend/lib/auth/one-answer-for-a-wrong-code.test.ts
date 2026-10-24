// A refused sign-in code gets one answer, whoever the address belongs to: a customer's
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
// Never a real code: the real one is six random digits, never this. The whole answer, as a
// visitor sees it, so a difference in any byte or header shows (the date aside).
const tryWrongCode = async (email: string) => {
  const response = await post("/sign-in/email-otp", { email, otp: "000000" });
  const headers = [...response.headers].filter(([name]) => name !== "date").sort();
  return { status: response.status, body: await response.text(), headers };
};

// The email code routes the dashboard never calls, each able to read a customer's code.
const UNUSED_CODE_ROUTES = [
  ["/email-otp/check-verification-otp", { type: "sign-in", otp: "000000" }],
  ["/email-otp/verify-email", { otp: "000000" }],
  ["/email-otp/request-password-reset", {}],
  ["/forget-password/email-otp", {}],
  ["/email-otp/reset-password", { otp: "000000", password: "not-used-0000" }],
  ["/email-otp/request-email-change", { newEmail: "new@example.com" }],
  ["/email-otp/change-email", { newEmail: "new@example.com", otp: "000000" }],
] as const;

describe("a refused sign-in code", () => {
  let unknownAnswer: Awaited<ReturnType<typeof tryWrongCode>>;

  test("an unknown address hears Better Auth's Invalid OTP, the same on every try", async () => {
    expect((await sendCode(unknownEmail)).status).toBe(200);
    unknownAnswer = await tryWrongCode(unknownEmail);
    expect(unknownAnswer.status).toBe(400);
    expect(JSON.parse(unknownAnswer.body)).toEqual({ message: "Invalid OTP", code: "INVALID_OTP" });
    for (let attempt = 0; attempt < 3; attempt++) {
      expect(await tryWrongCode(unknownEmail)).toEqual(unknownAnswer);
    }
  });

  test("a customer's fourth wrong try answers exactly the same, not Too many attempts", async () => {
    expect((await sendCode(customer.email)).status).toBe(200);
    for (let attempt = 0; attempt < 4; attempt++) {
      expect(await tryWrongCode(customer.email)).toEqual(unknownAnswer);
    }
  });

  test("a customer's expired code answers exactly the same, not OTP expired", async () => {
    expect((await sendCode(customer.email)).status).toBe(200);
    await db
      .update(verification)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(codeRow(customer.email));
    expect(await tryWrongCode(customer.email)).toEqual(unknownAnswer);
  });

  test("the code routes the dashboard never calls are closed, a customer's code or not", async () => {
    expect((await sendCode(customer.email)).status).toBe(200);
    for (const [path, body] of UNUSED_CODE_ROUTES) {
      const response = await post(path, { email: customer.email, ...body });
      expect({ path, status: response.status }).toEqual({ path, status: 404 });
    }
  });
});
