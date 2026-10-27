// The owner's "Email sending" card (feature 25a), called through the real app against the local
// database, with Resend faked: no real email is ever sent. Every business and login here is a throwaway made
// below and removed after.

import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

// The sign-in helper reads codes from the console, so these tests never send a real email, even
// when .env holds the agency's Resend key.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the email sending route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const { member, organization, user } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string) => ({
  userId: randomUUID(),
  email: `sending-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-sending-${letter}-${tag}-dev`,
});
const primo = makeTenant("p"); // the owner who sets up sending
const other = makeTenant("o"); // another business, never touched
const noBooking = makeTenant("n"); // a plan without booking: no real tier lacks it yet
const helper = { userId: randomUUID(), email: `sending-m-${tag}@example.com` }; // a member of Primo

const cookies = new Map<string, string>();

// Signs in the real way: asks for a login code and reads it where the API prints it.
async function signIn(email: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const headers = { "Content-Type": "application/json", Origin: appOrigin };
  await app.request("/api/auth/email-otp/send-verification-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, type: "sign-in" }),
  });
  const line = log.mock.calls.map((call) => String(call[0])).find((text) => text.includes(email));
  log.mockRestore();
  const otp = line?.split(": ").pop();
  if (!otp) throw new Error(`No login code was printed for ${email}.`);
  const response = await app.request("/api/auth/sign-in/email-otp", {
    method: "POST",
    headers,
    body: JSON.stringify({ email, otp }),
  });
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

const getCard = (email?: string) =>
  app.request("/email-sending", {
    headers: { Origin: appOrigin, ...(email ? { Cookie: cookies.get(email)! } : {}) },
  });
const saveCard = (body: unknown, email?: string) =>
  app.request("/email-sending", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Origin: appOrigin,
      ...(email ? { Cookie: cookies.get(email)! } : {}),
    },
    body: JSON.stringify(body),
  });

const addresses = {
  senderEmail: "bookings@primopainters.com",
  notifyEmail: "office@primopainters.com",
};

// Resend's side, faked: the answer each test sets, and every email asked for.
let resendAnswer: () => Response;
const resendCalls: { headers: Headers; body: Record<string, unknown> }[] = [];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeAll(async () => {
  await db.insert(user).values(
    [primo, other, noBooking, helper].map((t) => ({
      id: t.userId,
      name: "",
      email: t.email,
      emailVerified: true,
    }))
  );
  await db.insert(organization).values([
    ...[primo, other].map((t) => ({
      id: t.organizationId,
      name: `Primo ${t.slug}`,
      slug: t.slug,
    })),
    {
      id: noBooking.organizationId,
      name: "No booking",
      slug: noBooking.slug,
      plan: "no-booking-test",
    },
  ]);
  await db.insert(member).values([
    { id: randomUUID(), organizationId: primo.organizationId, userId: primo.userId, role: "owner" },
    { id: randomUUID(), organizationId: other.organizationId, userId: other.userId, role: "owner" },
    {
      id: randomUUID(),
      organizationId: noBooking.organizationId,
      userId: noBooking.userId,
      role: "owner",
    },
    {
      id: randomUUID(),
      organizationId: primo.organizationId,
      userId: helper.userId,
      role: "member",
    },
  ]);
  for (const email of [primo.email, other.email, noBooking.email, helper.email])
    cookies.set(email, await signIn(email));
});

beforeEach(() => {
  resendCalls.length = 0;
  resendAnswer = () => json({ id: "email-1" });
  vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
    resendCalls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return resendAnswer();
  });
  vi.spyOn(console, "error").mockImplementation(() => {}); // the library's own line outside production
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [
        primo.organizationId,
        other.organizationId,
        noBooking.organizationId,
      ])
    );
  await db
    .delete(user)
    .where(inArray(user.id, [primo.userId, other.userId, noBooking.userId, helper.userId]));
  await db.$client.end();
});

describe("the Email sending card", () => {
  test("nothing saved: emails come from booking-crm.com and notices go to the owner", async () => {
    const response = await getCard(other.email);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      senderEmail: null,
      notifyEmail: null,
      sendingFrom: "bookings@booking-crm.com",
      fromOwnDomain: false,
      noticesTo: other.email,
    });
  });

  test("an owner saves the two addresses, and no email is sent to test anything", async () => {
    const response = await saveCard(addresses, primo.email);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ...addresses,
      sendingFrom: "bookings@primopainters.com",
      fromOwnDomain: true,
      noticesTo: "office@primopainters.com",
    });
    expect(resendCalls).toHaveLength(0);
  });

  test("emptying both goes back to the picked sender and the owner's email", async () => {
    await saveCard(addresses, primo.email);
    const response = await saveCard({ senderEmail: "", notifyEmail: "" }, primo.email);

    expect(await response.json()).toEqual({
      senderEmail: null,
      notifyEmail: null,
      sendingFrom: "bookings@booking-crm.com",
      fromOwnDomain: false,
      noticesTo: primo.email,
    });
  });

  test("a business whose plan has no booking cannot read or save the card, and nothing is sent", async () => {
    const read = await getCard(noBooking.email);
    const save = await saveCard(addresses, noBooking.email);

    expect(read.status).toBe(403);
    expect(save.status).toBe(403);
    expect(resendCalls).toHaveLength(0);
  });

  test("a member whose role may not change the business is refused, and nothing is sent", async () => {
    const response = await saveCard(addresses, helper.email);

    expect(response.status).toBe(403);
    expect(resendCalls).toHaveLength(0);
  });

  test("another business is never touched", async () => {
    await saveCard(addresses, primo.email);

    const [row] = await db
      .select({ senderEmail: organization.senderEmail })
      .from(organization)
      .where(eq(organization.id, other.organizationId));
    expect(row.senderEmail).toBeNull();
  });

  test.each([
    [
      "a sender that is not an email",
      { ...addresses, senderEmail: "bookings" },
      "Enter a valid email address.",
    ],
  ])("%s is a 400", async (_name, body, message) => {
    const response = await saveCard(body, primo.email);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(message);
  });

  test("a browser on the dashboard may save the card: the preflight allows PUT with the login", async () => {
    const preflight = (origin: string) =>
      app.request("/email-sending", {
        method: "OPTIONS",
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "PUT",
          "Access-Control-Request-Headers": "content-type",
        },
      });

    const fromDashboard = await preflight(appOrigin);
    expect(fromDashboard.headers.get("Access-Control-Allow-Methods")).toContain("PUT");
    expect(fromDashboard.headers.get("Access-Control-Allow-Origin")).toBe(appOrigin);
    expect(fromDashboard.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    const fromElsewhere = await preflight("https://not-the-dashboard.example");
    expect(fromElsewhere.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("no session is refused, and the card's answers are never cached", async () => {
    expect((await getCard()).status).toBe(401);
    expect((await getCard(primo.email)).headers.get("Cache-Control")).toContain("no-store");
  });
});
