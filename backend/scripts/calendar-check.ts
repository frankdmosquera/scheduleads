// Backend script: prints one person's busy times from their connected calendar, the proof
// that a connection reads the real calendar. Local _dev database only; prints no tokens.
// Run: npm run calendar:check --workspace=backend -- <login email> [days]

import { eq } from "drizzle-orm";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

import type { BusyBlockType } from "../lib/calendar/calendar-provider.js";

assertLocalDevDatabase(process.env.DATABASE_URL, "check a calendar");

const DAY_MS = 24 * 60 * 60 * 1000;
const [email, daysArgument = "7"] = process.argv.slice(2);
const days = Number(daysArgument);
if (!email || !Number.isInteger(days) || days < 1 || days > 31) {
  console.error(
    "Usage: npm run calendar:check --workspace=backend -- <login email> [days, 1 to 31]"
  );
  process.exit(1);
}

// Imported after the guard: the database pool is made the moment it loads.
const { db } = await import("../database.js");
const { calendarConnection } = await import("@scheduleads-app/shared/db");
const { findCalendarCheckTarget } = await import("./find-calendar-check-target.js");
const { getBusyTimes } = await import("../lib/calendar/get-busy-times.js");
const { CalendarReconnectNeededError } =
  await import("../lib/calendar/calendar-reconnect-needed-error.js");
const { safeErrorReason } = await import("../lib/errors/safe-error-reason.js");

// "Wed 30 Sep, 10:00 to 11:00", in the business's time zone, not the laptop's.
function describeBlock({ start, end }: BusyBlockType, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const endDay = day.format(end) === day.format(start) ? "" : `${day.format(end)}, `;
  return `${day.format(start)}, ${time.format(start)} to ${endDay}${time.format(end)}`;
}

try {
  const target = await findCalendarCheckTarget(email);
  const [connection] = await db
    .select({ accountEmail: calendarConnection.accountEmail })
    .from(calendarConnection)
    .where(eq(calendarConnection.resourceId, target.resourceId))
    .limit(1);

  // A business's first person starts with the business's name, so it is said once then.
  const who =
    target.personName === target.businessName
      ? target.personName
      : `${target.personName} (${target.businessName})`;

  if (!connection) {
    console.log(`${who} has no calendar connected.`);
  } else {
    const from = new Date();
    const busy = await getBusyTimes({
      organizationId: target.organizationId,
      resourceId: target.resourceId,
      from,
      to: new Date(from.getTime() + days * DAY_MS),
    });

    console.log(
      `Busy times for ${who}, ` +
        `calendar ${connection.accountEmail}, the next ${days} days, in ${target.timezone}:`
    );
    if (busy.length === 0) console.log("  none");
    for (const block of busy) console.log(`  ${describeBlock(block, target.timezone)}`);
  }
} catch (error) {
  if (error instanceof CalendarReconnectNeededError) {
    console.error("Google no longer accepts this connection. Reconnect it from the dashboard.");
  } else {
    console.error(safeErrorReason(error));
  }
  process.exitCode = 1;
} finally {
  await db.$client.end();
}
