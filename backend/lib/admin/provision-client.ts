// Backend: sets up a client, their login and their business, with the client as its business
// owner and first person. The platform admin who asks is never made a member.

import { and, eq, ne, notExists } from "drizzle-orm";

import { member, organization, user } from "@scheduleads-app/shared/db";
import { toSlug } from "@scheduleads-app/shared/helpers";
import type { ProvisionClientInputType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { auth } from "../auth/auth-server.js";

export type ProvisionClientResultType =
  | {
      ok: true;
      organization: { id: string; name: string; slug: string };
      client: { id: string; name: string; email: string };
    }
  | { ok: false; code: "bad_request" | "email_taken" | "slug_taken" };

type LoginType = { id: string; name: string; email: string };

export async function provisionClient(
  input: ProvisionClientInputType
): Promise<ProvisionClientResultType> {
  const slug = toSlug(input.businessName);
  if (!slug) return { ok: false, code: "bad_request" }; // only punctuation or emoji

  return withSetupLocks(input.clientEmail, slug, () => setUp(input, slug));
}

// One setup per email and per address at a time. Without it, a double click's second setup
// would see the first one's new login, still without a business, as an unfinished setup and
// take it over. Advisory locks live on one connection, so one is held for the whole setup;
// the locks go when it is released, or when the connection dies with the API.
async function withSetupLocks<T>(email: string, slug: string, run: () => Promise<T>): Promise<T> {
  const connection = await db.$client.reserve();
  try {
    // Always email first, then address, so two setups can never wait on each other.
    await connection`select pg_advisory_lock(hashtextextended(${`setup-email:${email}`}, 0))`;
    await connection`select pg_advisory_lock(hashtextextended(${`setup-slug:${slug}`}, 0))`;
    return await run();
  } finally {
    await connection`select pg_advisory_unlock_all()`;
    connection.release();
  }
}

async function setUp(
  input: ProvisionClientInputType,
  slug: string
): Promise<ProvisionClientResultType> {
  const unfinishedLogin = await findLoginForEmail(input.clientEmail);
  if (unfinishedLogin === "taken") return { ok: false, code: "email_taken" };

  if (await isSlugTaken(slug)) return { ok: false, code: "slug_taken" };

  // Better Auth's two server-side creates skip their own permission checks when they carry
  // no request headers: it treats them as the server acting for this user. That is what
  // makes the client the creator, so the business owner. So this function runs only behind
  // requirePlatformAdminMiddleware, and never gets the request's headers: with them, the
  // platform admin would become the owner.
  const client: LoginType =
    unfinishedLogin ??
    (await auth.api.createUser({ body: { email: input.clientEmail, name: input.clientName } }))
      .user;

  try {
    const created = await auth.api.createOrganization({
      body: { name: input.businessName, slug, userId: client.id },
    });

    return {
      ok: true,
      organization: { id: created.id, name: created.name, slug: created.slug },
      client: { id: client.id, name: client.name, email: client.email },
    };
  } catch (error) {
    // Better Auth saves the business, its owner and its first person as separate writes, so
    // a failure can come after the business exists. Everything this setup made goes again;
    // a login reused from an earlier unfinished setup stays, ready for the next try.
    const takenBySomeoneElse = await removeBusinessMadeFor(slug, client.id);
    if (!unfinishedLogin) await removeLoginWithoutBusiness(client.id);

    if (takenBySomeoneElse) return { ok: false, code: "slug_taken" };
    throw error;
  }
}

// No login: null, a new one is made. A login that belongs to a business, or is the platform
// admin's: taken. A login that belongs to no business can only be a setup that died between
// its two creates, so it is returned and that setup is finished now.
async function findLoginForEmail(email: string): Promise<LoginType | "taken" | null> {
  const [login] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);
  if (!login) return null;
  if (login.role === "admin") return "taken";

  const [membership] = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.userId, login.id))
    .limit(1);
  if (membership) return "taken";

  return { id: login.id, name: login.name, email: login.email };
}

async function isSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return Boolean(row);
}

// The address was free when this setup checked, under its lock. A business there now with no
// member but this client is this setup's, half made: removed, with its owner row and first
// person (cascade). One with anyone else in it was made another way: kept, and true is
// returned so the answer says the name is taken.
async function removeBusinessMadeFor(slug: string, clientId: string): Promise<boolean> {
  const [business] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  if (!business) return false;

  const [someoneElse] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, business.id), ne(member.userId, clientId)))
    .limit(1);
  if (someoneElse) return true;

  await db.delete(organization).where(eq(organization.id, business.id));
  return false;
}

// Only while it belongs to no business, so a login can never be taken from under one. Its
// sessions and accounts go with it (cascade). If this fails, the login is left with no
// business, and the next setup with the same email finishes it.
async function removeLoginWithoutBusiness(userId: string): Promise<void> {
  try {
    await db
      .delete(user)
      .where(
        and(
          eq(user.id, userId),
          notExists(db.select({ id: member.id }).from(member).where(eq(member.userId, userId)))
        )
      );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[admin] could not remove login ${userId} after a failed setup: ${reason}`);
  }
}
