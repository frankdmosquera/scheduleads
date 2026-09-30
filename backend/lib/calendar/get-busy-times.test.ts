// getBusyTimes against the local database, with Google faked: no test ever reaches Google.
// The business and person are throwaways made below and removed after.

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL, the token key and the Google values.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the busy times tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { calendarConnection, organization, resource } = await import("@scheduleads-app/shared/db");
const { decryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { getBusyTimes } = await import("./get-busy-times.js");
const { saveCalendarConnection } = await import("./save-calendar-connection.js");
const { CalendarReconnectNeededError } = await import("./calendar-reconnect-needed-error.js");

const tag = randomUUID().slice(0, 8);
const business = { id: randomUUID(), slug: `test-busy-times-${tag}-dev` };
const personId = randomUUID();
const range = {
  organizationId: business.id,
  resourceId: personId,
  from: new Date("2026-10-01T06:00:00Z"),
  to: new Date("2026-10-08T06:00:00Z"),
};

// Google's side, faked: the answers each test sets, and every call made.
type AnswerType = () => Response | Promise<Response>;
let tokenAnswer: AnswerType;
let freeBusyAnswer: AnswerType;
const tokenCalls: URLSearchParams[] = [];
const freeBusyCalls: { authorization: string | null; body: Record<string, unknown> }[] = [];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const freshToken = (accessToken = "ya29.fresh-access") =>
  json({ access_token: accessToken, expires_in: 3599, token_type: "Bearer" });
const busyAnswer = (busy: { start: string; end: string }[]) =>
  json({ kind: "calendar#freeBusy", calendars: { primary: { busy } } });

async function connect({
  accessToken = "ya29.saved-access",
  refreshToken = "1//saved-refresh",
  expiresInMs = 60 * 60 * 1000,
} = {}): Promise<void> {
  await saveCalendarConnection({
    organizationId: business.id,
    resourceId: personId,
    accountEmail: "ana.owner@gmail.com",
    grantedScopes: ["openid", "email"],
    credentials: {
      refreshToken,
      accessToken,
      accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    },
  });
}

async function storedConnection() {
  const [row] = await db
    .select()
    .from(calendarConnection)
    .where(eq(calendarConnection.resourceId, personId));
  return {
    ...row,
    unlocked: JSON.parse(decryptCredentials(row.credentials, readTokenKey(), personId)),
  };
}

beforeAll(async () => {
  await db
    .insert(organization)
    .values({ id: business.id, name: business.slug, slug: business.slug });
  await db
    .insert(resource)
    .values({ id: personId, organizationId: business.id, name: "Ana", kind: "person" });

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url === "https://oauth2.googleapis.com/token") {
      tokenCalls.push(new URLSearchParams(String(init?.body)));
      return tokenAnswer();
    }
    if (url === "https://www.googleapis.com/calendar/v3/freeBusy") {
      const headers = new Headers(init?.headers);
      freeBusyCalls.push({
        authorization: headers.get("Authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return freeBusyAnswer();
    }
    throw new Error(`A test tried to reach ${url}.`);
  });
});

beforeEach(async () => {
  tokenCalls.length = 0;
  freeBusyCalls.length = 0;
  tokenAnswer = () => freshToken();
  freeBusyAnswer = () => busyAnswer([]);
  await db.delete(calendarConnection).where(eq(calendarConnection.resourceId, personId));
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete(organization).where(eq(organization.id, business.id)); // the person and connection go with it
  await db.$client.end();
});

describe("getBusyTimes", () => {
  test("no connection is an empty list, and Google is never asked", async () => {
    expect(await getBusyTimes(range)).toEqual([]);
    expect(tokenCalls).toHaveLength(0);
    expect(freeBusyCalls).toHaveLength(0);
  });

  test("a key with time left is not refreshed, and the main calendar's busy blocks come back", async () => {
    await connect();
    freeBusyAnswer = () =>
      busyAnswer([{ start: "2026-10-01T16:00:00Z", end: "2026-10-01T17:00:00Z" }]);

    expect(await getBusyTimes(range)).toEqual([
      { start: new Date("2026-10-01T16:00:00Z"), end: new Date("2026-10-01T17:00:00Z") },
    ]);
    expect(tokenCalls).toHaveLength(0);
    expect(freeBusyCalls).toEqual([
      {
        authorization: "Bearer ya29.saved-access",
        body: {
          timeMin: "2026-10-01T06:00:00.000Z",
          timeMax: "2026-10-08T06:00:00.000Z",
          items: [{ id: "primary" }],
        },
      },
    ]);
    expect((await storedConnection()).lastCheckedAt).toBeInstanceOf(Date);
  });

  test("a key with under a minute left is refreshed once, used, and saved locked", async () => {
    await connect({ expiresInMs: 30 * 1000 });

    await getBusyTimes(range);
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0].get("grant_type")).toBe("refresh_token");
    expect(tokenCalls[0].get("refresh_token")).toBe("1//saved-refresh");
    expect(freeBusyCalls[0].authorization).toBe("Bearer ya29.fresh-access");

    const stored = await storedConnection();
    expect(stored.unlocked.accessToken).toBe("ya29.fresh-access");
    expect(stored.unlocked.refreshToken).toBe("1//saved-refresh"); // Google sent none, so the saved one stays
    expect(stored.credentials).not.toContain("ya29.fresh-access");

    await getBusyTimes(range); // the saved key now has an hour left
    expect(tokenCalls).toHaveLength(1);
    expect(freeBusyCalls[1].authorization).toBe("Bearer ya29.fresh-access");
  });

  test("Google refusing the refresh marks the connection needs_reconnect and throws", async () => {
    await connect({ expiresInMs: 0 });
    tokenAnswer = () =>
      json(
        { error: "invalid_grant", error_description: "Token has been expired or revoked." },
        400
      );

    await expect(getBusyTimes(range)).rejects.toBeInstanceOf(CalendarReconnectNeededError);
    expect((await storedConnection()).status).toBe("needs_reconnect");
    expect(freeBusyCalls).toHaveLength(0);
  });

  test("Google down during a refresh throws but leaves the connection connected", async () => {
    await connect({ expiresInMs: 0 });
    tokenAnswer = () => json({ error: "internal_failure" }, 503);

    const failure = getBusyTimes(range);
    await expect(failure).rejects.toThrow("Google refused the refresh (503 internal_failure).");
    await expect(failure).rejects.not.toBeInstanceOf(CalendarReconnectNeededError);
    expect((await storedConnection()).status).toBe("connected");
  });

  test("a connection already needing a reconnect throws without asking Google", async () => {
    await connect();
    await db
      .update(calendarConnection)
      .set({ status: "needs_reconnect" })
      .where(eq(calendarConnection.resourceId, personId));

    await expect(getBusyTimes(range)).rejects.toBeInstanceOf(CalendarReconnectNeededError);
    expect(tokenCalls).toHaveLength(0);
    expect(freeBusyCalls).toHaveLength(0);
  });

  test("a Google error on free/busy throws, never an empty list", async () => {
    await connect();
    freeBusyAnswer = () => json({ error: { code: 500 } }, 500);
    await expect(getBusyTimes(range)).rejects.toThrow("Google's free/busy failed (500).");
  });

  test("a time-out on free/busy throws", async () => {
    await connect();
    freeBusyAnswer = () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    };
    await expect(getBusyTimes(range)).rejects.toThrow("timeout");
  });

  test("a calendar Google could not read throws, although its busy list is empty", async () => {
    await connect();
    freeBusyAnswer = () =>
      json({
        calendars: { primary: { busy: [], errors: [{ domain: "global", reason: "notFound" }] } },
      });
    await expect(getBusyTimes(range)).rejects.toThrow(
      "Google could not read the calendar's busy times (notFound)."
    );
  });

  test("a reconnect at the same moment as a refresh is not overwritten", async () => {
    await connect({ expiresInMs: 0 });
    tokenAnswer = async () => {
      // The person reconnects while the refresh is on its way back from Google.
      await connect({
        accessToken: "ya29.reconnected-access",
        refreshToken: "1//reconnected-refresh",
      });
      return freshToken("ya29.old-account-fresh");
    };

    await getBusyTimes(range);
    const stored = await storedConnection();
    expect(stored.unlocked.accessToken).toBe("ya29.reconnected-access");
    expect(stored.unlocked.refreshToken).toBe("1//reconnected-refresh");
    expect(freeBusyCalls.map((call) => call.authorization)).toEqual([
      "Bearer ya29.reconnected-access",
    ]);
  });

  test("a range that does not move forward is refused", async () => {
    await expect(getBusyTimes({ ...range, to: range.from })).rejects.toThrow(
      "The time range must end after it starts."
    );
  });
});
