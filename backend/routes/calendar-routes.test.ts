// The calendar routes, called through the real app against the local database, with
// Google faked: no test ever reaches Google. Every business, login and person here is a
// throwaway made below and removed after, so a real connection is never touched.

import { createHash, randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the Google values.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the calendar route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { apiOrigin, appOrigin } = await import("../lib/auth/auth-server.js");
const { calendarConnection, calendarOauthState, member, organization, resource, user } =
  await import("@scheduleads-app/shared/db");
const { decryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { saveCalendarConnection } = await import("../lib/calendar/save-calendar-connection.js");

const FREEBUSY = "https://www.googleapis.com/auth/calendar.events.freebusy";
const EVENTS_OWNED = "https://www.googleapis.com/auth/calendar.events.owned";
const BOTH_SCOPES = `openid https://www.googleapis.com/auth/userinfo.email ${FREEBUSY} ${EVENTS_OWNED}`;

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string, plan = "agency") => ({
  userId: randomUUID(),
  email: `calendar-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-calendar-${letter}-${tag}-dev`,
  plan,
  personId: randomUUID(),
});
const ana = makeTenant("a"); // connects her calendar
const ben = makeTenant("b"); // another business, for "someone else's ticket"
const noBooking = makeTenant("d", "no-booking-test"); // no real tier lacks booking yet
const noPerson = { userId: randomUUID(), email: `calendar-c-${tag}@example.com` }; // in Ana's business, no person
const coworkerId = randomUUID(); // another person in Ana's business, with no login

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

const request = (path: string, email?: string, method = "GET") =>
  app.request(path, {
    method,
    headers: email ? { Cookie: cookies.get(email)!, Origin: appOrigin } : { Origin: appOrigin },
  });

async function startConnect(email: string): Promise<string> {
  const response = await request("/calendar/connect", email, "POST");
  const { url } = await response.json();
  return new URL(url).searchParams.get("state")!;
}

async function callback(query: string, email?: string): Promise<string | null> {
  const response = await request(`/calendar/callback?${query}`, email);
  expect(response.status).toBe(302);
  return response.headers.get("Location");
}

// A full, successful connect as this login, with the Gmail Google reports.
async function connect(
  email: string,
  gmail: string,
  refreshToken = "1//refresh-token-from-google"
): Promise<void> {
  tokenAnswer = () => googleTokens({ email: gmail, refreshToken });
  const state = await startConnect(email);
  expect(await callback(`state=${state}&code=abc`, email)).toBe(outcome("connected"));
}

const outcome = (name: string) => `${appOrigin}/?calendar=${name}`;
const fingerprint = (state: string) => createHash("sha256").update(state).digest("hex");

const connectionsOf = (personId: string) =>
  db.select().from(calendarConnection).where(eq(calendarConnection.resourceId, personId));

// Google's side, faked: the token answer each test sets, and every token handed back.
let tokenAnswer: () => Response = () => new Response("", { status: 500 });
let revokeAnswer: () => Response | Promise<Response> = () => new Response("", { status: 200 });
const revoked: string[] = [];
// Every warning the API logged during a test, and what must never be in one.
const warnings: string[] = [];
const secrets = ["refresh-token-from-google", "access-token-from-google", "v1."];

// `claims` overrides what Google would say, for the sign-ins that must be refused.
const idToken = (email: string, claims: Record<string, unknown> = {}) =>
  [
    { alg: "none" },
    {
      iss: "https://accounts.google.com",
      aud: process.env.GOOGLE_CLIENT_ID,
      email,
      email_verified: true,
      ...claims,
    },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .concat("signature")
    .join(".");

const googleTokens = ({
  scope = BOTH_SCOPES,
  refreshToken = "1//refresh-token-from-google" as string | null,
  email = "ana.owner@gmail.com",
  claims = {} as Record<string, unknown>,
} = {}) =>
  new Response(
    JSON.stringify({
      access_token: "ya29.access-token-from-google",
      expires_in: 3599,
      scope,
      token_type: "Bearer",
      id_token: idToken(email, claims),
      ...(refreshToken ? { refresh_token: refreshToken } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );

beforeAll(async () => {
  const tenants = [ana, ben, noBooking];
  await db
    .insert(user)
    .values([
      ...tenants.map((t) => ({ id: t.userId, name: "", email: t.email, emailVerified: true })),
      { id: noPerson.userId, name: "", email: noPerson.email, emailVerified: true },
    ]);
  await db
    .insert(organization)
    .values(
      tenants.map((t) => ({ id: t.organizationId, name: t.slug, slug: t.slug, plan: t.plan }))
    );
  await db.insert(member).values([
    ...tenants.map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      userId: t.userId,
      role: "owner",
    })),
    {
      id: randomUUID(),
      organizationId: ana.organizationId,
      userId: noPerson.userId,
      role: "member",
    },
  ]);
  await db.insert(resource).values(
    tenants.map((t) => ({
      id: t.personId,
      organizationId: t.organizationId,
      name: t.slug,
      kind: "person",
      userId: t.userId,
    }))
  );
  await db.insert(resource).values({
    id: coworkerId,
    organizationId: ana.organizationId,
    name: "Coworker",
    kind: "person",
  });

  for (const email of [ana.email, ben.email, noBooking.email, noPerson.email]) {
    cookies.set(email, await signIn(email));
  }

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://oauth2.googleapis.com/token")) return tokenAnswer();
    if (url.startsWith("https://oauth2.googleapis.com/revoke")) {
      revoked.push(new URLSearchParams(String(init?.body)).get("token") ?? "");
      return revokeAnswer();
    }
    throw new Error(`A test tried to reach ${url}.`);
  });
});

