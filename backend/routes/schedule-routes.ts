// Backend: the Calendar page (feature 12b): one person's or place's week. The business and the
// caller always come from the session. A role that may change the business sees every calendar;
// anyone else only their own person's, read-only.

import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { validator } from "hono/validator";

import { availabilityRule, resource } from "@scheduleads-app/shared/db";
import { localDate } from "@scheduleads-app/shared/local-date";
import { scheduleWeekQueryValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { db } from "../database.js";
import {
  hasBusinessPermission,
  type PermissionsType,
} from "../lib/auth/has-business-permission.js";
import { findSignedInPerson } from "../lib/calendar/find-signed-in-person.js";
import { refuse } from "../lib/errors/refuse.js";
import { findScheduleWeek } from "../lib/schedule/find-schedule-week.js";
import { mondayOf } from "../lib/schedule/monday-of.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const CHANGE_BUSINESS: PermissionsType = { organization: ["update"] };

export const scheduleRoutes = new Hono()
  // One week of one person or place, and the calendars this login may pick between.
  .get(
    "/",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    validator("query", (value, c) => {
      const parsed = scheduleWeekQueryValidationSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      const message = parsed.error.issues[0]?.message ?? "Check the address and try again.";
      return c.json(refuse("bad_request", message), 400);
    }),
    async (c) => {
      const { organizationId } = c.get("organization");
      const query = c.req.valid("query");
      const [canEdit, own] = await Promise.all([
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
        findSignedInPerson(organizationId, c.get("user").id),
      ]);

      // An owner picks between every active person and place, people first; anyone else sees
      // only their own person.
      const everyone = canEdit
        ? await db
            .select({ id: resource.id, name: resource.name, kind: resource.kind })
            .from(resource)
            .where(and(eq(resource.organizationId, organizationId), eq(resource.active, true)))
            .orderBy(asc(resource.kind), asc(resource.name)) // "person" sorts before "place"
        : [];
      if (!canEdit && !own) {
        return c.json(
          refuse("no_person", "Your login is not linked to anyone on this business's calendar."),
          409
        );
      }

      const wantedId = query.resourceId ?? own?.id ?? everyone[0]?.id;
      if (!wantedId) {
        return c.json(refuse("not_found", "This business has nobody on its calendar yet."), 404);
      }
      if (!canEdit && wantedId !== own?.id) {
        return c.json(refuse("forbidden", "You can see only your own calendar."), 403);
      }
      // Any of the business's own, a turned-off one too, so an old link still opens; never another's.
      const [shown] = await db
        .select({ id: resource.id, name: resource.name, kind: resource.kind })
        .from(resource)
        .where(and(eq(resource.organizationId, organizationId), eq(resource.id, wantedId)))
        .limit(1);
      if (!shown) return c.json(refuse("not_found", "That calendar is not one of yours."), 404);

      const [business] = await db
        .select({ timezone: availabilityRule.timezone })
        .from(availabilityRule)
        .where(
          and(
            eq(availabilityRule.organizationId, organizationId),
            isNull(availabilityRule.resourceId)
          )
        )
        .limit(1);
      if (!business?.timezone) {
        return c.json(
          refuse("no_business_hours", "Set the business's hours on Settings first."),
          409
        );
      }

      const weekOf = mondayOf(query.weekOf ?? localDate(new Date(), business.timezone));
      const week = await findScheduleWeek({
        organizationId,
        resource: shown,
        timezone: business.timezone,
        weekOf,
      });
      const resources = canEdit
        ? everyone.some((one) => one.id === shown.id)
          ? everyone
          : [...everyone, shown]
        : [shown];

      return c.json(
        { canEdit, timezone: business.timezone, resource: shown, resources, ...week },
        200
      );
    }
  );
