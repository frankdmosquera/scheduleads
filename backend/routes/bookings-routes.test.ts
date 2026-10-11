// The owner cancelling bookings from the dashboard, called through the real app against the local
// database. Every business, booking and login here is a throwaway made below and removed after.
// Test names match the feature's Simulate page and its planned checks.

import { randomUUID } from "node:crypto";

import { and, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and CALENDAR_TOKEN_KEY.
}

// The sign-in helper reads codes from the console, so no real email is ever sent.
delete process.env.RESEND_API_KEY;
delete process.env.LOGIN_EMAIL_FROM;

assertLocalDevDatabase(process.env.DATABASE_URL, "run the bookings route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const { jobSchema } = await import("../lib/jobs/job-schema.js");
const {
  activity,
  booking,
  bookingLink,
  commitment,
  contact,
  lead,
  member,
  organization,
  pipelineStage,
  resource,
  user,
} = await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string) => ({
  userId: randomUUID(),
  email: `cancel-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-cancel-${letter}-${tag}-dev`,
  personId: randomUUID(),
  stageId: randomUUID(),
  serviceId: randomUUID(),
});
const summit = makeTenant("s"); // the owner who cancels
const other = makeTenant("o"); // another business, with a booking of its own
const helper = { userId: randomUUID(), email: `cancel-m-${tag}@example.com` }; // a member of Summit
const HOUR = 3_600_000;
const schema = sql.identifier(jobSchema);

// A customer, their lead, a confirmed booking with Juan from the moment given, and the time it holds.
async function makeBooking(
  tenant: typeof summit,
  customerName: string,
  startsAt: Date
): Promise<{ bookingId: string; contactId: string; commitmentId: string }> {
  const [contactId, leadId, bookingId, commitmentId] = [
    randomUUID(),
    randomUUID(),
    randomUUID(),
    randomUUID(),
  ];
  const { organizationId } = tenant;
  const endsAt = new Date(startsAt.getTime() + HOUR);
  await db.insert(contact).values({
    id: contactId,
    organizationId,
    name: customerName,
    email: `${customerName.toLowerCase()}-${tag}@example.com`,
  });
  await db
    .insert(lead)
    .values({ id: leadId, organizationId, contactId, stageId: tenant.stageId, source: "widget" });
  await db.insert(booking).values({
    id: bookingId,
    organizationId,
    leadId,
    bookingLinkId: tenant.serviceId,
    personId: tenant.personId,
    startsAt,
    endsAt,
    status: "confirmed",
  });
  await db.insert(commitment).values({
    id: commitmentId,
    organizationId,
    resourceId: tenant.personId,
    kind: "booking",
    bookingId,
    startsAt,
    endsAt,
  });
  return { bookingId, contactId, commitmentId };
}

const statusOf = async (bookingId: string) =>
  (await db.select({ status: booking.status }).from(booking).where(eq(booking.id, bookingId)))[0]
    .status;

// The jobs a booking's change queued, by task and, for an email, its kind.
const jobsOf = async (bookingId: string) =>
  (
    (await db.execute(
      sql`select tasks.identifier as task, jobs.payload->>'kind' as kind
          from ${schema}._private_jobs jobs
          join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
          where jobs.payload->>'bookingId' = ${bookingId}
          order by task, kind`
    )) as unknown as { task: string; kind: string | null }[]
  ).map((job) => (job.kind ? `${job.task}:${job.kind}` : job.task));

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

const cancel = (email: string, bookingIds: string[]) =>
  app.request("/bookings/cancel", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: appOrigin, Cookie: cookies.get(email)! },
    body: JSON.stringify({ bookingIds }),
  });