beforeEach(async () => {
  revoked.length = 0;
  warnings.length = 0;
  vi.spyOn(console, "warn").mockImplementation((...parts) => {
    warnings.push(parts.join(" "));
  });
  tokenAnswer = () => googleTokens();
  revokeAnswer = () => new Response("", { status: 200 });
  // Every test starts with everyone unconnected, so none depends on what an earlier one saved.
  await db
    .delete(calendarConnection)
    .where(inArray(calendarConnection.resourceId, [ana.personId, ben.personId, coworkerId]));
});

afterEach(() => {
  vi.mocked(console.warn).mockRestore();
  for (const warning of warnings)
    for (const secret of secrets) expect(warning).not.toContain(secret);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  // Their people, tickets and connections go with the businesses (cascade); sessions with the logins.
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [ana.organizationId, ben.organizationId, noBooking.organizationId])
    );
  await db
    .delete(user)
    .where(inArray(user.id, [ana.userId, ben.userId, noBooking.userId, noPerson.userId]));
  await db.$client.end();
});

describe("POST /calendar/connect", () => {
  test("no session is refused with 401", async () => {
    expect((await request("/calendar/connect", undefined, "POST")).status).toBe(401);
  });

  test("a plan without booking is refused with 403", async () => {
    // An unrecognised plan stands in: no real tier lacks booking until feature 23.
    expect((await request("/calendar/connect", noBooking.email, "POST")).status).toBe(403);
  });

  test("a login with no person in the business is refused plainly", async () => {
    const response = await request("/calendar/connect", noPerson.email, "POST");
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("no_person");
  });

  test("answers Google's address with our client, return address, both permissions and PKCE", async () => {
    const response = await request("/calendar/connect", ana.email, "POST");
    expect(response.status).toBe(200);
    const url = new URL((await response.json()).url);
    const params = url.searchParams;

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(params.get("client_id")).toBe(process.env.GOOGLE_CLIENT_ID);
    expect(params.get("redirect_uri")).toBe(`${apiOrigin}/calendar/callback`);
    expect(params.get("scope")?.split(" ")).toEqual(["openid", "email", FREEBUSY, EVENTS_OWNED]);
    expect(params.get("access_type")).toBe("offline");
    expect(params.get("prompt")).toBe("consent");
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("code_challenge")).toMatch(/^[\w-]{43}$/);
    expect(params.get("state")).toMatch(/^[\w-]{43}$/);
  });
});

