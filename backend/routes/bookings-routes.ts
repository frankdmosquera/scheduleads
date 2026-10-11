// Backend: the owner's own actions on bookings, from any dashboard screen (feature 12e: the Days
// off page; the lead page and the calendar later). The business always comes from the session.

import { Hono } from "hono";
import { validator } from "hono/validator";

import { cancelBookingsValidationSchema } from "@scheduleads-app/shared/zod-validation";

import { cancelBookingsByOwner } from "../lib/booking/cancel-bookings-by-owner.js";
import { refuse } from "../lib/errors/refuse.js";
import { requireOrganizationMiddleware } from "../middleware/auth-middleware/require-organization-middleware.js";
import { requirePermissionMiddleware } from "../middleware/auth-middleware/require-permission-middleware.js";
import { requireKnownSubscriptionMiddleware } from "../middleware/subscription-middleware/require-known-subscription-middleware.js";
import { requireModuleMiddleware } from "../middleware/subscription-middleware/require-module-middleware.js";

export const bookingsRoutes = new Hono()
  // Cancels each booking as its customer would, naming the owner. A booking of another business
  // or an unknown id refuses the whole list with one 404, and nothing is cancelled.
  .post(
    "/cancel",
    requireOrganizationMiddleware,
    requireKnownSubscriptionMiddleware,
    requireModuleMiddleware("booking"),
    requirePermissionMiddleware({ organization: ["update"] }),
    validator("json", (value, c) => {
      const parsed = cancelBookingsValidationSchema.safeParse(value);
      if (parsed.success) return parsed.data;
      const issue = parsed.error.issues[0];
      return c.json(
        {
          ...refuse("bad_request", issue?.message ?? "Check the list and try again."),
          field: issue?.path.join(".") ?? "",
        },
        400
      );
    }),
    async (c) => {
      const result = await cancelBookingsByOwner(
        c.get("organization").organizationId,
        c.get("user").id,
        c.req.valid("json").bookingIds,
        new Date()
      );
      if (!result.ok) return c.json(refuse("not_found", "No booking here."), 404);
      const { cancelled, alreadyCancelled, alreadyStarted } = result;
      return c.json({ cancelled, alreadyCancelled, alreadyStarted }, 200);
    }
  );
