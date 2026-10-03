// A cancelled booking's emails, against the local database with Resend faked: no test ever sends a
// real email. Every business here is a throwaway carrying this run's tag, removed after (its rows
// go with it). Test names match the feature's Simulate page and its planned checks.

import { randomUUID } from "node:crypto";

import { and, eq, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the token key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking email tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  activity,
  availabilityRule,
  booking,
  bookingLink,
  bookingLinkResource,
  emailSendingKey,
  member,
  organization,
  pipelineStage,
  resource,
  user,
} = await import("@scheduleads-app/shared/db");
const { encryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { bookTime } = await import("../booking/book-time.js");
const { bookingEventWrites } = await import("../booking/booking-event-writes.js");
const { bookingConfirmationEmails } = await import("../booking/booking-confirmation-emails.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { bookingEventRemovals } = await import("../booking/booking-event-removals.js");
const { bookingCancellationEmails } = await import("../booking/booking-cancellation-emails.js");
const { sendCancellationEmails } = await import("./send-cancellation-emails.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const jane = {
  name: "Jane Doe",
  email: `jane-${tag}@example.com`,
  phone: "403 555 0148",
  location: "12 Main Street, Calgary",
  details: "Two bedrooms, ceilings too",
};

// Resend's side, faked: every send it is asked for, and the answer each test sets.
type ResendCallType = { headers: Headers; body: Record<string, unknown> };
let calls: ResendCallType[];
let answer: () => Response | Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// A painting business of its own: Marco does interior estimates (60 minutes), Mondays 9 to 12. Set
// up to send unless a test leaves something out.
async function makeBusiness(
  name: string,
  {
    senderEmail = "bookings@primopainters.com",
    notifyEmail = "office@primopainters.com",
    key = true,
  }: { senderEmail?: string | null; notifyEmail?: string | null; key?: boolean } = {}
) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({
    id: business,
    name: "Primo Painters",
    slug: `test-cancelmail-${name}-${tag}-dev`,
    senderEmail,
    notifyEmail,
    phone: "(403) 555-0100",
    website: "https://primopainters.com",
  });
  if (key) {
    await db.insert(emailSendingKey).values({
      organizationId: business,
      credentials: encryptCredentials("re_primo_send_key", readTokenKey(), business),
    });
  }
  await db.insert(availabilityRule).values({
    id: id(),
    organizationId: business,
    resourceId: null,
    weeklyHours: { mon: [{ startMinute: 540, endMinute: 720 }] },
    timezone: "America/Edmonton",
    minimumNoticeMinutes: 0,
    horizonDays: 60,
    closedDates: [],
  });
  await db
    .insert(pipelineStage)
    .values({ id: id(), organizationId: business, name: "New", position: 0 });
  const [marco, estimate] = [id(), id()];
  await db
    .insert(resource)
    .values({ id: marco, organizationId: business, name: "Marco", kind: "person" });
  await db.insert(bookingLink).values({
    id: estimate,
    organizationId: business,
    name: "Interior estimate",
    slug: "interior-estimate",
    durationMinutes: 60,
  });
  await db
    .insert(bookingLinkResource)
    .values({ organizationId: business, bookingLinkId: estimate, resourceId: marco });
  return { business, marco, estimate, slug: `test-cancelmail-${name}-${tag}-dev` };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

async function makeOwner(business: BusinessType, name: string) {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, name, email: `owner-${name}-${tag}@example.com` });
  await db
    .insert(member)
    .values({ id: randomUUID(), organizationId: business.business, userId, role: "owner" });
  return userId;
}

const settled = async () => {
  await bookingEventWrites.settled();
  await bookingConfirmationEmails.settled();
  await bookingEventRemovals.settled();
  await bookingCancellationEmails.settled();
};

// Cancelled, then the emails waited for. The booking's own confirmation emails are left behind.
const cancel = async (bookingId: string) => {
  calls.length = 0;
  const result = await cancelBooking(bookingId, new Date("2026-10-02T15:00:00Z"));
  await settled();
  return result;
};

