// Backend: sets up a client, their login and their business, with the client as its business
// owner and first person. The platform admin who asks is never made a member.

import { eq } from "drizzle-orm";

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
    // The two creates share no transaction, so a business that failed takes the login made
    // for it away again. A login reused from an earlier unfinished setup is left alone.
    if (!unfinishedLogin) await removeLogin(client.id);

    if (await isSlugTaken(slug)) return { ok: false, code: "slug_taken" }; // taken in between
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

// Its sessions and accounts go with it (cascade). If even this fails, the login is left with
// no business, and the next setup with the same email finishes it.
async function removeLogin(userId: string): Promise<void> {
  try {
    await db.delete(user).where(eq(user.id, userId));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    console.error(`[admin] could not remove login ${userId} after a failed setup: ${reason}`);
  }
}
