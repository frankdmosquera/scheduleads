// Backend: the owner's Settings page. Hours so far (feature 12a). The business always comes from the
// session, never from the request; any member may read, only a role that may change the business
// may save.

import { Hono, type Context } from "hono";
import { validator } from "hono/validator";
import type { ZodError } from "zod";

import {
  businessHoursValidationSchema,
  personHoursValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import {
  hasBusinessPermission,
  type PermissionsType,
} from "../lib/auth/has-business-permission.js";
import { refuse } from "../lib/errors/refuse.js";
import { findHoursSettings } from "../lib/settings/find-hours-settings.js";
import type { OutsideHoursBookingType } from "../lib/settings/outside-hours-booking-type.js";
import { saveBusinessHours } from "../lib/settings/save-business-hours.js";
import { savePersonHours } from "../lib/settings/save-person-hours.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const CHANGE_BUSINESS: PermissionsType = { organization: ["update"] };

// The first problem, with where it is ("weeklyHours.mon.1"), so the card can show it in place.
const refuseFirstIssue = (c: Context, error: ZodError) => {
  const issue = error.issues[0];
  return c.json(
    {
      ...refuse("bad_request", issue?.message ?? "Check the hours and try again."),
      field: issue?.path.join(".") ?? "",
    },
    400
  );
};

export const settingsRoutes = new Hono()
  // The Hours section: the business's hours (null before the first save) and every active person's.
  .get(
    "/hours",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findHoursSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  // The business's card. Never touches its closed days or holidays.
  .put(
    "/hours/business",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = businessHoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const business = await saveBusinessHours(
        c.get("organization").organizationId,
        c.req.valid("json")
      );
      const outsideHours: OutsideHoursBookingType[] = []; // filled from step 12a.2
      return c.json({ business, outsideHours }, 200);
    }
  )

  // One person's card. Another business's person, a place or an unknown id: the same 404.
  .put(
    "/hours/people/:personId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = personHoursValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await savePersonHours(
        c.get("organization").organizationId,
        c.req.param("personId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "no_person")
        return c.json(refuse("not_found", "No person here."), 404);
      if (!saved.ok)
        return c.json(refuse("no_business_hours", "Set the business's hours first."), 409);
      const outsideHours: OutsideHoursBookingType[] = []; // filled from step 12a.2
      return c.json({ person: saved.person, outsideHours }, 200);
    }
  );