describe("the one-time ticket", () => {
  test("keeps a fingerprint, never the value sent to Google, for ten minutes", async () => {
    const state = await startConnect(ana.email);
    const rows = await db
      .select()
      .from(calendarOauthState)
      .where(inArray(calendarOauthState.id, [state, fingerprint(state)]));

    expect(rows.map((row) => row.id)).toEqual([fingerprint(state)]);
    const minutesLeft = (rows[0].expiresAt.getTime() - Date.now()) / 60_000;
    expect(minutesLeft).toBeGreaterThan(9);
    expect(minutesLeft).toBeLessThanOrEqual(10);
  });

  test("making a new one clears your expired ones", async () => {
    const stale = randomUUID();
    await db.insert(calendarOauthState).values({
      id: stale,
      userId: ana.userId,
      organizationId: ana.organizationId,
      resourceId: ana.personId,
      codeVerifier: "stale",
      expiresAt: new Date(Date.now() - 60_000),
    });
    await startConnect(ana.email);

    const left = await db.select().from(calendarOauthState).where(eq(calendarOauthState.id, stale));
    expect(left).toEqual([]);
  });
});

describe("GET /calendar/callback", () => {
  test("Cancel at Google ends in denied, and uses the ticket up", async () => {
    const state = await startConnect(ana.email);
    expect(await callback(`state=${state}&error=access_denied`, ana.email)).toBe(outcome("denied"));

    const left = await db
      .select()
      .from(calendarOauthState)
      .where(eq(calendarOauthState.id, fingerprint(state)));
    expect(left).toEqual([]);
  });

  test("an unknown, expired, reused or someone else's ticket, or no session, ends in expired", async () => {
    expect(await callback(`state=unknown-${tag}&code=abc`, ana.email)).toBe(outcome("expired"));

    const stale = await startConnect(ana.email);
    await db
      .update(calendarOauthState)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(calendarOauthState.id, fingerprint(stale)));
    expect(await callback(`state=${stale}&code=abc`, ana.email)).toBe(outcome("expired"));

    const anas = await startConnect(ana.email);
    expect(await callback(`state=${anas}&code=abc`, ben.email)).toBe(outcome("expired"));
    expect(await callback(`state=${anas}&code=abc`)).toBe(outcome("expired"));

    tokenAnswer = () => new Response("", { status: 400 }); // so the first use stops before saving
    await callback(`state=${anas}&code=abc`, ana.email);
    expect(await callback(`state=${anas}&code=abc`, ana.email)).toBe(outcome("expired"));

    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("Google refusing the code ends in failed and saves nothing", async () => {
    tokenAnswer = () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(outcome("failed"));
    expect(await connectionsOf(ana.personId)).toEqual([]);
    expect(warnings).toEqual([
      "[calendar] connect failed at the code swap: Google refused the code swap (400 invalid_grant).",
    ]);
  });

  test("a missing permission hands the tokens back and saves nothing", async () => {
    tokenAnswer = () => googleTokens({ scope: `openid ${FREEBUSY}` }); // "add events" unticked
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(
      outcome("missing_permission")
    );
    expect(revoked).toEqual(["1//refresh-token-from-google"]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("no long-lived token hands the access token back, fails, and saves nothing", async () => {
    tokenAnswer = () => googleTokens({ refreshToken: null });
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(outcome("failed"));
    expect(revoked).toEqual(["ya29.access-token-from-google"]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
    expect(warnings).toEqual(["[calendar] connect failed at the token check: no refresh token"]);
  });

  test.each([
    ["meant for another app", { aud: "another-apps-client-id" }],
    ["not from Google", { iss: "https://accounts.example.com" }],
    ["with an unverified email", { email_verified: false }],
  ])("a sign-in token %s is refused: failed, handed back, nothing saved", async (_name, claims) => {
    tokenAnswer = () => googleTokens({ claims });
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(outcome("failed"));
    expect(revoked).toEqual(["1//refresh-token-from-google"]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
    expect(warnings).toEqual([
      "[calendar] connect failed at the token check: the sign-in token was not ours, not Google's, or unverified",
    ]);
  });

  test("a person unlinked from the login while at Google ends in expired", async () => {
    const state = await startConnect(ana.email);
    await db.update(resource).set({ userId: null }).where(eq(resource.id, ana.personId));
    try {
      expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(outcome("expired"));
      expect(await connectionsOf(ana.personId)).toEqual([]);
    } finally {
      await db.update(resource).set({ userId: ana.userId }).where(eq(resource.id, ana.personId));
    }
  });

  test("a Google error other than Cancel ends in failed, and uses the ticket up", async () => {
    const state = await startConnect(ana.email);
    expect(await callback(`state=${state}&error=server_error`, ana.email)).toBe(outcome("failed"));
    expect(warnings).toEqual(["[calendar] connect failed at google: server_error"]);

    const left = await db
      .select()
      .from(calendarOauthState)
      .where(eq(calendarOauthState.id, fingerprint(state)));
    expect(left).toEqual([]);
  });

  test("a save that fails hands the tokens back and ends in failed", async () => {
    const state = await startConnect(ana.email);
    const realKey = process.env.CALENDAR_TOKEN_KEY;
    process.env.CALENDAR_TOKEN_KEY = "not-a-key"; // the lock refuses it, so the save throws
    try {
      expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(outcome("failed"));
    } finally {
      process.env.CALENDAR_TOKEN_KEY = realKey;
    }
    expect(revoked).toEqual(["1//refresh-token-from-google"]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
    expect(warnings).toEqual([
      "[calendar] connect failed at the save: CALENDAR_TOKEN_KEY must be 32 random bytes, written in base64.",
    ]);
  });

  test("a full consent saves one row, tokens unreadable, with the Gmail from Google", async () => {
    const state = await startConnect(ana.email);
    // An extra return address in the request is ignored: the dashboard address is fixed.
    const location = await callback(
      `state=${state}&code=abc&redirect=https://elsewhere.example`,
      ana.email
    );
    expect(location).toBe(outcome("connected"));
    expect(warnings).toEqual([]); // a connect that works leaves no warning

    const rows = await connectionsOf(ana.personId);
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.accountEmail).toBe("ana.owner@gmail.com");
    expect(row.status).toBe("connected");
    expect(row.grantedScopes.split(" ")).toEqual(expect.arrayContaining([FREEBUSY, EVENTS_OWNED]));
    expect(row.credentials).not.toContain("refresh-token-from-google");
    expect(row.credentials).not.toContain("access-token-from-google");

    const opened = JSON.parse(decryptCredentials(row.credentials, readTokenKey(), ana.personId));
    expect(opened.refreshToken).toBe("1//refresh-token-from-google");
    expect(() => decryptCredentials(row.credentials, readTokenKey(), ben.personId)).toThrow();
  });

  test("a reconnect replaces the row: still one", async () => {
    await connect(ana.email, "ana.owner@gmail.com"); // its own first connection, not the test above's
    await connect(ana.email, "ana.second@gmail.com");

    const rows = await connectionsOf(ana.personId);
    expect(rows).toHaveLength(1);
    expect(rows[0].accountEmail).toBe("ana.second@gmail.com");
  });

  test("a reconnect with another Gmail hands the old one back, after the new one is saved", async () => {
    await connect(ana.email, "ana.owner@gmail.com", "1//old-account-refresh");
    revoked.length = 0;
    let savedAtHandBack: string[] = [];
    revokeAnswer = async () => {
      savedAtHandBack = (await connectionsOf(ana.personId)).map((row) => row.accountEmail);
      return new Response("", { status: 200 });
    };

    await connect(ana.email, "ana.second@gmail.com", "1//new-account-refresh");
    expect(revoked).toEqual(["1//old-account-refresh"]);
    expect(savedAtHandBack).toEqual(["ana.second@gmail.com"]); // the new one was already saved
    expect(warnings).toEqual([]);
  });

  test("a reconnect with the same Gmail hands nothing back: it is one permission at Google", async () => {
    await connect(ana.email, "ana.owner@gmail.com", "1//first-refresh");
    revoked.length = 0;
    await connect(ana.email, "Ana.Owner@gmail.com", "1//second-refresh"); // Google may change the case
    expect(revoked).toEqual([]);
  });

  test("an old Gmail another connection still uses is kept at Google", async () => {
    await connect(ben.email, "shared@gmail.com", "1//bens-refresh");
    await connect(ana.email, "shared@gmail.com", "1//anas-old-refresh");
    revoked.length = 0;

    await connect(ana.email, "ana.second@gmail.com", "1//anas-new-refresh");
    expect(revoked).toEqual([]);
  });

  test("Google silent on the old account: still connected, one log line, no token", async () => {
    await connect(ana.email, "ana.owner@gmail.com", "1//old-account-refresh");
    revokeAnswer = () => new Response("", { status: 503 });

    await connect(ana.email, "ana.second@gmail.com", "1//new-account-refresh");
    expect((await connectionsOf(ana.personId))[0].accountEmail).toBe("ana.second@gmail.com");
    expect(warnings).toEqual([
      "[calendar] a reconnect with another account could not hand the old one back",
    ]);
  });

  test("a connect that gives up keeps a Gmail another business uses", async () => {
    await connect(ben.email, "shared@gmail.com", "1//bens-refresh");
    revoked.length = 0;
    tokenAnswer = () => googleTokens({ scope: `openid ${FREEBUSY}`, email: "shared@gmail.com" }); // a box unticked
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(
      outcome("missing_permission")
    );
    expect(revoked).toEqual([]);
    expect(await connectionsOf(ben.personId)).toHaveLength(1);
  });

  test("your own reconnect that gives up keeps your working connection", async () => {
    await connect(ana.email, "ana.owner@gmail.com", "1//working-refresh");
    revoked.length = 0;
    tokenAnswer = () => googleTokens({ scope: `openid ${FREEBUSY}`, email: "ana.owner@gmail.com" }); // a box unticked
    const state = await startConnect(ana.email);

    expect(await callback(`state=${state}&code=abc`, ana.email)).toBe(
      outcome("missing_permission")
    );
    expect(revoked).toEqual([]);
    expect(await connectionsOf(ana.personId)).toHaveLength(1);
  });
});

describe("POST /calendar/disconnect", () => {
  const disconnect = (email?: string) => request("/calendar/disconnect", email, "POST");

  test("hands the permission back first, then deletes the row", async () => {
    await connect(ana.email, "ana.owner@gmail.com", "1//anas-refresh");
    revoked.length = 0;
    let rowsAtHandBack = -1;
    revokeAnswer = async () => {
      rowsAtHandBack = (await connectionsOf(ana.personId)).length;
      return new Response("", { status: 200 });
    };

    const response = await disconnect(ana.email);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ atProvider: "handed_back" });
    expect(revoked).toEqual(["1//anas-refresh"]);
    expect(rowsAtHandBack).toBe(1);
    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("Google silent: the row is still deleted, and the answer says Google did not confirm", async () => {
    await connect(ana.email, "ana.owner@gmail.com");
    revokeAnswer = () => new Response("", { status: 503 });

    expect(await (await disconnect(ana.email)).json()).toEqual({ atProvider: "not_confirmed" });
    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("keys that cannot be opened: the row is still deleted, and nothing goes to Google", async () => {
    await connect(ana.email, "ana.owner@gmail.com");
    await db
      .update(calendarConnection)
      .set({ credentials: "v1.cannot.be.opened" })
      .where(eq(calendarConnection.resourceId, ana.personId));
    revoked.length = 0;

    expect(await (await disconnect(ana.email)).json()).toEqual({ atProvider: "not_confirmed" });
    expect(revoked).toEqual([]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("the same Gmail still used by another connection is kept at Google", async () => {
    await connect(ben.email, "shared@gmail.com", "1//bens-refresh");
    await connect(ana.email, "shared@gmail.com", "1//anas-refresh");
    revoked.length = 0;

    expect(await (await disconnect(ana.email)).json()).toEqual({ atProvider: "still_used" });
    expect(revoked).toEqual([]);
    expect(await connectionsOf(ana.personId)).toEqual([]);
    expect(await connectionsOf(ben.personId)).toHaveLength(1);
  });

  test("a connection Google had already stopped accepting says so", async () => {
    await connect(ana.email, "ana.owner@gmail.com");
    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(eq(calendarConnection.resourceId, ana.personId));
    revokeAnswer = () => new Response(JSON.stringify({ error: "invalid_token" }), { status: 400 });

    expect(await (await disconnect(ana.email)).json()).toEqual({ atProvider: "already_stopped" });
    expect(await connectionsOf(ana.personId)).toEqual([]);
  });

  test("only your own: a coworker's connection in the same business stays", async () => {
    await saveCalendarConnection({
      organizationId: ana.organizationId,
      resourceId: coworkerId,
      accountEmail: "coworker@gmail.com",
      grantedScopes: [FREEBUSY, EVENTS_OWNED],
      credentials: {
        refreshToken: "1//coworkers-refresh",
        accessToken: "ya29.coworkers-access",
        accessTokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    await connect(ana.email, "ana.owner@gmail.com");
    revoked.length = 0;

    expect((await disconnect(ana.email)).status).toBe(200);
    expect(await connectionsOf(coworkerId)).toHaveLength(1);
    expect(revoked).not.toContain("1//coworkers-refresh");
  });

  test("nothing connected is 404", async () => {
    const response = await disconnect(ana.email);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("not_found");
  });

  test("a login with no person is refused plainly", async () => {
    const response = await disconnect(noPerson.email);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("no_person");
  });

  test("no session is 401, and a plan without booking is 403", async () => {
    expect((await disconnect()).status).toBe(401);
    expect((await disconnect(noBooking.email)).status).toBe(403);
  });
});

describe("GET /calendar/connection", () => {
  test("a login with no person gets person: null", async () => {
    const response = await request("/calendar/connection", noPerson.email);
    expect(await response.json()).toEqual({ person: null, connection: null });
  });

  test("a person with no connection gets connection: null", async () => {
    const response = await request("/calendar/connection", ben.email);
    expect(await response.json()).toEqual({
      person: { id: ben.personId, name: ben.slug },
      connection: null,
    });
  });

  test("a connection comes without the tokens or the permission list", async () => {
    await connect(ana.email, "ana.second@gmail.com"); // its own, so it passes run alone
    const response = await request("/calendar/connection", ana.email);
    const text = await response.text();

    expect(JSON.parse(text).connection).toEqual({
      provider: "google",
      accountEmail: "ana.second@gmail.com",
      status: "connected",
      lastCheckedAt: null,
    });
    expect(text).not.toContain("credentials");
    expect(text).not.toContain("grantedScopes");
    expect(text).not.toContain("v1.");
  });

  test("no session is refused with 401", async () => {
    expect((await request("/calendar/connection")).status).toBe(401);
  });
});
