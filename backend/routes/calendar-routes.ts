// Backend: connecting a person's own calendar. The business and the person always come from
// the session, never from the request. Google is the only calendar today.

import { and, eq } from "drizzle-orm";
import { Hono } from "hono";

import { calendarConnection } from "@scheduleads-app/shared/db";

import { db } from "../database.js";
import { appOrigin, auth } from "../lib/auth/auth-server.js";
import { createOauthTicket } from "../lib/calendar/create-oauth-ticket.js";
import { findSignedInPerson } from "../lib/calendar/find-signed-in-person.js";
import {
  finishGoogleConnect,
  type ConnectOutcomeType,
} from "../lib/calendar/finish-google-connect.js";
import { googleOauthClient } from "../lib/calendar/google-oauth-client.js";
import { warnConnectFailed } from "../lib/calendar/warn-connect-failed.js";
import { refuse } from "../lib/errors/refuse.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const noPersonMessage = "Your login is not linked to anyone on this business's calendar.";

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

  // Google sends the browser back here. Always ends on the dashboard with one outcome; the
  // address is fixed, never taken from the request, so this can't redirect anywhere else.
  .get("/callback", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    const outcome: ConnectOutcomeType = await finishGoogleConnect({
      userId: session?.user.id ?? null,
      state: c.req.query("state"),
      code: c.req.query("code"),
      error: c.req.query("error"),
    }).catch((unexpected: unknown) => {
      warnConnectFailed("the callback", unexpected);
      return "failed" as const;
    });

    return c.redirect(`${appOrigin}/?calendar=${outcome}`, 302);
  });
