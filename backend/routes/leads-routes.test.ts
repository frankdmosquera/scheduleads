// The leads list and a lead's page, called through the real app against the local database. Two
// throwaway businesses, each with one lead, made below and removed after.

import { randomUUID } from "node:crypto";

import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

// The sign-in helper reads codes from the console, so these tests never send a real email.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the leads route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const { findFirstPipelineStage } = await import("../lib/crm/find-first-pipeline-stage.js");
const { seedPipelineStages } = await import("../lib/crm/seed-pipeline-stages.js");
const { contact, lead, member, organization, user } = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string) => ({
  userId: randomUUID(),
  email: `leads-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-leads-${letter}-${tag}-dev`,
  leadId: randomUUID(),
});
const painting = makeTenant("p");
const clinic = makeTenant("c");
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

const get = (path: string, email: string) =>
  app.request(path, { headers: { Origin: appOrigin, Cookie: cookies.get(email)! } });

beforeAll(async () => {
  const tenants = [painting, clinic];
  await db
    .insert(user)
    .values(tenants.map((t) => ({ id: t.userId, name: "", email: t.email, emailVerified: true })));
  await db
    .insert(organization)
    .values(tenants.map((t) => ({ id: t.organizationId, name: `Leads ${t.slug}`, slug: t.slug })));
  await db.insert(member).values(
    tenants.map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      userId: t.userId,
      role: "owner",
    }))
  );
  for (const t of tenants) {
    await seedPipelineStages(t.organizationId);
    const stage = await findFirstPipelineStage(t.organizationId);
    const contactId = randomUUID();
    await db.insert(contact).values({
      id: contactId,
      organizationId: t.organizationId,
      name: `Customer of ${t.slug}`,
    });
    await db.insert(lead).values({
      id: t.leadId,
      organizationId: t.organizationId,
      contactId,
      stageId: stage!.id,
      source: "manual",
    });
    cookies.set(t.email, await signIn(t.email));
  }
});

afterAll(async () => {
  // A business takes its contacts, leads and stages with it.
  await db
    .delete(organization)
    .where(inArray(organization.id, [painting.organizationId, clinic.organizationId]));
  await db.delete(user).where(inArray(user.id, [painting.userId, clinic.userId]));
});

test("a business never sees another's leads", async () => {
  // The list holds the business's own lead and never the other's.
  const list = await get("/leads", clinic.email);
  expect(list.status).toBe(200);
  const ids = ((await list.json()) as { leads: { id: string }[] }).leads.map((one) => one.id);
  expect(ids).toEqual([clinic.leadId]);

  // Its own lead opens; the other's answers exactly as a lead that never existed.
  expect((await get(`/leads/${clinic.leadId}`, clinic.email)).status).toBe(200);
  const foreign = await get(`/leads/${painting.leadId}`, clinic.email);
  const unknown = await get(`/leads/${randomUUID()}`, clinic.email);
  expect(foreign.status).toBe(404);
  expect(await foreign.json()).toEqual(await unknown.json());

  // Nor can the other's lead be used to page through the list.
  expect((await get(`/leads?after=${painting.leadId}`, clinic.email)).status).toBe(400);
});
