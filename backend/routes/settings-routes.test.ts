// The owner's Hours settings, called through the real app against the local database. Every
// business, person and login here is a throwaway made below and removed after.

import { randomUUID } from "node:crypto";

import { and, eq, inArray, isNull } from "drizzle-orm";
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

assertLocalDevDatabase(process.env.DATABASE_URL, "run the settings route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { appOrigin } = await import("../lib/auth/auth-server.js");
const { availabilityRule, member, organization, resource, user } =
  await import("@scheduleads-app/shared/db");

const tag = randomUUID().slice(0, 8);
const makeTenant = (letter: string) => ({
  userId: randomUUID(),
  email: `hours-${letter}-${tag}@example.com`,
  organizationId: randomUUID(),
  slug: `test-hours-${letter}-${tag}-dev`,
  personId: randomUUID(),
});
const summit = makeTenant("s"); // has hours, a person and a place
const other = makeTenant("o"); // another business, with no hours yet
const fresh = makeTenant("f"); // a business just made on the client setup screen: no hours
const helper = { userId: randomUUID(), email: `hours-m-${tag}@example.com` }; // a member of Summit
const summitPlaceId = randomUUID();

const nineToFive = { startMinute: 540, endMinute: 1020 };
const summitHours = {
  weeklyHours: { mon: [nineToFive], tue: [nineToFive] },
  dateHours: [],
  timezone: "America/Edmonton",
  minimumNoticeMinutes: 240,
  horizonDays: 60,
};

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
const put = (path: string, email: string, body: unknown) =>
  app.request(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Origin: appOrigin, Cookie: cookies.get(email)! },
    body: JSON.stringify(body),
  });

const businessRowOf = async (organizationId: string) =>
  (
    await db
      .select()
      .from(availabilityRule)
      .where(
        and(
          eq(availabilityRule.organizationId, organizationId),
          isNull(availabilityRule.resourceId)
        )
      )
  )[0];

