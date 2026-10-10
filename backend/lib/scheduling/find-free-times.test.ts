// Free times for a service, against the local database: every reader it gathers, together. Every
// business here is a throwaway carrying this run's tag, removed after (its rows go with it). Google is
// never called: a person with no connection has no Google busy time, and the unreadable case is a
// connection marked as needing reconnection.

import { randomUUID } from "node:crypto";

import { eq, like } from "drizzle-orm";
import { afterAll, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the free times tests");

// Imported after the env is loaded: they read it the moment they load.
const { db } = await import("../../database.js");
const {
  availabilityRule,
  bookingLink,
  bookingLinkResource,
  calendarConnection,
  organization,
  resource,
  standbyDate,
} = await import("@scheduleads-app/shared/db");
const { findFreeTimes } = await import("./find-free-times.js");
const { holdTime } = await import("./hold-time.js");
const { CalendarUnavailableError } = await import("../calendar/calendar-unavailable-error.js");
const { CalendarReconnectNeededError } =
  await import("../calendar/calendar-reconnect-needed-error.js");
const { saveCalendarConnection } = await import("../calendar/save-calendar-connection.js");

const tag = randomUUID().slice(0, 8);
const MONDAY = "2026-10-05";
const fridayMorning = new Date("2026-10-02T14:00:00Z"); // 8:00 in Edmonton (UTC-6)
const at = (time: string) => new Date(`${time}Z`);
const iso = (time: string) => `${time}.000Z`;

// A clinic of its own: Ana and Mei bookable Mondays 9:00 to 12:00, Room 3. A facial (75 minutes,
// 15 after) both of them do with no room; a peel (30 minutes, every 15) anyone does in Room 3.
async function makeClinic(name: string) {
  const business = randomUUID();
  const id = () => randomUUID();
  await db.insert(organization).values({ id: business, name, slug: `test-free-${name}-${tag}` });
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
  const ana = id();
  const mei = id();
  const room3 = id();
  await db.insert(resource).values([
    { id: ana, organizationId: business, name: "Ana", kind: "person" },
    { id: mei, organizationId: business, name: "Mei", kind: "person" },
    { id: room3, organizationId: business, name: "Room 3", kind: "place" },
  ]);
  const facial = id();
  const peel = id();
  await db.insert(bookingLink).values([
    {
      id: facial,
      organizationId: business,
      name: "Facial",
      slug: "facial",
      durationMinutes: 75,
      layout: "month",
      personChoice: "customer_picks",
      bufferAfterMinutes: 15,
    },
    {
      id: peel,
      organizationId: business,
      name: "Peel",
      slug: "peel",
      durationMinutes: 30,
      layout: "month",
      personChoice: "customer_picks",
      slotIntervalMinutes: 15,
    },
  ]);
  await db.insert(bookingLinkResource).values([
    { organizationId: business, bookingLinkId: facial, resourceId: ana },
    { organizationId: business, bookingLinkId: facial, resourceId: mei },
    { organizationId: business, bookingLinkId: peel, resourceId: room3 },
  ]);
  return { business, ana, mei, room3, facial, peel };
}

const times = (input: Parameters<typeof findFreeTimes>[0]) =>
  findFreeTimes(input).then((answer) => answer?.startTimes);

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-free-%-${tag}`));
  await db.$client.end();
});

describe("free times for a service", () => {
  test("a picked practitioner's times, with the time zone and who can be picked", async () => {
    const clinic = await makeClinic("picked");
    const answer = await findFreeTimes({
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      personId: clinic.ana,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    });
    expect(answer).toEqual({
      timezone: "America/Edmonton",
      people: [
        { id: clinic.ana, name: "Ana" },
        { id: clinic.mei, name: "Mei" },
      ],
      startTimes: [iso("2026-10-05T15:00:00"), iso("2026-10-05T16:15:00")],
    });
  });

  test('"any available" is everyone\'s times together', async () => {
    const clinic = await makeClinic("any");
    // Ana is booked 9:00 to 10:15, so only Mei can take 9:00; both can take 10:15.
    await holdTime(clinic.business, {
      resourceIds: [clinic.ana],
      startsAt: at("2026-10-05T15:00:00"),
      endsAt: at("2026-10-05T16:15:00"),
      kind: "booking",
    });
    const base = {
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    };
    expect(await times({ ...base, personId: clinic.ana })).toEqual([iso("2026-10-05T16:15:00")]);
    expect(await times({ ...base, personId: null })).toEqual([
      iso("2026-10-05T15:00:00"),
      iso("2026-10-05T16:15:00"),
    ]);
  });

  test("held time removes the times it covers, buffers included", async () => {
    const clinic = await makeClinic("held");
    // Held 11:35 to noon: 10:15 runs to 11:30, but its 15 after reaches 11:45, so it goes too.
    await holdTime(clinic.business, {
      resourceIds: [clinic.ana],
      startsAt: at("2026-10-05T17:35:00"),
      endsAt: at("2026-10-05T18:00:00"),
      kind: "time_off",
    });
    expect(
      await times({
        organizationId: clinic.business,
        bookingLinkId: clinic.facial,
        personId: clinic.ana,
        fromDate: MONDAY,
        toDate: MONDAY,
        now: fridayMorning,
      })
    ).toEqual([iso("2026-10-05T15:00:00")]);
  });

  test("standby removes that person on that date only", async () => {
    const clinic = await makeClinic("standby");
    await db
      .insert(standbyDate)
      .values({ organizationId: clinic.business, resourceId: clinic.ana, date: MONDAY });
    expect(
      await times({
        organizationId: clinic.business,
        bookingLinkId: clinic.facial,
        personId: clinic.ana,
        fromDate: MONDAY,
        toDate: "2026-10-12",
        now: fridayMorning,
      })
    ).toEqual([iso("2026-10-12T15:00:00"), iso("2026-10-12T16:15:00")]);
  });

  test("a taken room removes the time, and the service's own step is read", async () => {
    const clinic = await makeClinic("room");
    await holdTime(clinic.business, {
      resourceIds: [clinic.room3],
      startsAt: at("2026-10-05T15:00:00"),
      endsAt: at("2026-10-05T15:30:00"),
      kind: "booking",
    });
    const peel = await times({
      organizationId: clinic.business,
      bookingLinkId: clinic.peel,
      personId: null,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    });
    // Every 15 minutes from 9:00; Room 3 is taken until 9:30, so the first is 9:30.
    expect(peel?.slice(0, 3)).toEqual([
      iso("2026-10-05T15:30:00"),
      iso("2026-10-05T15:45:00"),
      iso("2026-10-05T16:00:00"),
    ]);
  });

  test("an inactive service answers nothing", async () => {
    const clinic = await makeClinic("inactive");
    await db.update(bookingLink).set({ active: false }).where(eq(bookingLink.id, clinic.facial));
    expect(
      await findFreeTimes({
        organizationId: clinic.business,
        bookingLinkId: clinic.facial,
        personId: null,
        fromDate: MONDAY,
        toDate: MONDAY,
        now: fridayMorning,
      })
    ).toBeNull();
  });

  test("another business's person, or a missing service, answers nothing", async () => {
    const clinic = await makeClinic("mine");
    const other = await makeClinic("other");
    const base = {
      organizationId: clinic.business,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    };
    expect(
      await findFreeTimes({ ...base, bookingLinkId: clinic.facial, personId: other.ana })
    ).toBeNull();
    expect(
      await findFreeTimes({ ...base, bookingLinkId: other.facial, personId: null })
    ).toBeNull();
  });

  test('a calendar needing reconnection fails when picked, and is left out of "any available"', async () => {
    const clinic = await makeClinic("calendar");
    await db.insert(calendarConnection).values({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId: clinic.mei,
      provider: "google",
      accountEmail: "mei@example.com",
      credentials: "not read: the connection needs reconnecting first",
      grantedScopes: "",
      status: "needs_reconnect",
    });
    // Ana is booked all morning, so only Mei could offer anything: with her calendar unreadable,
    // "any available" must show nothing rather than read her as free.
    await holdTime(clinic.business, {
      resourceIds: [clinic.ana],
      startsAt: at("2026-10-05T15:00:00"),
      endsAt: at("2026-10-05T18:00:00"),
      kind: "time_off",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const base = {
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    };
    const picked = await findFreeTimes({ ...base, personId: clinic.mei }).catch((error) => error);
    expect(picked).toBeInstanceOf(CalendarUnavailableError);
    expect(picked.cause).toBeInstanceOf(CalendarReconnectNeededError); // the reason travels with it
    expect(await times({ ...base, personId: null })).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(2); // once when picked, once when left out
    warn.mockRestore();
  });

  test('"any available" with no calendar readable is "try again", never an empty week', async () => {
    const clinic = await makeClinic("unreadable");
    const needsReconnect = (resourceId: string, name: string) => ({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId,
      provider: "google" as const,
      accountEmail: `${name}@example.com`,
      credentials: "not read: the connection needs reconnecting first",
      grantedScopes: "",
      status: "needs_reconnect" as const,
    });
    await db
      .insert(calendarConnection)
      .values([needsReconnect(clinic.ana, "ana"), needsReconnect(clinic.mei, "mei")]);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const answer = await findFreeTimes({
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      personId: null,
      fromDate: MONDAY,
      toDate: MONDAY,
      now: fridayMorning,
    }).catch((error) => error);
    warn.mockRestore();
    expect(answer).toBeInstanceOf(CalendarUnavailableError);
  });

  test("a person's Google busy time removes the times it covers", async () => {
    const clinic = await makeClinic("google");
    await saveCalendarConnection({
      organizationId: clinic.business,
      resourceId: clinic.mei,
      accountEmail: `mei-${tag}@gmail.com`,
      grantedScopes: ["openid", "email"],
      credentials: {
        refreshToken: "1//saved-refresh",
        accessToken: "ya29.saved-access",
        accessTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      },
    });
    // Google, faked: Mei has an event 9:00 to 9:30 on Monday. No test ever reaches Google.
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url !== "https://www.googleapis.com/calendar/v3/freeBusy") {
        throw new Error(`A test tried to reach ${url}.`);
      }
      const busy = [{ start: "2026-10-05T15:00:00Z", end: "2026-10-05T15:30:00Z" }];
      return new Response(JSON.stringify({ calendars: { primary: { busy } } }), {
        headers: { "Content-Type": "application/json" },
      });
    });
    try {
      expect(
        await times({
          organizationId: clinic.business,
          bookingLinkId: clinic.facial,
          personId: clinic.mei,
          fromDate: MONDAY,
          toDate: MONDAY,
          now: fridayMorning,
        })
      ).toEqual([iso("2026-10-05T16:15:00")]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  test("taken time late on the last date, already the next day in UTC, is still seen", async () => {
    const clinic = await makeClinic("evening");
    // Mei works 17:00 to 19:30 that Monday and is busy 18:30 to 19:30, which is Tuesday in UTC: it
    // takes 18:15 away (its 15 after reaches 19:45) and leaves 17:00, which ends as it starts.
    await db.insert(availabilityRule).values({
      id: randomUUID(),
      organizationId: clinic.business,
      resourceId: clinic.mei,
      dateHours: [{ date: MONDAY, windows: [{ startMinute: 1020, endMinute: 1170 }] }],
    });
    await holdTime(clinic.business, {
      resourceIds: [clinic.mei],
      startsAt: at("2026-10-06T00:30:00"),
      endsAt: at("2026-10-06T01:30:00"),
      kind: "booking",
    });
    expect(
      await times({
        organizationId: clinic.business,
        bookingLinkId: clinic.facial,
        personId: clinic.mei,
        fromDate: MONDAY,
        toDate: MONDAY,
        now: fridayMorning,
      })
    ).toEqual([iso("2026-10-05T23:00:00")]);
  });

  test("a range the wrong way round has no times and no error", async () => {
    const clinic = await makeClinic("backwards");
    const answer = await findFreeTimes({
      organizationId: clinic.business,
      bookingLinkId: clinic.facial,
      personId: null,
      fromDate: "2026-10-12",
      toDate: MONDAY,
      now: fridayMorning,
    });
    expect(answer?.startTimes).toEqual([]);
  });
});
