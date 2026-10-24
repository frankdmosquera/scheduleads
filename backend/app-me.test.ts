// A login's own dashboard language (feature 12j), through the real app against the local database.
// Two throwaway logins in one throwaway business, carrying this run's tag, removed after.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

// The sign-in helper reads codes from the console, so these tests never send a real email.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the /me language tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("./app.js");
const { db } = await import("./database.js");
const { appOrigin } = await import("./lib/auth/auth-server.js");
const { loginLanguageOf } = await import("./lib/auth/login-language-of.js");
const { member, organization, user } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const owner = { id: randomUUID(), email: `me-owner-${tag}@example.com` };
const colleague = { id: randomUUID(), email: `me-colleague-${tag}@example.com` };
const organizationId = randomUUID();
const cookies = new Map<string, string>();

// Signs in the real way: asks for a login code and reads it where the API prints it.
async function signIn(address: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const headers = { "Content-Type": "application/json", Origin: appOrigin };
  await app.request("/api/auth/email-otp/send-verification-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: address, type: "sign-in" }),
  });
  const line = log.mock.calls.map((call) => String(call[0])).find((text) => text.includes(address));
  log.mockRestore();
  const otp = line?.split(": ").pop();
  if (!otp) throw new Error(`No login code was printed for ${address}.`);

  const response = await app.request("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email: address, otp }),
  });
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const pickLanguage = (body: unknown, as?: string) =>
  app.request("/me/language", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: appOrigin,
      ...(as ? { Cookie: cookies.get(as)! } : {}),
    },
    body: JSON.stringify(body),
  });

const languageOnMe = async (as: string) => {
  const response = await app.request("/me", { headers: { Cookie: cookies.get(as)! } });
  expect(response.status).toBe(200);
  return (await response.json()).user.language;
};

const savedLanguage = async (id: string) =>
  (await db.select({ language: user.language }).from(user).where(eq(user.id, id)))[0].language;

beforeAll(async () => {
  await db.insert(user).values([
    { id: owner.id, name: "", email: owner.email, emailVerified: true },
    { id: colleague.id, name: "", email: colleague.email, emailVerified: true },
  ]);
  await db
    .insert(organization)
    .values({ id: organizationId, name: `Test Me ${tag}`, slug: `test-me-${tag}` });
  await db.insert(member).values([
    { id: randomUUID(), organizationId, userId: owner.id, role: "owner" },
    { id: randomUUID(), organizationId, userId: colleague.id, role: "member" },
  ]);

  for (const address of [owner.email, colleague.email]) {
    cookies.set(address, await signIn(address));
  }
});

afterAll(async () => {
  // Members go with the business (cascade); sessions with the logins.
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(user).where(like(user.email, `me-%-${tag}@example.com`));
  await db.$client.end();
});

describe("PUT /me/language", () => {
  test("a login that never picked reads null on /me", async () => {
    expect(await languageOnMe(owner.email)).toBeNull();
  });

  test("sets the signed-in login's own language, and /me reads it back", async () => {
    const response = await pickLanguage({ language: "es" }, owner.email);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ language: "es" });
    expect(await languageOnMe(owner.email)).toBe("es");
  });

  test("another login in the same business keeps its own", async () => {
    await pickLanguage({ language: "es" }, owner.email);
    await pickLanguage({ language: "en" }, colleague.email);
    expect(await languageOnMe(owner.email)).toBe("es");
    expect(await languageOnMe(colleague.email)).toBe("en");
  });

  test("whose login comes from the session, never from what is sent", async () => {
    await pickLanguage({ language: "en" }, colleague.email);
    const response = await pickLanguage({ language: "es", userId: colleague.id }, owner.email);
    expect(response.status).toBe(200);
    expect(await savedLanguage(colleague.id)).toBe("en");
  });

  test("the same language twice is fine", async () => {
    expect((await pickLanguage({ language: "es" }, owner.email)).status).toBe(200);
    expect((await pickLanguage({ language: "es" }, owner.email)).status).toBe(200);
    expect(await savedLanguage(owner.id)).toBe("es");
  });

  test("a language other than en or es is refused with 400", async () => {
    await pickLanguage({ language: "es" }, owner.email);
    for (const body of [{ language: "fr" }, { language: null }, {}, "es"]) {
      const response = await pickLanguage(body, owner.email);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "bad_request", message: "Use en or es." },
      });
    }
    expect(await savedLanguage(owner.id)).toBe("es");
  });

  test("signed out is refused with 401", async () => {
    expect((await pickLanguage({ language: "es" })).status).toBe(401);
  });

  // A plain form is what another site could send with the cookie; CORS stops the rest.
  test("a form sent from another site is refused, and nothing changes", async () => {
    await pickLanguage({ language: "es" }, owner.email);
    const response = await app.request("/me/language", {
      method: "PUT",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://elsewhere.example",
        Cookie: cookies.get(owner.email)!,
      },
      body: "language=en",
    });
    expect(response.status).toBe(403);
    expect(await savedLanguage(owner.id)).toBe("es");
  });
});

describe("the sign-in code email's language", () => {
  test("the login's own pick wins over the sign-in page's", async () => {
    await pickLanguage({ language: "en" }, colleague.email);
    expect(await loginLanguageOf(colleague.email, "es-CO,es;q=0.9")).toBe("en");
  });

  test("a login that never picked gets the sign-in page's language", async () => {
    await db.update(user).set({ language: null }).where(eq(user.id, owner.id));
    expect(await loginLanguageOf(owner.email, "es-CO,es;q=0.9")).toBe("es");
    expect(await loginLanguageOf(owner.email.toUpperCase(), "es")).toBe("es");
    expect(await loginLanguageOf(owner.email, null)).toBe("en");
  });

  test("an address with no login gets English or the page's, and nothing else is read", async () => {
    expect(await loginLanguageOf(`nobody-${tag}@example.com`, "es")).toBe("es");
    expect(await loginLanguageOf(`nobody-${tag}@example.com`, null)).toBe("en");
  });
});