beforeAll(async () => {
  await db.insert(user).values(
    [summit, other, helper].map((t) => ({
      id: t.userId,
      name: "",
      email: t.email,
      emailVerified: true,
    }))
  );
  await db
    .insert(organization)
    .values([summit, other].map((t) => ({ id: t.organizationId, name: t.slug, slug: t.slug })));
  await db.insert(member).values([
    ...[summit, other].map((t) => ({
      id: randomUUID(),
      organizationId: t.organizationId,
      userId: t.userId,
      role: "owner",
    })),
    {
      id: randomUUID(),
      organizationId: summit.organizationId,
      userId: helper.userId,
      role: "member",
    },
  ]);
  await db.insert(resource).values(
    [summit, other].map((t) => ({
      id: t.personId,
      organizationId: t.organizationId,
      name: "Juan",
      kind: "person",
    }))
  );
  await db.insert(pipelineStage).values(
    [summit, other].map((t) => ({
      id: t.stageId,
      organizationId: t.organizationId,
      name: "New",
      position: 0,
    }))
  );
  await db.insert(bookingLink).values(
    [summit, other].map((t) => ({
      id: t.serviceId,
      organizationId: t.organizationId,
      name: "Estimate",
      slug: "estimate",
      durationMinutes: 60,
      layout: "month",
      asksAddress: false,
      personChoice: "customer_picks",
    }))
  );
  for (const email of [summit.email, other.email, helper.email])
    cookies.set(email, await signIn(email));
});

afterAll(async () => {
  await db
    .delete(organization)
    .where(inArray(organization.id, [summit.organizationId, other.organizationId]));
  await db.delete(user).where(inArray(user.id, [summit.userId, other.userId, helper.userId]));
  await db.$client.end();
});

describe("the owner's cancel", () => {
  // Two days ahead, a few hours apart: Juan cannot hold two bookings at once.
  const inTwoDays = (hour: number) => new Date(Date.now() + (48 + hour) * HOUR);

  test("another business's booking in the list is refused and nothing is cancelled", async () => {
    const mine = await makeBooking(summit, "Maria", inTwoDays(0));
    const theirs = await makeBooking(other, "Kim", inTwoDays(0));

    const refused = await cancel(summit.email, [mine.bookingId, theirs.bookingId]);
    const unknown = await cancel(summit.email, [mine.bookingId, randomUUID()]);
    expect([refused.status, unknown.status]).toEqual([404, 404]);
    expect(await refused.json()).toEqual(await unknown.json());
    expect([await statusOf(mine.bookingId), await statusOf(theirs.bookingId)]).toEqual([
      "confirmed",
      "confirmed",
    ]);
    expect(await jobsOf(mine.bookingId)).toEqual([]);

    // A member who may not change the business cannot cancel either.
    expect((await cancel(helper.email, [mine.bookingId])).status).toBe(403);
    expect(await statusOf(mine.bookingId)).toBe("confirmed");
  });

  test("an owner's cancel frees the time, records the owner, queues the customer's email and the worker text and no business notification", async () => {
    const maria = await makeBooking(summit, "Lee", inTwoDays(2));

    const answer = await cancel(summit.email, [maria.bookingId]);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      cancelled: [maria.bookingId],
      alreadyCancelled: [],
      alreadyStarted: [],
    });
    expect(await statusOf(maria.bookingId)).toBe("cancelled");
    const [held] = await db
      .select({ status: commitment.status })
      .from(commitment)
      .where(eq(commitment.id, maria.commitmentId));
    expect(held.status).toBe("cancelled");

    const [entry] = await db
      .select({ actorUserId: activity.actorUserId })
      .from(activity)
      .where(and(eq(activity.contactId, maria.contactId), eq(activity.type, "booking_cancelled")));
    expect(entry.actorUserId).toBe(summit.userId);

    // The customer's email, the worker's text and the calendar event; never the business's own.
    expect(await jobsOf(maria.bookingId)).toEqual([
      "booking_email:booking_cancellation",
      "booking_event_remove",
      "worker_text:removed", // the "off your day" text
    ]);

    // A second press changes nothing and says so.
    const again = await cancel(summit.email, [maria.bookingId]);
    expect(await again.json()).toMatchObject({ alreadyCancelled: [maria.bookingId] });
  });

  test("a started booking is not cancelled and is named", async () => {
    const started = await makeBooking(summit, "Sam", new Date(Date.now() - HOUR / 2));
    const later = await makeBooking(summit, "Bo", inTwoDays(4));

    const answer = await cancel(summit.email, [started.bookingId, later.bookingId]);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({
      cancelled: [later.bookingId],
      alreadyCancelled: [],
      alreadyStarted: [started.bookingId],
    });
    expect(await statusOf(started.bookingId)).toBe("confirmed");
  });
});
