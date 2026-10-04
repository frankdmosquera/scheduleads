// A moved booking's emails, against the local database with Resend faked: no test ever sends a real
// email. Every business here is a throwaway carrying this run's tag, removed after (its rows go
// with it). Test names match the feature's Simulate page and its planned checks.

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
  organization,
  pipelineStage,
  resource,
} = await import("@scheduleads-app/shared/db");
const { encryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { bookTime } = await import("../booking/book-time.js");
const { bookingEventWrites } = await import("../booking/booking-event-writes.js");
const { bookingConfirmationEmails } = await import("../booking/booking-confirmation-emails.js");
const { moveBooking } = await import("../booking/move-booking.js");
const { bookingEventMoves } = await import("../booking/booking-event-moves.js");
const { bookingMoveEmails } = await import("../booking/booking-move-emails.js");
const { cancelBooking } = await import("../booking/cancel-booking.js");
const { bookingEventRemovals } = await import("../booking/booking-event-removals.js");
const { bookingCancellationEmails } = await import("../booking/booking-cancellation-emails.js");
const { sendMoveEmails } = await import("./send-move-emails.js");

const tag = randomUUID().slice(0, 8);
const NINE = new Date("2026-10-05T15:00:00Z"); // Monday 9:00 in Edmonton
const TEN = new Date("2026-10-05T16:00:00Z");
const ELEVEN = new Date("2026-10-05T17:00:00Z");
const NOW = new Date("2026-10-02T14:00:00Z"); // the Friday before
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
// up to send unless a test leaves the key out.
async function makeBusiness(name: string, { key = true }: { key?: boolean } = {}) {
  const id = () => randomUUID();
  const business = id();
  await db.insert(organization).values({
    id: business,
    name: "Primo Painters",
    slug: `test-movemail-${name}-${tag}-dev`,
    senderEmail: "bookings@primopainters.com",
    notifyEmail: "office@primopainters.com",
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
  return { business, marco, estimate };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

const settled = async () => {
  await bookingEventWrites.settled();
  await bookingConfirmationEmails.settled();
  await bookingEventMoves.settled();
  await bookingMoveEmails.settled();
  await bookingEventRemovals.settled();
  await bookingCancellationEmails.settled();
};

// Booked at nine, then the emails waited for: the customer's answer does not wait, these tests do.
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
    now: NOW,
    ...changes,
  });
  await settled();
  if (!result.booked) throw new Error(`expected a booking, got ${result.reason}`);
  return result.booking.id;
};

// Moved, then the emails waited for. Only the move's own emails are kept in calls.
const move = async (bookingId: string, startsAt: Date) => {
  calls.length = 0;
  const result = await moveBooking({ bookingId, startsAt, personId: null, now: NOW });
  await settled();
  return result;
};

const moveEntriesOf = async (business: BusinessType) =>
  (
    await db
      .select({ payload: activity.payload, actorUserId: activity.actorUserId })
      .from(activity)
      .where(and(eq(activity.organizationId, business.business), eq(activity.type, "email_sent")))
      .orderBy(activity.occurredAt, sql`${activity.payload}->>'kind'`)
  ).filter((row) => String((row.payload as { kind: string }).kind).startsWith("booking_move"));

const decoded = (attachment: unknown) =>
  Buffer.from(String((attachment as { content: string }).content), "base64").toString("utf8");
const inviteOf = (call: ResendCallType | undefined) =>
  decoded((call?.body.attachments as unknown[])[0]);
const stampOf = (moment: Date) =>
  moment
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "");

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
  await db.delete(organization).where(like(organization.slug, `test-movemail-%-${tag}-dev`));
  await db.$client.end();
});

