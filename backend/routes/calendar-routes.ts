// Backend: connecting a person's own calendar. The business and the person always come from
// the session, never from the request. Google is the only calendar today.

import { and, eq } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { validator } from "hono/validator";

import type { CalendarConnectOutcomeType } from "@scheduleads-app/shared/calendar";
import { calendarConnection } from "@scheduleads-app/shared/db";
import { busyCalendarsValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import { appOrigin, auth } from "../lib/auth/auth-server.js";
import { createOauthTicket } from "../lib/calendar/create-oauth-ticket.js";
import { disconnectCalendar } from "../lib/calendar/disconnect-calendar.js";
import { findCalendarChoices } from "../lib/calendar/find-calendar-choices.js";
import { findSignedInPerson } from "../lib/calendar/find-signed-in-person.js";
import { finishGoogleConnect } from "../lib/calendar/finish-google-connect.js";
import { googleOauthClient } from "../lib/calendar/google-oauth-client.js";
import { saveBusyCalendars } from "../lib/calendar/save-busy-calendars.js";
import { toCalendarChoices } from "../lib/calendar/to-calendar-choices.js";
import { warnConnectFailed } from "../lib/calendar/warn-connect-failed.js";
import { refuse } from "../lib/errors/refuse.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const noPersonMessage = "Your login is not linked to anyone on this business's calendar.";

// Why the calendar list cannot be shown or saved, in one answer each.
function refuseChoices(
  c: Context,
  reason: "no_connection" | "reconnect_needed" | "no_list_permission" | "unavailable"
) {
  if (reason === "no_connection") {
    return c.json(refuse("no_connection", "Connect your Google calendar first."), 409);
  }
  if (reason === "reconnect_needed") {
    return c.json(
      refuse(
        "reconnect_needed",
        "Reconnect your Google calendar. Until then none of your calendars is read, so customers cannot book you."
      ),
      409
    );
  }
  if (reason === "no_list_permission") {
    return c.json(
      refuse(
        "reconnect_needed",
        "Reconnect your Google calendar to choose which calendars count. Until then only your main calendar counts."
      ),
      409
    );
  }
  return c.json(
    refuse("unavailable", "Google did not answer. Nothing was changed. Try again in a minute."),
    503
  );
}

export const calendarRoutes = new Hono()
  // Your person and your connection, for the dashboard card. Never the tokens.
  .get(
    "/connection",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const activeOrganization = c.get("organization");
      const person = await findSignedInPerson(activeOrganization.organizationId, c.get("user").id);
      if (!person) return c.json({ person: null, connection: null }, 200);

      const [connection] = await db
        .select({
          provider: calendarConnection.provider,
          accountEmail: calendarConnection.accountEmail,
          status: calendarConnection.status,
          lastCheckedAt: calendarConnection.lastCheckedAt,
        })
        .from(calendarConnection)
        .where(
          and(
            eq(calendarConnection.organizationId, activeOrganization.organizationId),
            eq(calendarConnection.resourceId, person.id)
          )
        )
        .limit(1);

      return c.json({ person, connection: connection ?? null }, 200);
    }
  )

  // Pressing Connect: a ten-minute ticket, and Google's consent address to send the browser to.
  .post(
    "/connect",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const activeOrganization = c.get("organization");
      const userId = c.get("user").id;
      const person = await findSignedInPerson(activeOrganization.organizationId, userId);
      if (!person) return c.json(refuse("no_person", noPersonMessage), 409);

      const ticket = await createOauthTicket({
        userId,
        organizationId: activeOrganization.organizationId,
        resourceId: person.id,
      });

      return c.json({ url: googleOauthClient.consentUrl(ticket) }, 200);
    }
  )

  // Pressing Disconnect: your own calendar only. The answer says what happened at Google.
  .post(
    "/disconnect",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const activeOrganization = c.get("organization");
      const person = await findSignedInPerson(activeOrganization.organizationId, c.get("user").id);
      if (!person) return c.json(refuse("no_person", noPersonMessage), 409);

      const atProvider = await disconnectCalendar({
        organizationId: activeOrganization.organizationId,
        resourceId: person.id,
      });
      if (!atProvider) {
        return c.json(refuse("not_found", "There is no calendar connected to disconnect."), 404);
      }

      return c.json({ atProvider }, 200);
    }
  )

  // Your calendars and which count as busy, for the Calendar page (feature 12h).
  .get(
    "/calendars",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const person = await findSignedInPerson(organizationId, c.get("user").id);
      if (!person) return c.json(refuse("no_person", noPersonMessage), 409);

      const found = await findCalendarChoices({ organizationId, resourceId: person.id });
      if (!found.ok) return refuseChoices(c, found.reason);
      return c.json(toCalendarChoices(found.listed, found.picked), 200);
    }
  )

  // Saving which of your calendars count as busy. Only your own.
  .put(
    "/busy-calendars",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    validator("json", (value, c) => {
      const parsed = busyCalendarsValidationSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      const message = parsed.error.issues[0]?.message ?? "Check the list and try again.";
      return c.json({ ...refuse("bad_request", message), field: "calendarIds" }, 400);
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const person = await findSignedInPerson(organizationId, c.get("user").id);
      if (!person) return c.json(refuse("no_person", noPersonMessage), 409);

      const saved = await saveBusyCalendars({
        organizationId,
        resourceId: person.id,
        calendarIds: c.req.valid("json").calendarIds,
      });
      if (!saved.ok && saved.reason === "unknown_calendar") {
        return c.json(
          {
            ...refuse("bad_request", "One of those calendars is not in your Google account."),
            field: "calendarIds",
          },
          400
        );
      }
      if (!saved.ok) return refuseChoices(c, saved.reason);
      return c.json(saved.choices, 200);
    }
  )

  // Google sends the browser back here. Always ends on the Calendar page with one outcome; the
  // address is fixed, never taken from the request, so this can't redirect anywhere else.
  .get("/callback", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    const outcome: CalendarConnectOutcomeType = await finishGoogleConnect({
      userId: session?.user.id ?? null,
      state: c.req.query("state"),
      code: c.req.query("code"),
      error: c.req.query("error"),
    }).catch((unexpected: unknown) => {
      warnConnectFailed("the callback", unexpected);
      return "failed" as const;
    });

    return c.redirect(`${appOrigin}/settings/calendar?calendar=${outcome}`, 302);
  });
