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
const { saveEmailSending } = await import("./save-email-sending.js");
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

const addresses = {
  senderEmail: "bookings@primopainters.com",
  notifyEmail: "office@primopainters.com",
};

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

    const result = await saveEmailSending(business, { ...addresses, key: "re_business_key_123" });

    expect(result).toEqual({
      ok: true,
      state: { ...addresses, keySavedAt: expect.any(String) },
    });
    const row = await storedKey(business);
    expect(row.credentials).not.toContain("re_business_key_123"); // locked, not stored as typed
    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_business_key_123");
  });

  test("a refused test stores nothing, and an earlier key stays in use", async () => {
    const business = await makeBusiness("refused");
    await saveEmailSending(business, { ...addresses, key: "re_first_key_123" });
    resendAnswer = () => json({ name: "invalid_api_key", statusCode: 401, message: "no" }, 401);

    const result = await saveEmailSending(business, { ...addresses, key: "re_second_key_456" });

    expect(result).toEqual({ ok: false, reason: "Resend refused this key." });
    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_first_key_123");
  });

  test("a new key replaces the old one", async () => {
    const business = await makeBusiness("replaced");
    await saveEmailSending(business, { ...addresses, key: "re_first_key_123" });

    await saveEmailSending(business, { ...addresses, key: "re_second_key_456" });

    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_second_key_456");
    expect(
      await db.select().from(emailSendingKey).where(eq(emailSendingKey.organizationId, business))
    ).toHaveLength(1);
  });

  test("a key that can no longer be unlocked is still replaced by a new one", async () => {
    const business = await makeBusiness("unreadable");
    await db
      .insert(emailSendingKey)
      .values({ organizationId: business, credentials: "v1.broken.key.here" });

    const result = await saveEmailSending(business, { ...addresses, key: "re_new_key_456" });

    expect(result).toEqual({
      ok: true,
      state: { ...addresses, keySavedAt: expect.any(String) },
    });
    expect((await findBusinessEmailDetails(business))?.apiKey).toBe("re_new_key_456");
  });

  test("a business set up without addresses gets them from the card, with no key and no email", async () => {
    const business = await makeBusiness("no-addresses", { senderEmail: null, notifyEmail: null });
    const fetchSpy = vi.fn(async () => resendAnswer());
    vi.stubGlobal("fetch", fetchSpy);

    const result = await saveEmailSending(business, { ...addresses, key: null });

    expect(result).toEqual({ ok: true, state: { ...addresses, keySavedAt: null } });
    expect(fetchSpy).not.toHaveBeenCalled(); // no key, so nothing to test
  });

  test("a new address with a key already saved is tested from the new address, and a refusal keeps the old ones", async () => {
    const business = await makeBusiness("moved");
    await saveEmailSending(business, { ...addresses, key: "re_saved_key_123" });
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return json({ name: "validation_error", statusCode: 403, message: "not verified" }, 403);
    });
    const moved = { senderEmail: "hello@newdomain.com", notifyEmail: "desk@newdomain.com" };

    const result = await saveEmailSending(business, { ...moved, key: null });

    expect(result).toEqual({
      ok: false,
      reason:
        "Resend would not send from this address. Check that its domain is verified in the same Resend account, and that the key may send from it.",
    });
    expect(bodies[0]).toMatchObject({ to: ["desk@newdomain.com"] });
    expect(String(bodies[0].from)).toContain("<hello@newdomain.com>");
    const details = await findBusinessEmailDetails(business);
    expect(details).toMatchObject({ ...addresses, apiKey: "re_saved_key_123" }); // nothing changed
  });

  test("a saved key that can no longer be opened is asked for again", async () => {
    const business = await makeBusiness("lost-key");
    await db
      .insert(emailSendingKey)
      .values({ organizationId: business, credentials: "v1.broken.key.here" });

    const result = await saveEmailSending(business, { ...addresses, key: null });

    expect(result).toEqual({
      ok: false,
      reason: "The saved key can no longer be read. Paste it again.",
    });
  });

  test("a stored key cannot be opened as another business's", async () => {
    const mine = await makeBusiness("mine");
    const other = await makeBusiness("other");
    await saveEmailSending(mine, { ...addresses, key: "re_mine_key_123" });
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