describe("a moved booking's emails", () => {
  test("a move sends both, Jane's invite carrying the booking's UID, the new times and the new sequence", async () => {
    const business = await makeBusiness("both");
    const bookingId = await book(business);
    // The confirmation's invite is number 0, so the move's 1 is the higher one calendars take.
    expect(inviteOf(calls.find((call) => call.body.attachments)).split("\r\n")).toContain(
      "SEQUENCE:0"
    );

    expect(await move(bookingId, TEN)).toEqual({ moved: true, unchanged: false });

    expect(calls).toHaveLength(2);
    const [toJane, toPrimo] = calls;
    expect(toJane.headers.get("Authorization")).toBe("Bearer re_primo_send_key");
    expect(toJane.headers.get("Idempotency-Key")).toBe(`booking-moved/${bookingId}/1`);
    expect(toJane.body).toMatchObject({
      from: '"Primo Painters" <bookings@primopainters.com>',
      to: [jane.email],
      subject: "Your booking with Primo Painters has moved: Monday, October 5 at 10:00 a.m. MDT",
    });
    expect(String(toJane.body.html)).toContain("Monday, October 5 at 9:00 a.m. MDT"); // the old time
    const [invite] = toJane.body.attachments as Record<string, unknown>[];
    expect(invite).toMatchObject({
      filename: "invite.ics",
      content_type: "text/calendar; charset=utf-8; method=REQUEST",
    });
    const lines = inviteOf(toJane).split("\r\n");
    expect(lines).toContain("METHOD:REQUEST");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain(`UID:${bookingId}`);
    expect(lines).toContain("SEQUENCE:1");
    expect(lines).toContain("DTSTART:20261005T160000Z");
    expect(lines).toContain("DTEND:20261005T170000Z");
    // Stamped with the moment of the move, read from its own timeline entry.
    const [entry] = await db
      .select({ occurredAt: activity.occurredAt })
      .from(activity)
      .where(
        and(eq(activity.organizationId, business.business), eq(activity.type, "booking_moved"))
      );
    expect(lines).toContain(`DTSTAMP:${stampOf(entry.occurredAt!)}`);

    expect(toPrimo.headers.get("Idempotency-Key")).toBe(
      `booking-moved-notification/${bookingId}/1`
    );
    expect(toPrimo.body).toMatchObject({
      to: ["office@primopainters.com"],
      reply_to: jane.email,
      subject: "Moved: Interior estimate, Monday, October 5 at 10:00 a.m. MDT",
    });
    expect(String(toPrimo.body.html)).toContain("Monday, October 5 at 9:00 a.m. MDT");
    expect(toPrimo.body.attachments).toBeUndefined();

    expect(await moveEntriesOf(business)).toEqual([
      { payload: { bookingId, kind: "booking_move", resendId: "email-3" }, actorUserId: null },
      {
        payload: { bookingId, kind: "booking_move_notification", resendId: "email-4" },
        actorUserId: null,
      },
    ]);
  });

  test("a second move sends a higher sequence under new keys", async () => {
    const business = await makeBusiness("second");
    const bookingId = await book(business);
    await move(bookingId, TEN);

    expect(await move(bookingId, ELEVEN)).toEqual({ moved: true, unchanged: false });

    expect(calls.map((call) => call.headers.get("Idempotency-Key"))).toEqual([
      `booking-moved/${bookingId}/2`,
      `booking-moved-notification/${bookingId}/2`,
    ]);
    const lines = inviteOf(calls[0]).split("\r\n");
    expect(lines).toContain("SEQUENCE:2");
    expect(lines).toContain("DTSTART:20261005T170000Z");
    expect(String(calls[0].body.html)).toContain("Monday, October 5 at 10:00 a.m. MDT"); // from ten
    expect(await moveEntriesOf(business)).toHaveLength(4);
  });

  test("a cancel after a move carries a sequence above the move's", async () => {
    const business = await makeBusiness("then-cancel");
    const bookingId = await book(business);
    await move(bookingId, TEN);
    calls.length = 0;

    await cancelBooking(bookingId, NOW);
    await settled();

    const lines = inviteOf(calls.find((call) => call.body.attachments)).split("\r\n");
    expect(lines).toContain("METHOD:CANCEL");
    expect(lines).toContain("SEQUENCE:2"); // the move's was 1
  });

  test("a phone-only booking sends only the business's", async () => {
    const business = await makeBusiness("phone-only");
    const bookingId = await book(business, { customer: { name: jane.name, phone: jane.phone } });

    await move(bookingId, TEN);

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ to: ["office@primopainters.com"] });
    expect(calls[0].body.reply_to).toBeUndefined();
  });

  test("a repeat of the same move sends nothing more", async () => {
    const business = await makeBusiness("twice");
    const bookingId = await book(business);
    await move(bookingId, TEN);

    expect(await move(bookingId, TEN)).toEqual({ moved: true, unchanged: true });
    expect(calls).toEqual([]);
    expect(await moveEntriesOf(business)).toHaveLength(2);
  });

  test("Resend failing keeps the move and logs one line", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // the SDK's own line outside production
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const business = await makeBusiness("resend-down");
    const bookingId = await book(business);
    answer = () =>
      json(
        { name: "application_error", statusCode: 500, message: `Failed for ${jane.email}` },
        500
      );

    expect(await move(bookingId, TEN)).toEqual({ moved: true, unchanged: false });

    expect(calls).toHaveLength(2); // both were tried
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(bookingId);
    expect(line).toContain("booking_move: Sending an email failed: application_error (500)");
    expect(line).not.toContain("@");
    expect(await moveEntriesOf(business)).toEqual([]);
    const [moved] = await db
      .select({ startsAt: booking.startsAt, sequence: booking.sequence })
      .from(booking)
      .where(eq(booking.id, bookingId));
    expect(moved).toEqual({ startsAt: TEN, sequence: 1 });
  });

  test("a business without its key moves and sends nothing, and logs it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const business = await makeBusiness("no-key", { key: false });
    const bookingId = await book(business);
    log.mockClear();

    expect(await move(bookingId, TEN)).toEqual({ moved: true, unchanged: false });

    expect(calls).toEqual([]);
    expect(log.mock.calls.map((call) => String(call[0]))).toContain(
      `[email] booking ${bookingId}: nothing sent, the business has no Resend key`
    );
  });

  test("sending a move's emails again sends the very same invite, under the same key", async () => {
    const business = await makeBusiness("same-again");
    const bookingId = await book(business);
    await move(bookingId, TEN);
    const first = calls.find((call) => call.body.attachments);
    calls.length = 0;

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 60 * 60_000)); // an hour later, as a retry would be
    try {
      await sendMoveEmails(business.business, bookingId, 1);
    } finally {
      vi.useRealTimers();
    }
    const again = calls.find((call) => call.body.attachments);

    expect(again?.headers.get("Idempotency-Key")).toBe(first?.headers.get("Idempotency-Key"));
    expect(inviteOf(again)).toBe(inviteOf(first));
  });

  test("an earlier move's emails, sent after a later move, still carry that move's times", async () => {
    const business = await makeBusiness("earlier");
    const bookingId = await book(business);
    await move(bookingId, TEN);
    await move(bookingId, ELEVEN);
    calls.length = 0;

    await sendMoveEmails(business.business, bookingId, 1);

    const lines = inviteOf(calls[0]).split("\r\n");
    expect(lines).toContain("SEQUENCE:1");
    expect(lines).toContain("DTSTART:20261005T160000Z");
    expect(lines).toContain("DTEND:20261005T170000Z");
    expect(calls[0].headers.get("Idempotency-Key")).toBe(`booking-moved/${bookingId}/1`);
    for (const call of calls) expect(String(call.body.subject)).toContain("10:00 a.m."); // not eleven
  });

  test("the move's answer does not wait for the emails", async () => {
    const business = await makeBusiness("no-wait");
    const bookingId = await book(business);
    let answerResend = () => {};
    const resendAnswered = new Promise<void>((resolve) => (answerResend = resolve));
    answer = async () => {
      await resendAnswered; // Resend is slow: it answers only when the test lets it
      return json({ id: "email-slow" });
    };

    expect(await moveBooking({ bookingId, startsAt: TEN, personId: null, now: NOW })).toEqual({
      moved: true,
      unchanged: false,
    });
    expect(await moveEntriesOf(business)).toEqual([]); // answered while Resend works

    answerResend();
    await settled();
    expect(await moveEntriesOf(business)).toHaveLength(2);
  });

  test("a booking cancelled since gets no move emails", async () => {
    const business = await makeBusiness("cancelled-since");
    const bookingId = await book(business);
    await move(bookingId, TEN);
    await cancelBooking(bookingId, NOW);
    await settled();
    calls.length = 0;

    expect(await sendMoveEmails(business.business, bookingId, 1)).toEqual([]);
    expect(calls).toEqual([]);
  });
});
