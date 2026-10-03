// A business's own Resend key: saved only after its test email went, kept locked, read back
// only inside its own business. Against the local database, Resend faked; every business here
// is a throwaway carrying this run's tag, removed after (its key goes with it).

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the email key tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const { emailSendingKey, organization } = await import("@scheduleads-app/shared/db");
const { saveEmailSendingKey } = await import("./save-email-sending-key.js");
const { findBusinessEmailDetails } = await import("./find-business-email-details.js");

const tag = randomUUID().slice(0, 8);
let resendAnswer: () => Response;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function makeBusiness(name: string, details: Partial<typeof organization.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(organization).values({
    id,
    name: `Primo ${name}`,
    slug: `test-email-key-${name}-${tag}`,
    senderEmail: "bookings@primopainters.com",
    notifyEmail: "office@primopainters.com",
    ...details,
  });
  return id;
}

const storedKey = async (organizationId: string) =>
  (
    await db
      .select()
      .from(emailSendingKey)
      .where(eq(emailSendingKey.organizationId, organizationId))
  )[0];

beforeEach(() => {
  resendAnswer = () => json({ id: "email-1" });
  vi.stubGlobal("fetch", async () => resendAnswer());
  vi.spyOn(console, "error").mockImplementation(() => {}); // the library's own line outside production
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-email-key-%-${tag}`));
  await db.$client.end();
});

describe("a business's own Resend key", () => {
  test("is stored locked only after its test email went, and reads back inside its business", async () => {
    const business = await makeBusiness("saved");

    const result = await saveEmailSendingKey(business, "re_business_key_123");

    expect(result).toEqual({ ok: true, savedAt: expect.any(Date) });
    const row = await storedKey(business);
    expect(row.credentials).not.toContain("re_business_key_123"); // locked, not stored as typed
    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_business_key_123");
  });

  test("a refused test stores nothing, and an earlier key stays in use", async () => {
    const business = await makeBusiness("refused");
    await saveEmailSendingKey(business, "re_first_key_123");
    resendAnswer = () => json({ name: "invalid_api_key", statusCode: 401, message: "no" }, 401);

    const result = await saveEmailSendingKey(business, "re_second_key_456");

    expect(result).toEqual({ ok: false, reason: "Resend refused this key." });
    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_first_key_123");
  });

  test("a new key replaces the old one", async () => {
    const business = await makeBusiness("replaced");
    await saveEmailSendingKey(business, "re_first_key_123");

    await saveEmailSendingKey(business, "re_second_key_456");

    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_second_key_456");
    expect(
      await db.select().from(emailSendingKey).where(eq(emailSendingKey.organizationId, business))
    ).toHaveLength(1);
  });

  test("a business without its two addresses is asked for them first, and nothing is sent", async () => {
    const business = await makeBusiness("no-addresses", { senderEmail: null });
    const fetchSpy = vi.fn(async () => resendAnswer());
    vi.stubGlobal("fetch", fetchSpy);

    const result = await saveEmailSendingKey(business, "re_business_key_123");

    expect(result).toEqual({
      ok: false,
      reason: "Set the address emails come from and where notifications go first.",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(await storedKey(business)).toBeUndefined();
  });

  test("a stored key cannot be opened as another business's", async () => {
    const mine = await makeBusiness("mine");
    const other = await makeBusiness("other");
    await saveEmailSendingKey(mine, "re_mine_key_123");
    // Copied by hand onto the other business: the lock is bound to the first one.
    const { credentials } = await storedKey(mine);
    await db.insert(emailSendingKey).values({ organizationId: other, credentials });

    await expect(findBusinessEmailDetails(other)).rejects.toThrow();
    expect((await findBusinessEmailDetails(mine))?.apiKey).toBe("re_mine_key_123");
  });

  test("the reader gives one business's details and never another's", async () => {
    const mine = await makeBusiness("details", { phone: "403 555 0100", brandColor: "#1d4ed8" });
    await makeBusiness("someone-else", { phone: "999", brandColor: "#000000" });

    expect(await findBusinessEmailDetails(mine)).toEqual({
      name: "Primo details",
      logo: null,
      senderEmail: "bookings@primopainters.com",
      notifyEmail: "office@primopainters.com",
      phone: "403 555 0100",
      website: null,
      brandColor: "#1d4ed8",
      timezone: null,
      apiKey: null,
    });
    expect(await findBusinessEmailDetails(randomUUID())).toBeNull();
  });
});
