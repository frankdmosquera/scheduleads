// Setting up a client, called through the real app against the local database. Every login
// and business here is a throwaway carrying this run's tag, removed after.

import { randomUUID } from "node:crypto";

import { eq, like, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

// The sign-in helper reads codes from the console, so these tests never send a real email, even
// when .env holds the agency's Resend key.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the admin route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin, auth } = await import("../lib/auth/auth-server.js");
const {
  clientSetupClaim,
  emailSendingKey,
  invitation,
  member,
  organization,
  pipelineStage,
  resource,
  user,
} = await import("@scheduleads-app/shared/db");
const { decryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");

const tag = randomUUID().slice(0, 8);
const email = (name: string) => `admin-${name}-${tag}@example.com`;
const businessName = (name: string) => `Test Provision ${name} ${tag}`;
const slugOf = (name: string) => `test-provision-${name}-${tag}`;

const platformAdmin = { id: randomUUID(), email: email("frank") }; // belongs to no business
const owner = { id: randomUUID(), email: email("owner"), organizationId: randomUUID() };
const unfinished = { id: randomUUID(), email: email("unfinished") }; // a login, no business

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

const setUp = (body: unknown, as?: string) =>
  app.request("/admin/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: appOrigin,
      ...(as ? { Cookie: cookies.get(as)! } : {}),
    },
    body: JSON.stringify(body),
  });

const client = (name: string) => ({
  businessName: businessName(name),
  clientName: `Client ${name}`,
  clientEmail: email(name),
});

const loginsWith = (address: string) => db.select().from(user).where(eq(user.email, address));
const businessesWith = (slug: string) =>
  db.select().from(organization).where(eq(organization.slug, slug));

beforeAll(async () => {
  await db.insert(user).values([
    {
      id: platformAdmin.id,
      name: "",
      email: platformAdmin.email,
      emailVerified: true,
      role: "admin",
    },
    { id: owner.id, name: "", email: owner.email, emailVerified: true },
    { id: unfinished.id, name: "Unfinished", email: unfinished.email },
  ]);
  await db.insert(organization).values({
    id: owner.organizationId,
    name: businessName("taken"),
    slug: slugOf("taken"),
  });
  await db.insert(member).values({
    id: randomUUID(),
    organizationId: owner.organizationId,
    userId: owner.id,
    role: "owner",
  });

  for (const address of [platformAdmin.email, owner.email]) {
    cookies.set(address, await signIn(address));
  }
});

afterAll(async () => {
  // Their members and people go with the businesses (cascade); sessions with the logins.
  await db.delete(organization).where(like(organization.slug, `test-provision-%-${tag}`));
  await db.delete(user).where(like(user.email, `admin-%-${tag}@example.com`));
  await db
    .delete(clientSetupClaim)
    .where(
      or(
        like(clientSetupClaim.key, `email:admin-%-${tag}@example.com`),
        like(clientSetupClaim.key, `slug:test-provision-%-${tag}`)
      )
    );
  await db.$client.end();
});

