// Backend: sets up a client, their login and their business, with the client as its business
// owner and first person, and the details the business's emails need. The platform admin who
// asks is never made a member. A key for the business's own Resend (decision 6) is proved with
// a test email before anything is made, so a wrong key never leaves a half-made business.

import { randomUUID } from "node:crypto";

import { and, eq, lt, ne, notExists, sql } from "drizzle-orm";

import { clientSetupClaim, member, organization, user } from "@scheduleads-app/shared/db";
import { toSlug } from "@scheduleads-app/shared/helpers";
import type { ProvisionClientInputType } from "@scheduleads-app/shared/zod-validation";

import { db } from "../../database.js";
import { auth } from "../auth/auth-server.js";
import { checkEmailSendingKey } from "../email/check-email-sending-key.js";
import { storeEmailSendingKey } from "../email/store-email-sending-key.js";
import { safeErrorReason } from "../errors/safe-error-reason.js";

export type ProvisionClientResultType =
  | {
      ok: true;
      organization: { id: string; name: string; slug: string };
      client: { id: string; name: string; email: string };
    }
  | { ok: false; code: "bad_request" | "email_taken" | "slug_taken" | "setup_in_progress" }
  | { ok: false; code: "key_refused"; reason: string };

type LoginType = { id: string; name: string; email: string };

export async function provisionClient(
  input: ProvisionClientInputType
): Promise<ProvisionClientResultType> {
  const slug = toSlug(input.businessName);
  if (!slug) return { ok: false, code: "bad_request" }; // only punctuation or emoji

  try {
    const result = await withSetupClaims(input.clientEmail, slug, () => setUp(input, slug));
    return result === "in_progress" ? { ok: false, code: "setup_in_progress" } : result;
  } catch (error) {
    // Never rethrown as is: Hono logs what reaches it, and a database error names the
    // client's email in its query.
    console.error(`[admin] a client setup failed: ${safeErrorReason(error)}`);
    throw new Error("A client setup failed; the reason is in the line before.");
  }
}

// One setup per email and per address at a time. Without it, a double click's second setup
// would see the first one's new login, still without a business, as an unfinished setup and
// take it over. A setup claims both as rows of client_setup_claim, so nothing holds a
// database connection while it runs; a second setup for either is told to try again.
async function withSetupClaims<T>(
  email: string,
  slug: string,
  run: () => Promise<T>
): Promise<T | "in_progress"> {
  const claimId = randomUUID();
  const keys = [`email:${email}`, `slug:${slug}`];

  // A claim this old belongs to a setup that died before removing it.
  await db
    .delete(clientSetupClaim)
    .where(lt(clientSetupClaim.claimedAt, sql`now() - interval '5 minutes'`));

  const claimed = await db
    .insert(clientSetupClaim)
    .values(keys.map((key) => ({ key, claimId })))
    .onConflictDoNothing()
    .returning({ key: clientSetupClaim.key });

  try {
    if (claimed.length < keys.length) return "in_progress"; // another setup holds one of them
    return await run();
  } finally {
    await releaseSetupClaims(claimId);
  }
}

// Only this setup's own claims. A failure here is logged, never thrown, so it cannot turn a
// finished setup into an error; the claims then expire after five minutes.
async function releaseSetupClaims(claimId: string): Promise<void> {
  try {
    await db.delete(clientSetupClaim).where(eq(clientSetupClaim.claimId, claimId));
  } catch (error) {
    console.error(`[admin] could not release a setup's claims: ${safeErrorReason(error)}`);
  }
}

async function setUp(
  input: ProvisionClientInputType,
  slug: string
): Promise<ProvisionClientResultType> {
  const unfinishedLogin = await findLoginForEmail(input.clientEmail);
  if (unfinishedLogin === "taken") return { ok: false, code: "email_taken" };

  if (await isSlugTaken(slug)) return { ok: false, code: "slug_taken" };

  // Empty on the form means not set. The notifications go to the owner until told otherwise.
  const details = {
    senderEmail: input.senderEmail || null,
    notifyEmail: input.notifyEmail || input.clientEmail,
    phone: input.phone || null,
    website: input.website || null,
    brandColor: input.brandColor || null,
  };
  const apiKey = input.emailSendingKey || null;
  if (apiKey && details.senderEmail) {
    const checked = await checkEmailSendingKey({
      apiKey,
      businessName: input.businessName,
      senderEmail: details.senderEmail,
      notifyEmail: details.notifyEmail,
    });
    if (!checked.ok) return { ok: false, code: "key_refused", reason: checked.reason };
  }

  // Better Auth's two server-side creates skip their own permission checks when they carry
  // no request headers: it treats them as the server acting for this user. That is what
  // makes the client the creator, so the business owner. So this function runs only behind
  // requirePlatformAdminMiddleware, and never gets the request's headers: with them, the
  // platform admin would become the owner.
  const client: LoginType = unfinishedLogin
    ? await renameLogin(unfinishedLogin, input.clientName)
    : (await auth.api.createUser({ body: { email: input.clientEmail, name: input.clientName } }))
        .user;

  try {
    const created = await auth.api.createOrganization({
      body: { name: input.businessName, slug, userId: client.id },
    });
    await db.update(organization).set(details).where(eq(organization.id, created.id));
    if (apiKey) await storeEmailSendingKey(created.id, apiKey);

    return {
      ok: true,
      organization: { id: created.id, name: created.name, slug: created.slug },
      client: { id: client.id, name: client.name, email: client.email },
    };
  } catch (error) {
    // Better Auth saves the business, its owner and its first person as separate writes, so
    // a failure can come after the business exists. Everything this setup made goes again;
    // a login reused from an earlier unfinished setup stays, ready for the next try.
    let takenBySomeoneElse = false;
    try {
      takenBySomeoneElse = await removeBusinessMadeFor(slug, client.id);
      if (!unfinishedLogin) await removeLoginWithoutBusiness(client.id);
    } catch (cleanUpError) {
      // Logged, and the setup's own error is the one that goes on.
      console.error(
        `[admin] clean-up after a failed setup failed: ${safeErrorReason(cleanUpError)}`
      );
    }

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

// Running a setup again is the way to correct it, so the name typed now replaces the old.
async function renameLogin(login: LoginType, name: string): Promise<LoginType> {
  if (login.name === name) return login;
  await db.update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, login.id));
  return { ...login, name };
}

async function isSlugTaken(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1);
  return Boolean(row);
}

// The address was free when this setup checked, under its claim. A business there now with no
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
    console.error(
      `[admin] could not remove login ${userId} after a failed setup: ${safeErrorReason(error)}`
    );
  }
}
