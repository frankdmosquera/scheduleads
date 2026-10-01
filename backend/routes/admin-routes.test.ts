// Setting up a client, called through the real app against the local database. Every login
// and business here is a throwaway carrying this run's tag, removed after.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the admin route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin, auth } = await import("../lib/auth/auth-server.js");
const { member, organization, resource, user } = await import("@scheduleads-app/shared/db");

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
  await db
    .insert(member)
    .values({
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
    expect((await response.json()).client.id).toBe(unfinished.id);

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
});