describe("POST /admin/clients", () => {
  test("no session is refused with 401", async () => {
    expect((await setUp(client("nobody"))).status).toBe(401);
  });

  test("a business owner who is not the platform admin is refused with 403", async () => {
    const response = await setUp(client("by-owner"), owner.email);
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("forbidden");
    expect(await loginsWith(email("by-owner"))).toHaveLength(0);
  });

  test.each([
    ["a bad email", { clientEmail: "not-an-email" }],
    ["no client name", { clientName: " " }],
    ["a name with no letters or digits", { businessName: "!! ??" }],
  ])("%s is refused with 400 and makes nothing", async (_name, change) => {
    const response = await setUp({ ...client("bad"), ...change }, platformAdmin.email);
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("bad_request");
    expect(await loginsWith(email("bad"))).toHaveLength(0);
  });

  test("the platform admin sets up a client: the client owns it, the admin is not in it", async () => {
    const response = await setUp(
      { ...client("primo"), clientEmail: `  Admin-Primo-${tag}@Example.com ` },
      platformAdmin.email
    );
    expect(response.status).toBe(201);
    const answer = await response.json();
    expect(answer.organization).toMatchObject({
      name: businessName("primo"),
      slug: slugOf("primo"),
    });
    expect(answer.client).toMatchObject({ name: "Client primo", email: email("primo") });

    const [login] = await loginsWith(email("primo"));
    expect(login).toMatchObject({ id: answer.client.id, role: "user" });

    const [business] = await businessesWith(slugOf("primo"));
    expect(business).toMatchObject({ id: answer.organization.id, plan: "agency" });

    const members = await db.select().from(member).where(eq(member.organizationId, business.id));
    expect(members).toEqual([expect.objectContaining({ userId: login.id, role: "owner" })]);

    const stages = await db
      .select({ name: pipelineStage.name, position: pipelineStage.position })
      .from(pipelineStage)
      .where(eq(pipelineStage.organizationId, business.id))
      .orderBy(pipelineStage.position);
    expect(stages.map((stage) => stage.name)).toEqual(["New", "Contacted", "Booked", "Done"]);

    const people = await db.select().from(resource).where(eq(resource.organizationId, business.id));
    expect(people).toEqual([
      expect.objectContaining({ name: businessName("primo"), kind: "person", userId: login.id }),
    ]);

    const adminMemberships = await db
      .select()
      .from(member)
      .where(eq(member.userId, platformAdmin.id));
    expect(adminMemberships).toHaveLength(0);
  });

  test("the new client signs in and lands in their own business as owner", async () => {
    await setUp(client("signs-in"), platformAdmin.email);
    const cookie = await signIn(email("signs-in"));

    const response = await app.request("/me", { headers: { Cookie: cookie, Origin: appOrigin } });
    expect(response.status).toBe(200);
    const me = await response.json();
    expect(me.organization.slug).toBe(slugOf("signs-in"));
    expect(me.role).toBe("owner");
  });

  test("an email whose login has a business is refused with 409 and makes nothing", async () => {
    const response = await setUp(
      { ...client("second"), clientEmail: owner.email },
      platformAdmin.email
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("email_taken");
    expect(await businessesWith(slugOf("second"))).toHaveLength(0);
  });

  test("the platform admin's own email is refused, though it belongs to no business", async () => {
    const response = await setUp(
      { ...client("admin-own"), clientEmail: platformAdmin.email },
      platformAdmin.email
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("email_taken");
    expect(await businessesWith(slugOf("admin-own"))).toHaveLength(0);
  });

  test("a login with no business is an unfinished setup: setting it up again finishes it", async () => {
    const response = await setUp(
      { ...client("finished"), clientEmail: unfinished.email },
      platformAdmin.email
    );
    expect(response.status).toBe(201);
    const answer = await response.json();
    expect(answer.client).toMatchObject({ id: unfinished.id, name: "Client finished" });
    expect(await loginsWith(unfinished.email)).toEqual([
      expect.objectContaining({ id: unfinished.id, name: "Client finished" }), // was "Unfinished"
    ]);

    const [business] = await businessesWith(slugOf("finished"));
    const members = await db.select().from(member).where(eq(member.organizationId, business.id));
    expect(members).toEqual([expect.objectContaining({ userId: unfinished.id, role: "owner" })]);
  });

  test("a taken address is refused with 409 and leaves no login behind", async () => {
    const response = await setUp(
      { ...client("dupe"), businessName: businessName("taken") },
      platformAdmin.email
    );
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("slug_taken");
    expect(await loginsWith(email("dupe"))).toHaveLength(0);
  });

  test("a business that fails to be made takes its new login away again", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi
      .spyOn(auth.api, "createOrganization")
      .mockRejectedValueOnce(new Error("the database went away"));

    const response = await setUp(client("fails"), platformAdmin.email);

    failing.mockRestore();
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(await loginsWith(email("fails"))).toHaveLength(0);
  });

  test("a failure while finishing an unfinished setup leaves that login in place", async () => {
    const leftOver = { id: randomUUID(), email: email("left-over") };
    await db.insert(user).values({ id: leftOver.id, name: "Left over", email: leftOver.email });

    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi
      .spyOn(auth.api, "createOrganization")
      .mockRejectedValueOnce(new Error("the database went away"));

    const response = await setUp(
      { ...client("left-over"), clientEmail: leftOver.email },
      platformAdmin.email
    );

    failing.mockRestore();
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(await loginsWith(leftOver.email)).toEqual([
      expect.objectContaining({ id: leftOver.id }),
    ]);
  });
  // Better Auth saves the business, then something fails (here, right after the save).
  test("a failure after the business is saved removes the business and the new login", async () => {
    const original = auth.api.createOrganization;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi
      .spyOn(auth.api, "createOrganization")
      .mockImplementationOnce(async (call: Parameters<typeof original>[0]) => {
        await original(call);
        throw new Error("the first person could not be saved");
      });

    const response = await setUp(client("half-made"), platformAdmin.email);

    failing.mockRestore();
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(await businessesWith(slugOf("half-made"))).toHaveLength(0);
    expect(await loginsWith(email("half-made"))).toHaveLength(0);
  });

  test("the same failure while finishing an unfinished setup keeps that login, ready to retry", async () => {
    const leftOver = { id: randomUUID(), email: email("half-left") };
    await db.insert(user).values({ id: leftOver.id, name: "Half left", email: leftOver.email });

    const original = auth.api.createOrganization;
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = vi
      .spyOn(auth.api, "createOrganization")
      .mockImplementationOnce(async (call: Parameters<typeof original>[0]) => {
        await original(call);
        throw new Error("the first person could not be saved");
      });

    const body = { ...client("half-left"), clientEmail: leftOver.email };
    const response = await setUp(body, platformAdmin.email);

    failing.mockRestore();
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(await businessesWith(slugOf("half-left"))).toHaveLength(0);
    expect(await loginsWith(leftOver.email)).toEqual([
      expect.objectContaining({ id: leftOver.id }),
    ]);
    expect((await setUp(body, platformAdmin.email)).status).toBe(201); // the retry finishes it
  });

  // A double click. The first setup is held mid-way, holding its claims, and the second is
  // only sent once the first is in there, so the two truly overlap on any machine.
  const holdFirstSetup = () => {
    const original = auth.api.createOrganization;
    let firstIsInside: () => void = () => {};
    const inside = new Promise<void>((resolve) => (firstIsInside = resolve));
    const spy = vi
      .spyOn(auth.api, "createOrganization")
      .mockImplementationOnce(async (call: Parameters<typeof original>[0]) => {
        firstIsInside();
        await new Promise((resolve) => setTimeout(resolve, 300));
        return original(call);
      });
    return { inside, spy };
  };

  const claimsFor = (address: string, slug: string) =>
    db
      .select()
      .from(clientSetupClaim)
      .where(
        or(eq(clientSetupClaim.key, `email:${address}`), eq(clientSetupClaim.key, `slug:${slug}`))
      );

  test("two overlapping setups for one email and one business make one business with its owner", async () => {
    const held = holdFirstSetup();
    const firstSent = setUp(client("double"), platformAdmin.email);
    await held.inside;
    const [first, second] = await Promise.all([
      firstSent,
      setUp(client("double"), platformAdmin.email),
    ]);
    held.spy.mockRestore();

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("setup_in_progress");

    const [login] = await loginsWith(email("double"));
    expect(login.id).toBe((await first.json()).client.id);
    const [business] = await businessesWith(slugOf("double"));
    const members = await db.select().from(member).where(eq(member.organizationId, business.id));
    expect(members).toEqual([expect.objectContaining({ userId: login.id, role: "owner" })]);

    // Once the first is done its claims are gone, and the same setup again is simply taken.
    expect(await claimsFor(email("double"), slugOf("double"))).toHaveLength(0);
    const again = await setUp(client("double"), platformAdmin.email);
    expect((await again.json()).error.code).toBe("email_taken");
  });

  test("two overlapping setups for one email and two businesses give the client only one", async () => {
    const held = holdFirstSetup();
    const firstSent = setUp(client("twice-a"), platformAdmin.email);
    await held.inside;
    const [first, second] = await Promise.all([
      firstSent,
      setUp({ ...client("twice-b"), clientEmail: email("twice-a") }, platformAdmin.email),
    ]);
    held.spy.mockRestore();

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect((await second.json()).error.code).toBe("setup_in_progress");
    const [login] = await loginsWith(email("twice-a"));
    expect(await db.select().from(member).where(eq(member.userId, login.id))).toHaveLength(1);
    expect(await businessesWith(slugOf("twice-b"))).toHaveLength(0);
  });

  test("a claim held by another setup makes this one wait, and is left alone", async () => {
    await db
      .insert(clientSetupClaim)
      .values({ key: `email:${email("claimed")}`, claimId: "other" });

    const response = await setUp(client("claimed"), platformAdmin.email);

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("setup_in_progress");
    expect(await loginsWith(email("claimed"))).toHaveLength(0);
    expect(await businessesWith(slugOf("claimed"))).toHaveLength(0);
    // Its own address claim is released; the other setup's email claim stays.
    expect(await claimsFor(email("claimed"), slugOf("claimed"))).toEqual([
      expect.objectContaining({ key: `email:${email("claimed")}`, claimId: "other" }),
    ]);
  });

  test("a claim older than five minutes belongs to a setup that died, and is cleared", async () => {
    await db.insert(clientSetupClaim).values({
      key: `email:${email("stale")}`,
      claimId: "died",
      claimedAt: new Date(Date.now() - 10 * 60 * 1000),
    });

    expect((await setUp(client("stale"), platformAdmin.email)).status).toBe(201);
    expect(await claimsFor(email("stale"), slugOf("stale"))).toHaveLength(0);
  });

  test("more setups at once than the API has connections all finish, and the API keeps answering", async () => {
    const many = Array.from({ length: 14 }, (_, n) => client(`crowd-${n}`));
    const answers = await Promise.all(many.map((body) => setUp(body, platformAdmin.email)));
    expect(answers.map((answer) => answer.status)).toEqual(many.map(() => 201));
    expect((await app.request("/health")).status).toBe(200);
  }, 15_000);

  // A real database error inside the login's creation must not print the client's email.
  test("a database error while making the login leaves no email in the log", async () => {
    const logged: string[] = [];
    const quiet = vi.spyOn(console, "error").mockImplementation((...parts) => {
      logged.push(
        parts
          .map((part) => (part instanceof Error ? `${part.message} ${part.stack}` : String(part)))
          .join(" ")
      );
    });
    const failing = vi.spyOn(auth.api, "createUser").mockImplementationOnce(async () => {
      // A duplicate id: Postgres refuses, and drizzle's error carries the query and its values.
      await db.insert(user).values({ id: platformAdmin.id, name: "", email: email("logged") });
      throw new Error("unreachable");
    });

    const response = await setUp(client("logged"), platformAdmin.email);

    failing.mockRestore();
    quiet.mockRestore();
    expect(response.status).toBe(500);
    expect(logged.length).toBeGreaterThan(0);
    for (const line of logged) expect(line).not.toContain(email("logged"));
  });
});

describe("the business's email details at setup (feature 6)", () => {
  const resendCalls: { headers: Headers; body: Record<string, unknown> }[] = [];
  let resendAnswer: () => Response = () => new Response("{}");
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  beforeAll(() => {
    // Only the key's test email reaches out; it never leaves the machine.
    vi.stubGlobal("fetch", async (_url: RequestInfo | URL, init?: RequestInit) => {
      resendCalls.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return resendAnswer();
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  test("setup stores the details, the owner's email standing in for an empty notification address", async () => {
    const response = await setUp(
      {
        ...client("details"),
        senderEmail: " Bookings@Example.com ",
        notifyEmail: "",
        phone: "403 555 0100",
        website: "https://example.com",
        brandColor: "#1D4ED8",
      },
      platformAdmin.email
    );

    expect(response.status).toBe(201);
    const [business] = await businessesWith(slugOf("details"));
    expect(business).toMatchObject({
      senderEmail: "bookings@example.com",
      notifyEmail: email("details"),
      phone: "403 555 0100",
      website: "https://example.com",
      brandColor: "#1d4ed8",
    });
  });

  test.each([
    [
      "a colour that is not #rrggbb",
      "colour",
      { brandColor: "blue" },
      "Use a colour like #1d4ed8.",
    ],
    [
      "a website without https",
      "website",
      { website: "http://example.com" },
      "Use the full website address, starting https://",
    ],
    [
      "a sender that is not an email",
      "sender",
      { senderEmail: "bookings" },
      "Enter a valid email address.",
    ],
    [
      "a key without a sender to test it from",
      "unsent-key",
      { emailSendingKey: "re_business_key_123" },
      "Enter the address emails come from, so the key can be tested.",
    ],
  ])("%s is refused with 400 and makes nothing", async (_name, name, change, message) => {
    const response = await setUp({ ...client(name), ...change }, platformAdmin.email);

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(message);
    expect(await loginsWith(email(name))).toHaveLength(0);
  });

  test("a key whose test email went is stored locked, and never comes back in an answer or a log line", async () => {
    resendAnswer = () => json({ id: "email-1" });
    resendCalls.length = 0;
    const spies = ["log", "info", "warn", "error"].map((level) =>
      vi.spyOn(console, level as "log").mockImplementation(() => {})
    );

    const response = await setUp(
      {
        ...client("keyed"),
        senderEmail: "bookings@example.com",
        emailSendingKey: "re_business_key_123",
      },
      platformAdmin.email
    );
    const text = await response.text();
    const lines = spies.flatMap((spy) => spy.mock.calls.flat().map(String));
    for (const spy of spies) spy.mockRestore();

    expect(response.status).toBe(201);
    expect(text).not.toContain("re_business_key_123");
    for (const line of lines) expect(line).not.toContain("re_business_key_123");
    expect(resendCalls).toHaveLength(1);
    expect(resendCalls[0].headers.get("Authorization")).toBe("Bearer re_business_key_123");
    expect(resendCalls[0].body).toMatchObject({
      from: `${businessName("keyed")} <bookings@example.com>`,
      to: [email("keyed")],
    });
    const [business] = await businessesWith(slugOf("keyed"));
    const [stored] = await db
      .select()
      .from(emailSendingKey)
      .where(eq(emailSendingKey.organizationId, business.id));
    expect(stored.credentials).not.toContain("re_business_key_123");
    expect(decryptCredentials(stored.credentials, readTokenKey(), business.id)).toBe(
      "re_business_key_123"
    );
  });

  test("a key whose test email is refused answers 422 with the reason and makes nothing", async () => {
    resendAnswer = () => json({ name: "invalid_api_key", statusCode: 401, message: "no" }, 401);
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await setUp(
      {
        ...client("refused-key"),
        senderEmail: "bookings@example.com",
        emailSendingKey: "re_wrong_key_123",
      },
      platformAdmin.email
    );
    quiet.mockRestore();

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: { code: "key_refused", message: "Resend refused this key." },
    });
    expect(await loginsWith(email("refused-key"))).toHaveLength(0);
    expect(await businessesWith(slugOf("refused-key"))).toHaveLength(0);
  });
});

describe("the /admin routes keep the dashboard's guards", () => {
  test("an answer is never cached", async () => {
    const response = await setUp(client("cached"), platformAdmin.email);
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("a form posted from another website with the platform admin's login is refused", async () => {
    const response = await app.request("/admin/clients", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: "https://another-site.example",
        Cookie: cookies.get(platformAdmin.email)!,
      },
      body: new URLSearchParams(client("cross-site")).toString(),
    });
    expect(response.status).toBe(403);
    expect(await loginsWith(email("cross-site"))).toHaveLength(0);
  });
});

describe("Better Auth's own ways into a business are closed", () => {
  test("the platform admin's own Better Auth create is refused and makes nothing", async () => {
    const response = await app.request("/api/auth/organization/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
        Cookie: cookies.get(platformAdmin.email)!,
      },
      body: JSON.stringify({ name: businessName("direct"), slug: slugOf("direct") }),
    });
    expect(response.status).toBe(403);
    expect(await businessesWith(slugOf("direct"))).toHaveLength(0);
  });

  test("an owner cannot invite anyone", async () => {
    const response = await app.request("/api/auth/organization/invite-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: appOrigin,
        Cookie: cookies.get(owner.email)!,
      },
      body: JSON.stringify({
        email: email("invited"),
        role: "member",
        organizationId: owner.organizationId,
      }),
    });
    expect(response.status).toBe(403);
    const invitations = await db
      .select()
      .from(invitation)
      .where(eq(invitation.organizationId, owner.organizationId));
    expect(invitations).toHaveLength(0);
  });
});