// Booked, then the emails waited for: the customer's answer does not wait for them, these tests do.
const book = async (
  business: BusinessType,
  changes: Partial<Parameters<typeof bookTime>[0]> = {}
) => {
  const result = await bookTime({
    organizationId: business.business,
    bookingLinkId: business.estimate,
    personId: business.marco,
    startsAt: NINE,
    requestKey: randomUUID(),
    customer: { name: jane.name, email: jane.email, phone: jane.phone },
    location: jane.location,
    details: jane.details,
    source: "widget",
    actorUserId: null,
    now: new Date("2026-10-02T14:00:00Z"),
    ...changes,
  });
  await settled();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
};

const timelineOf = (business: BusinessType) =>
  db
    .select({ payload: activity.payload, actorUserId: activity.actorUserId })
    .from(activity)
    .where(and(eq(activity.organizationId, business.business), eq(activity.type, "email_sent")))
    .orderBy(sql`${activity.payload}->>'kind'`); // by kind, so the order is fixed

const decoded = (attachment: unknown) =>
  Buffer.from(String((attachment as { content: string }).content), "base64").toString("utf8");

beforeEach(() => {
  calls = [];
  let next = 0;
  answer = () => json({ id: `email-${++next}` });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== "https://api.resend.com/emails") throw new Error(`A test tried to reach ${url}.`);
    calls.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return answer();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await settled();
  await db.delete(organization).where(like(organization.slug, `test-cancelmail-%-${tag}-dev`));
  await db.delete(user).where(like(user.email, `owner-%-${tag}@example.com`));
  await db.$client.end();
});

const cancellationEntriesOf = async (business: BusinessType) =>
  (await timelineOf(business)).filter((row) =>
    String((row.payload as { kind: string }).kind).startsWith("booking_cancellation")
  );

