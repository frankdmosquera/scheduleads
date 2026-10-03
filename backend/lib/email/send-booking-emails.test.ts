// A booking's emails, sent once it is saved, against the local database with Resend faked: no test
// ever sends a real email. Every business here is a throwaway carrying this run's tag, removed
// after (its rows go with it). The test names match the feature's Simulate page.

import { randomUUID } from "node:crypto";

import { and, eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the code reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the token key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the booking email tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../../app.js");
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
const { sendBookingEmails } = await import("./send-booking-emails.js");
const { appOrigin } = await import("../auth/auth-server.js");
const { readBookingPageToken } = await import("../booking/booking-page-token.js");

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
    slug: `test-emails-${name}-${tag}-dev`,
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
  return { business, marco, estimate, slug: `test-emails-${name}-${tag}-dev` };
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
    .orderBy(sql`${activity.payload}->>'kind'`); // the confirmation, then the notification

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
  await db.delete(organization).where(like(organization.slug, `test-emails-%-${tag}-dev`));
  await db.delete(user).where(like(user.email, `owner-%-${tag}@example.com`));
  await db.$client.end();
});

describe("a booking's emails", () => {
  test("a booking with an email sends both, the invite attached to the customer's, and writes two timeline entries", async () => {
    const business = await makeBusiness("both");
    const bookingId = await book(business);

    expect(calls).toHaveLength(2);
    const [confirmation, notification] = calls;
    expect(confirmation.headers.get("Authorization")).toBe("Bearer re_primo_send_key"); // the business's own
    expect(confirmation.headers.get("Idempotency-Key")).toBe(`booking-confirmation/${bookingId}`);
    expect(confirmation.body).toMatchObject({
      from: '"Primo Painters" <bookings@primopainters.com>',
      to: [jane.email],
      subject: "You're booked with Primo Painters: Monday, October 5 at 9:00 a.m. MDT",
    });
    expect(confirmation.body.reply_to).toBeUndefined();
    const [invite] = confirmation.body.attachments as Record<string, unknown>[];
    expect(invite).toMatchObject({
      filename: "invite.ics",
      content_type: "text/calendar; charset=utf-8; method=REQUEST",
    });
    expect(decoded(invite)).toContain(`\r\nUID:${bookingId}\r\n`);
    expect(decoded(invite)).toContain("\r\nDTSTART:20261005T150000Z\r\nDTEND:20261005T160000Z\r\n");

    expect(notification.headers.get("Idempotency-Key")).toBe(`booking-notification/${bookingId}`);
    expect(notification.body).toMatchObject({
      from: '"Primo Painters" <bookings@primopainters.com>',
      to: ["office@primopainters.com"],
      reply_to: jane.email, // pressing Reply writes to Jane
      subject: "New booking: Interior estimate, Monday, October 5 at 9:00 a.m. MDT",
    });
    expect(notification.body.attachments).toBeUndefined();

    expect(await timelineOf(business)).toEqual([
      {
        payload: { bookingId, kind: "booking_confirmation", resendId: "email-1" },
        actorUserId: null,
      },
      {
        payload: { bookingId, kind: "booking_notification", resendId: "email-2" },
        actorUserId: null,
      },
    ]);
  });

  test("the confirmation carries a link that opens the same booking's page", async () => {
    const business = await makeBusiness("page-link");
    const bookingId = await book(business);

    const [confirmation] = calls;
    const html = String(confirmation.body.html);
    const page = `${appOrigin}/b/`;
    const at = html.indexOf(`href="${page}`);
    expect(at).toBeGreaterThan(-1);
    const link = html.slice(at + 'href="'.length, html.indexOf('"', at + 'href="'.length));
    expect(readBookingPageToken(link.slice(page.length))).toBe(bookingId);
    expect(String(confirmation.body.text)).toContain(link);
  });

  test("the business's notification carries no link", async () => {
    const business = await makeBusiness("no-page-link");
    await book(business);

    const [, notification] = calls;
    expect(notification.body.to).toEqual(["office@primopainters.com"]);
    expect(`${notification.body.html}
${notification.body.text}`).not.toContain("/b/");
  });

  test("a phone-only booking sends only the business's", async () => {
    const business = await makeBusiness("phone-only");
    const bookingId = await book(business, { customer: { name: jane.name, phone: jane.phone } });

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ to: ["office@primopainters.com"] });
    expect(calls[0].body.reply_to).toBeUndefined(); // nobody to reply to
    expect(await timelineOf(business)).toEqual([
      {
        payload: { bookingId, kind: "booking_notification", resendId: "email-1" },
        actorUserId: null,
      },
    ]);
  });

  test("a booking the owner makes sends only the customer's confirmation", async () => {
    const business = await makeBusiness("owner-made");
    const owner = await makeOwner(business, "made");
    const bookingId = await book(business, {
      source: "manual",
      actorUserId: owner,
      requestKey: null,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].body).toMatchObject({ to: [jane.email] });
    expect(await timelineOf(business)).toEqual([
      {
        payload: { bookingId, kind: "booking_confirmation", resendId: "email-1" },
        actorUserId: null,
      },
    ]);
  });

  test("a resent form sends nothing more", async () => {
    const business = await makeBusiness("resent");
    const requestKey = randomUUID();
    const first = await book(business, { requestKey });
    const second = await book(business, { requestKey });

    expect(second).toBe(first);
    expect(calls).toHaveLength(2); // the first copy's two emails, and nothing for the second
    expect(await timelineOf(business)).toHaveLength(2);
  });

  test("Resend failing keeps the booking, logs one line with no address, and writes no entry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {}); // the SDK's own line outside production
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    answer = () =>
      json(
        { name: "application_error", statusCode: 500, message: `Failed for ${jane.email}` },
        500
      );
    const business = await makeBusiness("resend-down");
    const bookingId = await book(business);

    expect(calls).toHaveLength(2); // both were tried
    const saved = await db
      .select({ id: booking.id })
      .from(booking)
      .where(and(eq(booking.organizationId, business.business), eq(booking.id, bookingId)));
    expect(saved).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(bookingId);
    expect(line).toContain(
      "booking_confirmation: Sending an email failed: application_error (500)"
    );
    expect(line).not.toContain("@");
    expect(await timelineOf(business)).toEqual([]);
  });

  test("a business missing its addresses or its key sends nothing and logs it", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const cases = [
      { name: "no-sender", setup: { senderEmail: null }, missing: "sender address" },
      { name: "no-notify", setup: { notifyEmail: null }, missing: "notification address" },
      { name: "no-key", setup: { key: false }, missing: "Resend key" },
    ];
    for (const { name, setup, missing } of cases) {
      log.mockClear();
      const business = await makeBusiness(name, setup);
      const bookingId = await book(business);

      expect(calls).toEqual([]);
      expect(await timelineOf(business)).toEqual([]);
      const lines = log.mock.calls.map((call) => String(call[0]));
      expect(lines).toContain(
        `[email] booking ${bookingId}: nothing sent, the business has no ${missing}`
      );
    }
  });

  test("a business with no time zone sends nothing and logs it", async () => {
    const business = await makeBusiness("no-zone");
    const bookingId = await book(business);
    calls.length = 0;
    await db.delete(availabilityRule).where(eq(availabilityRule.organizationId, business.business));
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    expect(await sendBookingEmails(business.business, bookingId)).toEqual([]);
    expect(calls).toEqual([]);
    expect(log).toHaveBeenCalledWith(
      `[email] booking ${bookingId}: nothing sent, the business has no time zone`
    );
  });

  test("the route's answer does not wait for the emails", async () => {
    const business = await makeBusiness("no-wait");
    let answerResend = () => {};
    const resendAnswered = new Promise<void>((resolve) => (answerResend = resolve));
    answer = async () => {
      await resendAnswered; // Resend is slow: it answers only when the test lets it
      return json({ id: "email-slow" });
    };

    const response = await app.request(`/public/${business.slug}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingLinkId: business.estimate,
        startsAt: (await freeStart(business)).toISOString(),
        personId: business.marco,
        requestKey: randomUUID(),
        customer: { name: jane.name, email: jane.email, phone: jane.phone },
        location: jane.location,
        details: jane.details,
      }),
    });
    expect(response.status).toBe(201); // answered while Resend still works
    expect(await timelineOf(business)).toEqual([]);

    answerResend();
    await settled();
    expect(await timelineOf(business)).toHaveLength(2);
  });

  test("no log line or timeline payload carries a customer's details", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const lines: string[] = [];
    const keep = (...args: unknown[]) => lines.push(args.map(String).join(" "));
    vi.spyOn(console, "log").mockImplementation(keep);
    vi.spyOn(console, "warn").mockImplementation(keep);
    vi.spyOn(console, "info").mockImplementation(keep);

    const sent = await makeBusiness("private-sent");
    await book(sent);
    const notSetUp = await makeBusiness("private-not-set-up", { key: false });
    await book(notSetUp);
    answer = () => json({ name: "application_error", statusCode: 500, message: jane.email }, 500);
    const failing = await makeBusiness("private-failing");
    await book(failing);

    expect(lines.length).toBeGreaterThanOrEqual(2); // the not-set-up line and the failure line
    const payloads = await db
      .select({ payload: activity.payload })
      .from(activity)
      .where(
        and(
          inArray(activity.organizationId, [sent.business, notSetUp.business, failing.business]),
          eq(activity.type, "email_sent")
        )
      );
    expect(payloads).toHaveLength(2);
    const everything = `${lines.join("\n")}\n${JSON.stringify(payloads)}`;
    for (const detail of [jane.name, "Jane", jane.email, jane.phone, jane.location, jane.details]) {
      expect(everything).not.toContain(detail);
    }
  });

  // Vitest fails the run on an unhandled rejection, so a send that could escape would fail here.
  test("a send that fails before Resend keeps the booking and logs one line, never crashing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const business = await makeBusiness("unreadable-key", { key: false });
    await db.insert(emailSendingKey).values({
      organizationId: business.business,
      credentials: encryptCredentials("re_primo_send_key", readTokenKey(), randomUUID()), // locked for another business
    });
    const bookingId = await book(business);

    expect(calls).toEqual([]);
    expect(await timelineOf(business)).toEqual([]);
    const saved = await db
      .select({ id: booking.id })
      .from(booking)
      .where(and(eq(booking.organizationId, business.business), eq(booking.id, bookingId)));
    expect(saved).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(`[email] no emails for booking ${bookingId}: `);
    for (const detail of ["Jane", jane.email, jane.phone, jane.location, "re_primo"]) {
      expect(line).not.toContain(detail);
    }
  });

  test("a cancelled booking sends nothing", async () => {
    const business = await makeBusiness("cancelled");
    const bookingId = await book(business);
    calls.length = 0;
    await db.update(booking).set({ status: "cancelled" }).where(eq(booking.id, bookingId));

    expect(await sendBookingEmails(business.business, bookingId)).toEqual([]);
    expect(calls).toEqual([]);
  });

  test("another business's booking is refused and nothing is sent", async () => {
    const mine = await makeBusiness("mine");
    const theirs = await makeBusiness("theirs");
    const theirBooking = await book(theirs);
    calls.length = 0;

    await expect(sendBookingEmails(mine.business, theirBooking)).rejects.toThrow(
      "no such booking in this business"
    );
    expect(calls).toEqual([]);
  });

  test("sending a booking's emails again sends the very same invite and link, under the same key", async () => {
    const business = await makeBusiness("same-again");
    const bookingId = await book(business);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 60 * 60_000)); // an hour later, as a retry would be
    try {
      await sendBookingEmails(business.business, bookingId);
    } finally {
      vi.useRealTimers();
    }

    const confirmations = calls.filter((call) =>
      call.headers.get("Idempotency-Key")?.startsWith("booking-confirmation/")
    );
    expect(confirmations).toHaveLength(2);
    expect(confirmations[1].headers.get("Idempotency-Key")).toBe(
      confirmations[0].headers.get("Idempotency-Key")
    );
    const [first, second] = confirmations.map((call) =>
      decoded((call.body.attachments as unknown[])[0])
    );
    expect(second).toBe(first); // DTSTAMP is the booking's own moment, not the send's
    expect(confirmations[1].body.html).toBe(confirmations[0].body.html); // the signed link is the same
  });
});

// Monday's 9:00, the first free start a week or more ahead, as the route checks the real clock.
async function freeStart(business: BusinessType): Promise<Date> {
  const from = new Date();
  for (let day = 7; day < 50; day++) {
    const date = new Date(from.getTime() + day * 86_400_000);
    if (
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton", weekday: "short" }).format(
        date
      ) === "Mon"
    ) {
      const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Edmonton" }).format(date);
      const response = await app.request(
        `/public/${business.slug}/booking-links/${business.estimate}/times?from=${ymd}&to=${ymd}&person=${business.marco}`
      );
      const [first] = (await response.json()).startTimes as string[];
      if (first) return new Date(first);
    }
  }
  throw new Error("No free Monday found.");
}
