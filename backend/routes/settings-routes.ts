// Backend: the owner's Settings pages: Hours (feature 12a), Services and People (12d). The business always comes from the
// session, never from the request; any member may read, only a role that may change the business
// may save.

import { Hono, type Context } from "hono";
import { validator } from "hono/validator";
import type { ZodError } from "zod";

import {
  businessHoursValidationSchema,
  addResourceValidationSchema,
  personHoursValidationSchema,
  saveResourceValidationSchema,
  saveServiceResourcesValidationSchema,
  serviceValidationSchema,
} from "@scheduleads-app/shared/zod-validation";

import {
  hasBusinessPermission,
  type PermissionsType,
} from "../lib/auth/has-business-permission.js";
import { refuse } from "../lib/errors/refuse.js";
import { addResource } from "../lib/settings/add-resource.js";
import { addService } from "../lib/settings/add-service.js";
import { findHoursSettings } from "../lib/settings/find-hours-settings.js";
import { findPeopleSettings } from "../lib/settings/find-people-settings.js";
import { findServicesSettings } from "../lib/settings/find-services-settings.js";
import { saveBusinessHours } from "../lib/settings/save-business-hours.js";
import { savePersonHours } from "../lib/settings/save-person-hours.js";
import { saveResource } from "../lib/settings/save-resource.js";
import { saveService } from "../lib/settings/save-service.js";
import { saveServiceResources } from "../lib/settings/save-service-resources.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

const CHANGE_BUSINESS: PermissionsType = { organization: ["update"] };
// Says which field, so the form shows it under the name rather than as a general failure.
const NAME_TAKEN = {
  ...refuse("name_taken", "Another person or place here already has that name."),
  field: "name",
};

// The first problem, with where it is ("weeklyHours.mon.1"), so the form can show it in place.
const refuseFirstIssue = (c: Context, error: ZodError) => {
  const issue = error.issues[0];
  return c.json(
    {
      ...refuse("bad_request", issue?.message ?? "Check the form and try again."),
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
      // The answer lists the upcoming bookings the new hours leave outside; none is changed.
      const saved = await saveBusinessHours(
        c.get("organization").organizationId,
        c.req.valid("json"),
        new Date()
      );
      return c.json(saved, 200);
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
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "no_person")
        return c.json(refuse("not_found", "No person here."), 404);
      if (!saved.ok)
        return c.json(refuse("no_business_hours", "Set the business's hours first."), 409);
      return c.json({ person: saved.person, outsideHours: saved.outsideHours }, 200);
    }
  )

  // The Services page: every service of the business, live or hidden, with who is ticked on each,
  // and every person and place to tick.
  .get(
    "/services",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findServicesSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  .post(
    "/services",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = serviceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const service = await addService(c.get("organization").organizationId, c.req.valid("json"));
      return c.json({ service }, 201);
    }
  )

  // Another business's service or an unknown id: the same 404.
  .put(
    "/services/:serviceId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = serviceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      // A new length lists the upcoming bookings that would no longer fit; none is changed.
      const saved = await saveService(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved) return c.json(refuse("not_found", "No service here."), 404);
      return c.json(saved, 200);
    }
  )

  // Who does a service: the ticks replace the ones before. A person or place of another business, or
  // one in the wrong list, is refused on its list and nothing changes.
  .put(
    "/services/:serviceId/resources",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveServiceResourcesValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveServiceResources(
        c.get("organization").organizationId,
        c.req.param("serviceId"),
        c.req.valid("json")
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No service here."), 404);
      if (!saved.ok)
        return c.json({ ...refuse("bad_request", saved.message), field: saved.field }, 400);
      return c.json(saved.ticks, 200);
    }
  )

  // The People page: every person and place of the business, on or off.
  .get(
    "/people",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    async (c) => {
      const { organizationId } = c.get("organization");
      const [settings, canEdit] = await Promise.all([
        findPeopleSettings(organizationId),
        hasBusinessPermission(c.req.raw.headers, organizationId, CHANGE_BUSINESS),
      ]);
      return c.json({ canEdit, ...settings }, 200);
    }
  )

  .post(
    "/people",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = addResourceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const added = await addResource(c.get("organization").organizationId, c.req.valid("json"));
      if (!added.ok) return c.json(NAME_TAKEN, 409);
      return c.json({ resource: added.resource }, 201);
    }
  )

  // Never deleted: off stops new bookings and the answer lists the ones they still hold. Another
  // business's person or place, or an unknown id: the same 404.
  .put(
    "/people/:resourceId",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware(CHANGE_BUSINESS),
    validator("json", (value, c) => {
      const parsed = saveResourceValidationSchema.safeParse(value);
      return parsed.success ? parsed.data : refuseFirstIssue(c, parsed.error);
    }),
    async (c) => {
      const saved = await saveResource(
        c.get("organization").organizationId,
        c.req.param("resourceId"),
        c.req.valid("json"),
        new Date()
      );
      if (!saved.ok && saved.reason === "not_found")
        return c.json(refuse("not_found", "No person or place here."), 404);
      if (!saved.ok && saved.reason === "name_taken") return c.json(NAME_TAKEN, 409);
      if (!saved.ok && saved.reason === "bad_work_email")
        return c.json({ ...refuse("bad_request", saved.message), field: "workEmail" }, 400);
      if (!saved.ok && saved.reason === "no_sending_address")
        return c.json(
          {
            ...refuse("no_sending_address", "Set the business's sending address first."),
            field: "workEmail",
          },
          409
        );
      if (!saved.ok)
        return c.json(
          refuse("last_person", "Someone has to stay on: turn another person on first."),
          409
        );
      return c.json({ resource: saved.resource, upcomingBookings: saved.upcomingBookings }, 200);
    }
  );