describe("a cancelled booking's emails", () => {
  test("a cancel sends both, the cancelling invite attached to Jane's with the booking's UID", async () => {
    const business = await makeBusiness("both");
    const bookingId = await book(business);

    expect(await cancel(bookingId)).toEqual({ cancelled: true, alreadyCancelled: false });

    expect(calls).toHaveLength(2);
    const [toJane, toPrimo] = calls;
    expect(toJane.headers.get("Authorization")).toBe("Bearer re_primo_send_key");
    expect(toJane.headers.get("Idempotency-Key")).toBe(`booking-cancelled/${bookingId}`);
    expect(toJane.body).toMatchObject({
      from: '"Primo Painters" <bookings@primopainters.com>',
      to: [jane.email],
      subject: "Your booking with Primo Painters is cancelled: Monday, October 5 at 9:00 a.m. MDT",
    });
    const [invite] = toJane.body.attachments as Record<string, unknown>[];
    expect(invite).toMatchObject({
      filename: "invite.ics",
      content_type: "text/calendar; charset=utf-8; method=CANCEL",
    });
    expect(decoded(invite)).toContain("\r\nMETHOD:CANCEL\r\n");
    expect(decoded(invite)).toContain(`\r\nUID:${bookingId}\r\n`);
    expect(decoded(invite)).toContain("\r\nSTATUS:CANCELLED\r\n");

    expect(toPrimo.headers.get("Idempotency-Key")).toBe(
      `booking-cancelled-notification/${bookingId}`
    );
    expect(toPrimo.body).toMatchObject({
      to: ["office@primopainters.com"],
      reply_to: jane.email,
      subject: "Cancelled: Interior estimate, Monday, October 5 at 9:00 a.m. MDT",
    });
    expect(toPrimo.body.attachments).toBeUndefined();

    expect(await cancellationEntriesOf(business)).toEqual([
      {
        payload: { bookingId, kind: "booking_cancellation", resendId: "email-3" },
        actorUserId: null,
      },
      {
        payload: { bookingId, kind: "booking_cancellation_notification", resendId: "email-4" },
        actorUserId: null,
      },
    ]);
  });

  test("a phone-only booking's cancel sends only the business's", async () => {
    const business = await makeBusiness("phone-only");
    const bookingId = await book(business, { customer: { name: jane.name, phone: jane.phone } });

    await cancel(bookingId);

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ to: ["office@primopainters.com"] });
    expect(calls[0].body.reply_to).toBeUndefined();
  });

  test("a cancel of a booking the owner made still tells the business", async () => {
    const business = await makeBusiness("owner-made");
    const owner = await makeOwner(business, "made");
    const bookingId = await book(business, {
      source: "manual",
      actorUserId: owner,
      requestKey: null,
    });

    await cancel(bookingId);

    expect(calls.map((call) => call.body.to)).toEqual([[jane.email], ["office@primopainters.com"]]);
  });

  test("a second cancel sends nothing more", async () => {
    const business = await makeBusiness("twice");
    const bookingId = await book(business);
    await cancel(bookingId);

    expect(await cancel(bookingId)).toEqual({ cancelled: true, alreadyCancelled: true });
    expect(calls).toEqual([]);
    expect(await cancellationEntriesOf(business)).toHaveLength(2);
  });

  test("Resend failing keeps the cancel and logs one line", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // the SDK's own line outside production
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const business = await makeBusiness("resend-down");
    const bookingId = await book(business);
    answer = () =>
      json(
        { name: "application_error", statusCode: 500, message: `Failed for ${jane.email}` },
        500
      );

    expect(await cancel(bookingId)).toEqual({ cancelled: true, alreadyCancelled: false });

    expect(calls).toHaveLength(2); // both were tried
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(bookingId);
    expect(line).toContain(
      "booking_cancellation: Sending an email failed: application_error (500)"
    );
    expect(line).not.toContain("@");
    expect(await cancellationEntriesOf(business)).toEqual([]);
  });

  test("a business without its addresses or key cancels and sends nothing, and logs it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const business = await makeBusiness("no-key", { key: false });
    const bookingId = await book(business);
    log.mockClear();

    expect(await cancel(bookingId)).toEqual({ cancelled: true, alreadyCancelled: false });

    expect(calls).toEqual([]);
    expect(log.mock.calls.map((call) => String(call[0]))).toContain(
      `[email] booking ${bookingId}: nothing sent, the business has no Resend key`
    );
  });

  test("sending a cancellation again sends the very same invite, under the same key", async () => {
    const business = await makeBusiness("same-again");
    const bookingId = await book(business);
    await cancel(bookingId);
    const first = calls.find((call) => call.body.attachments);
    calls.length = 0;

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 60 * 60_000)); // an hour later, as a retry would be
    try {
      await sendCancellationEmails(business.business, bookingId);
    } finally {
      vi.useRealTimers();
    }
    const again = calls.find((call) => call.body.attachments);

    expect(again?.headers.get("Idempotency-Key")).toBe(first?.headers.get("Idempotency-Key"));
    expect(decoded((again?.body.attachments as unknown[])[0])).toBe(
      decoded((first?.body.attachments as unknown[])[0])
    );
  });

  test("the cancel's answer does not wait for the emails", async () => {
    const business = await makeBusiness("no-wait");
    const bookingId = await book(business);
    let answerResend = () => {};
    const resendAnswered = new Promise<void>((resolve) => (answerResend = resolve));
    answer = async () => {
      await resendAnswered; // Resend is slow: it answers only when the test lets it
      return json({ id: "email-slow" });
    };

    expect(await cancelBooking(bookingId, new Date("2026-10-02T15:00:00Z"))).toEqual({
      cancelled: true,
      alreadyCancelled: false,
    });
    expect(await cancellationEntriesOf(business)).toEqual([]); // answered while Resend works

    answerResend();
    await settled();
    expect(await cancellationEntriesOf(business)).toHaveLength(2);
  });
});