beforeAll(async () => {
  await db.insert(user).values(
    [summit, other, fresh, helper].map((t) => ({
      id: t.userId,
      name: "",
      email: t.email,
      emailVerified: true,
    }))
  );
  await db
    .insert(organization)
    .values(
      [summit, other, fresh].map((t) => ({ id: t.organizationId, name: t.slug, slug: t.slug }))
    );
  await db.insert(member).values([
    ...[summit, other, fresh].map((t) => ({
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
  await db.insert(resource).values([
    ...[summit, other, fresh].map((t) => ({
      id: t.personId,
      organizationId: t.organizationId,
      name: "Juan",
      kind: "person",
    })),
    { id: summitPlaceId, organizationId: summit.organizationId, name: "Room 1", kind: "place" },
  ]);
  await db.insert(availabilityRule).values({
    id: randomUUID(),
    organizationId: summit.organizationId,
    resourceId: null,
    ...summitHours,
    closedDates: [],
  });
  for (const email of [summit.email, other.email, fresh.email, helper.email])
    cookies.set(email, await signIn(email));
});

afterAll(async () => {
  await db
    .delete(organization)
    .where(
      inArray(organization.id, [summit.organizationId, other.organizationId, fresh.organizationId])
    );
  await db
    .delete(user)
    .where(inArray(user.id, [summit.userId, other.userId, fresh.userId, helper.userId]));
  await db.$client.end();
});

describe("the Hours settings", () => {
  test("a member who may not change the business cannot save hours", async () => {
    // The member reads the hours, told they cannot change them; the owner can.
    const read = await get("/settings/hours", helper.email);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ canEdit: false, business: summitHours });
    const ownerRead = await get("/settings/hours", summit.email);
    expect(await ownerRead.json()).toMatchObject({ canEdit: true });

    // Both saves are refused, and nothing changed.
    const week = { ...summitHours, weeklyHours: { mon: [{ startMinute: 600, endMinute: 660 }] } };
    expect((await put("/settings/hours/business", helper.email, week)).status).toBe(403);
    const personSave = await put(`/settings/hours/people/${summit.personId}`, helper.email, {
      weeklyHours: null,
      dateHours: [],
    });
    expect(personSave.status).toBe(403);
    expect((await businessRowOf(summit.organizationId)).weeklyHours).toEqual(
      summitHours.weeklyHours
    );
  });

  test("another business's person and a place get the same 404", async () => {
    const hours = { weeklyHours: { wed: [nineToFive] }, dateHours: [] };
    const foreign = await put(`/settings/hours/people/${other.personId}`, summit.email, hours);
    const place = await put(`/settings/hours/people/${summitPlaceId}`, summit.email, hours);
    const unknown = await put(`/settings/hours/people/${randomUUID()}`, summit.email, hours);
    expect([foreign.status, place.status, unknown.status]).toEqual([404, 404, 404]);
    const [a, b, c] = await Promise.all([foreign.json(), place.json(), unknown.json()]);
    expect(a).toEqual(c);
    expect(b).toEqual(c);

    // The other business's person got no row of Summit's or their own.
    const rows = await db
      .select()
      .from(availabilityRule)
      .where(inArray(availabilityRule.resourceId, [other.personId, summitPlaceId]));
    expect(rows).toEqual([]);
  });

  test("a person's save before the business has hours is refused", async () => {
    const response = await put(`/settings/hours/people/${other.personId}`, other.email, {
      weeklyHours: { mon: [nineToFive] },
      dateHours: [],
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "no_business_hours" } });
  });

  test("the first save makes the business's row and later saves keep its closed days and holidays", async () => {
    expect(await (await get("/settings/hours", fresh.email)).json()).toMatchObject({
      business: null,
      people: [{ id: fresh.personId, name: "Juan", weeklyHours: null, dateHours: [] }],
    });

    // The first save makes the row, with no closed days and no holidays; windows are stored in order.
    const first = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      weeklyHours: {
        mon: [
          { startMinute: 780, endMinute: 1020 },
          { startMinute: 540, endMinute: 720 },
        ],
      },
    });
    expect(first.status).toBe(200);
    const made = await businessRowOf(fresh.organizationId);
    expect(made.weeklyHours).toEqual({
      mon: [
        { startMinute: 540, endMinute: 720 },
        { startMinute: 780, endMinute: 1020 },
      ],
    });
    expect([made.closedDates, made.holidayCountry, made.closedHolidays]).toEqual([[], null, []]);

    // The closed days screen (12e) sets these; a later hours save must leave them alone.
    await db
      .update(availabilityRule)
      .set({
        closedDates: ["2026-12-24"],
        holidayCountry: "CA",
        holidayRegion: "AB",
        closedHolidays: ["Family Day"],
      })
      .where(eq(availabilityRule.id, made.id));
    const later = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      timezone: "America/Toronto",
      horizonDays: 30,
    });
    expect(later.status).toBe(200);
    const kept = await businessRowOf(fresh.organizationId);
    expect(kept.id).toBe(made.id);
    expect([kept.timezone, kept.horizonDays]).toEqual(["America/Toronto", 30]);
    expect([
      kept.closedDates,
      kept.holidayCountry,
      kept.holidayRegion,
      kept.closedHolidays,
    ]).toEqual([["2026-12-24"], "CA", "AB", ["Family Day"]]);

    // And the save cannot be used to send them: they are not part of what it takes.
    const sneaky = await put("/settings/hours/business", fresh.email, {
      ...summitHours,
      closedDates: [],
    });
    expect(sneaky.status).toBe(400);
  });

  test("back to the business's week keeps the person's one-off dates", async () => {
    const oneOff = [{ date: "2026-11-02", windows: [{ startMinute: 480, endMinute: 600 }] }];
    const own = await put(`/settings/hours/people/${summit.personId}`, summit.email, {
      weeklyHours: { sat: [nineToFive] },
      dateHours: oneOff,
    });
    expect(own.status).toBe(200);

    const back = await put(`/settings/hours/people/${summit.personId}`, summit.email, {
      weeklyHours: null,
      dateHours: oneOff,
    });
    expect(back.status).toBe(200);
    const read = (await (await get("/settings/hours", summit.email)).json()) as {
      people: { id: string; weeklyHours: unknown; dateHours: unknown }[];
    };
    expect(read.people.find((person) => person.id === summit.personId)).toMatchObject({
      weeklyHours: null,
      dateHours: oneOff,
    });
  });
});
