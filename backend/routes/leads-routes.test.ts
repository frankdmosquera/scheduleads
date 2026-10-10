// The leads routes, called through the real app against the local database: a business never sees
// or touches another's leads, and a lead typed in by hand joins the right person once. Two
// throwaway businesses, each with one lead, made below and removed after.

import { randomUUID } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";
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
const { activity, contact, lead, member, organization, user } =
  await import("@scheduleads-app/shared/db");

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
const post = (path: string, email: string, body?: unknown) =>
  app.request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: appOrigin, Cookie: cookies.get(email)! },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
type AddedType = { leadId: string; contactId: string; joinedExistingContact: boolean };
const addLead = async (email: string, fields: Record<string, string>) => {
  const response = await post("/leads", email, { requestKey: randomUUID(), ...fields });
  return { status: response.status, body: (await response.json()) as AddedType };
};
const contactOf = async (contactId: string) =>
  (await db.select().from(contact).where(eq(contact.id, contactId)))[0];

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

test("a known email joins that person", async () => {
  const first = await addLead(clinic.email, {
    name: "Maria Lopez",
    phone: "(403) 555-0101",
    email: `maria-${tag}@example.com`,
  });
  expect(first.status).toBe(201);
  expect(first.body.joinedExistingContact).toBe(false);

  // She calls again: her name typed differently, another number, the email in capitals.
  const second = await addLead(clinic.email, {
    name: "Mary Lopez",
    phone: "(403) 555-0199",
    email: `MARIA-${tag}@example.com`,
  });
  expect(second.status).toBe(201);
  expect(second.body.joinedExistingContact).toBe(true);
  expect(second.body.contactId).toBe(first.body.contactId);
  expect(second.body.leadId).not.toBe(first.body.leadId);

  // Her name and phone stay as first given; the number she called from stays on the new lead.
  const maria = await contactOf(first.body.contactId);
  expect([maria.name, maria.phone]).toEqual(["Maria Lopez", "(403) 555-0101"]);
  const [secondLead] = await db.select().from(lead).where(eq(lead.id, second.body.leadId));
  expect([secondLead.source, secondLead.phone]).toEqual(["manual", "(403) 555-0199"]);
});

test("no email makes a new person", async () => {
  const first = await addLead(clinic.email, { name: "Tom Reid", phone: "(403) 555-0144" });
  const again = await addLead(clinic.email, { name: "Tom Reid", phone: "(403) 555-0144" });
  expect([first.status, again.status]).toEqual([201, 201]);
  expect(again.body.contactId).not.toBe(first.body.contactId); // a phone never matches
});

test("the same form sent twice makes one lead", async () => {
  const form = { requestKey: randomUUID(), name: "Ana Silva", email: `ana-${tag}@example.com` };
  // Both at the same instant, as a double click or a retry would.
  const [one, two] = await Promise.all([
    post("/leads", clinic.email, form),
    post("/leads", clinic.email, form),
  ]);
  expect([one.status, two.status].sort()).toEqual([200, 201]);
  const [a, b] = (await Promise.all([one.json(), two.json()])) as AddedType[];
  expect(a.leadId).toBe(b.leadId);
  const saved = await db
    .select({ id: lead.id })
    .from(lead)
    .where(
      and(eq(lead.organizationId, clinic.organizationId), eq(lead.requestKey, form.requestKey))
    );
  expect(saved).toHaveLength(1);
});

test("neither phone nor email is refused", async () => {
  const response = await post("/leads", clinic.email, {
    requestKey: randomUUID(),
    name: "Nobody Reachable",
    phone: "",
    email: "",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { message: "Enter a phone number or an email, so you can reach them." },
  });
});

test("next steps stay inside the business", async () => {
  const step = {
    what: "Call back about the quote",
    dueLocal: "2026-10-15T09:00",
    browserTimeZone: "America/Edmonton",
  };

  // Each business adds one to its own lead.
  expect((await post(`/leads/${clinic.leadId}/next-steps`, clinic.email, step)).status).toBe(201);
  const theirs = await post(`/leads/${painting.leadId}/next-steps`, painting.email, step);
  const { id: theirStepId } = (await theirs.json()) as { id: string };

  // The clinic can neither add to the other business's lead nor tick its step, by either lead.
  expect((await post(`/leads/${painting.leadId}/next-steps`, clinic.email, step)).status).toBe(404);
  const tick = (leadId: string, email: string) =>
    post(`/leads/${leadId}/next-steps/${theirStepId}/done`, email);
  expect((await tick(painting.leadId, clinic.email)).status).toBe(404);
  expect((await tick(clinic.leadId, clinic.email)).status).toBe(404);
  const [untouched] = await db.select().from(activity).where(eq(activity.id, theirStepId));
  expect(untouched.doneAt).toBeNull();

  // Its own business ticks it.
  expect((await tick(painting.leadId, painting.email)).status).toBe(200);
});

test("a cross-site post to /leads is refused", async () => {
  const response = await app.request("/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://evil.example",
      Cookie: cookies.get(clinic.email)!,
    },
    body: "name=Planted&phone=1",
  });
  expect(response.status).toBe(403);
});
